from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional
from app.core.orchestrator import VendorKnowledgeOrchestrator

# Unified router (no extra prefix to keep paths explicit)
router = APIRouter(tags=["VendorIQ RAG Service"])

# Provide a fresh orchestrator per request (avoid shared mutable state)
def get_orchestrator():
    return VendorKnowledgeOrchestrator()

# Load / build knowledge base (cron/internal use)
@router.post("/knowledge/load", summary="Load & Index Vendor Knowledge", description="Load vendor data (local sample or remote Drive master.json for a user), generate embeddings, store in vector DB")
async def load_vendor_knowledge(
    incremental: bool = Query(False, description="Only index new chunks if true"),
    userId: str | None = Query(None, description="If provided, load remote master.json records for this user from Drive"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        result = orchestrator.process_vendor_data(incremental=incremental, user_id=userId)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        # Invalidate analytics snapshots on full reindex (non-incremental) so fresh aggregation occurs next request
        if not incremental and userId:
            import os, httpx
            base_url = os.getenv("EMAIL_STORAGE_SERVICE_URL", "http://localhost:4002/api/v1")
            delete_url = f"{base_url}/analytics/snapshots"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.delete(delete_url, params={"userId": userId})
            except Exception as e:
                print(f"Analytics snapshot invalidation failed: {e}")

        # Immediately compute and persist fresh analytics snapshots after indexing
        if userId:
            import os, httpx
            base_url = os.getenv("EMAIL_STORAGE_SERVICE_URL", "http://localhost:4002/api/v1")
            persist_url = f"{base_url}/analytics/snapshots"
            periods = ["month", "quarter", "year", "all"]
            for p in periods:
                try:
                    analytics = orchestrator.get_analytics(period=p)
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(persist_url, json={"userId": userId, "period": p, "data": analytics})
                        print(f"Persist snapshot period={p} status={resp.status_code} successField={analytics.get('success')} message={analytics.get('message')}")
                except Exception as e:
                    print(f"Persist analytics snapshot failed period={p}: {e}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge load failed: {str(e)}")

# Chat RAG endpoint 
@router.get(
    "/query",
    summary="Query Vendor Knowledge",
    description="Answer a question about a specific vendor using vector retrieval + LLM generation. Gated by user Google connection if userId provided.",
)
async def chat_query(
    question: str = Query(..., description="User question"),
    vendor_name: str | None = Query(None, description="Explicit vendor to query; if omitted auto-detection/aggregation used"),
    userId: str | None = Query(None, description="User ID to authorize query (must have active Google connection)"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        # Optional gating: if userId supplied, verify Google connection via email-storage-service
        if userId:
            import re, os, httpx
            if not re.match(r"^[a-f0-9]{24}$", userId, re.IGNORECASE):
                raise HTTPException(status_code=400, detail="Invalid userId format")
            base_url = os.getenv("EMAIL_STORAGE_SERVICE_URL", "http://localhost:4002/api/v1")
            sync_url = f"{base_url}/users/{userId}/sync-status"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(sync_url)
                if resp.status_code == 200:
                    payload = resp.json()
                    if not payload.get("hasGoogleConnection"):
                        raise HTTPException(status_code=403, detail="Assistant disabled: Google account disconnected.")
                else:
                    if resp.status_code == 404:
                        raise HTTPException(status_code=404, detail="User not found for gating")
            except HTTPException:
                raise
            except Exception as e:
                print(f"User connection gating check failed: {e}")

        result = orchestrator.answer_query(question=question, vendor_name=vendor_name)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.delete(
    "/delete-context",
    summary="Clear Vector Database",
    description="Delete all stored embeddings and reset the vendor knowledge database.",
)
async def delete_context(orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator)):
    try:
        result = orchestrator.reset_database()
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Failed to clear database."))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete context: {str(e)}")

# Health
@router.get("/health", summary="Health Check", description="Service + vector DB status")
async def health_check(orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator)):
    try:
        stats = orchestrator.get_system_stats()
        return {
            "status": "ok" if stats.get("success") else "error",
            "service": "chat-rag-service",
            "vector": stats.get("stats", {}),
        }
    except Exception as e:
        return {"status": "error", "service": "chat-rag-service", "error": str(e)}

# OPTIONS endpoint to list all registered endpoints in the service
@router.options(
    "/endpoints",
    summary="List Chat-Service Endpoints",
    description="Returns REST (/api/v1) and GraphQL (/graphql) endpoints.",
    tags=["VendorIQ RAG Service"],
)
async def list_endpoints(request: Request):
    app = request.app
    collected = {}
    for route in app.routes:
        if not hasattr(route, "methods"):
            continue
        path = route.path
        # Exclude FastAPI internal + root
        if path in {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc", "/"}:
            continue
        # Only include chat REST and GraphQL root
        if not (path.startswith("/api/v1/") or path == "/graphql"):
            continue
        if path == request.url.path:  # do not list this listing endpoint itself
            continue
        methods = {m for m in route.methods if m != "HEAD"}
        if not methods:
            continue
        if path not in collected:
            collected[path] = {
                "path": path,
                "methods": set(),
                "name": route.name,
                "summary": getattr(route, "summary", None),
                "description": getattr(route, "description", None)
            }
        collected[path]["methods"].update(methods)
    endpoints = []
    for ep in collected.values():
        ep["methods"] = sorted(ep["methods"])  # convert set to sorted list
        endpoints.append(ep)
    endpoints.sort(key=lambda x: x["path"])  # stable order
    return {"count": len(endpoints), "endpoints": endpoints}

@router.get("/analytics", summary="Analytics Overview", description="Aggregated spend & trend analytics across all vendors (cached if available)")
async def analytics_overview(
    period: str = Query("year", description="Range: month | quarter | year | all"),
    userId: Optional[str] = Query(None, description="User ID for per-user cached analytics"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    """Return cached analytics snapshot if fresh; otherwise compute and persist.
    Caching is delegated to email-storage-service which stores snapshots per user+period.
    """
    import os, httpx
    base_url = os.getenv("EMAIL_STORAGE_SERVICE_URL", "http://localhost:4002/api/v1")
    ttl_minutes = int(os.getenv("ANALYTICS_SNAPSHOT_TTL_MINUTES", "60"))
    # Attempt fetch of cached snapshot when userId provided
    if userId:
        snapshot_url = f"{base_url}/analytics/snapshots"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(snapshot_url, params={"userId": userId, "period": period})
            if resp.status_code == 200:
                payload = resp.json()
                if payload.get("cached") and not payload.get("stale"):
                    # Return cached data directly, annotate response
                    cached_data = payload.get("data", {})
                    cached_data["cached"] = True
                    cached_data["period"] = period
                    cached_data["source"] = "snapshot"
                    return cached_data
        except Exception as e:
            # Log and continue to compute fresh
            print(f"Cached analytics fetch failed: {e}")

    # Compute fresh analytics
    result = orchestrator.get_analytics(period=period)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Analytics unavailable"))

    # Persist snapshot asynchronously if userId provided
    if userId:
        persist_url = f"{base_url}/analytics/snapshots"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(persist_url, json={"userId": userId, "period": period, "data": result})
        except Exception as e:
            print(f"Persist analytics snapshot failed: {e}")

    result["cached"] = False
    result["period"] = period
    result["ttlMinutes"] = ttl_minutes
    return result