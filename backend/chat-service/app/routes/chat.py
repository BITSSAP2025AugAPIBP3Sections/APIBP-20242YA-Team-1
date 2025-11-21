from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional
from app.core.orchestrator import VendorKnowledgeOrchestrator

# Unified router (no extra prefix to keep paths explicit)
router = APIRouter(tags=["VendorIQ RAG Service"])

# Use a singleton orchestrator to avoid re-loading Gemini model every request
_GLOBAL_ORCHESTRATOR: VendorKnowledgeOrchestrator | None = None

def get_orchestrator():
    global _GLOBAL_ORCHESTRATOR
    if _GLOBAL_ORCHESTRATOR is None:
        _GLOBAL_ORCHESTRATOR = VendorKnowledgeOrchestrator()
    return _GLOBAL_ORCHESTRATOR

# Load / build knowledge base (cron/internal use)
@router.post("/knowledge/load", summary="Load & Index Vendor Knowledge", description="Load vendor data (local sample or remote Drive master.json for a user), generate embeddings, store in vector DB")
async def load_vendor_knowledge(
    incremental: bool = Query(False, description="Only index new chunks if true"),
    userId: str | None = Query(None, description="User whose Drive vendor master.json files will be loaded if refreshToken provided"),
    refreshToken: str | None = Query(None, description="Google OAuth refresh token for Drive access to vendor master.json files"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        result = orchestrator.process_vendor_data(incremental=incremental, user_id=userId, refresh_token=refreshToken)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge load failed: {str(e)}")

# Direct ingest endpoint (OCR service pushes master data; avoids refreshToken usage here)
from pydantic import BaseModel, Field
class DirectVendorPayload(BaseModel):
    vendorName: str = Field(..., description="Vendor name")
    records: list = Field(default_factory=list, description="Array of invoice objects (master.json content)")

class DirectKnowledgeIngest(BaseModel):
    userId: str | None = Field(None, description="Optional user identifier (for logging)")
    incremental: bool = Field(True, description="Skip existing chunks if true")
    vendors: list[DirectVendorPayload] = Field(default_factory=list, description="List of vendor master arrays")

@router.post("/knowledge/ingest", summary="Direct Master JSON Ingest", description="Index raw vendor master arrays pushed from OCR service (bypasses Drive fetch).")
async def direct_ingest(payload: DirectKnowledgeIngest, orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator)):
    try:
        dataset = orchestrator.data_loader.from_raw_vendor_arrays([
            {"vendorName": v.vendorName, "records": v.records} for v in payload.vendors
        ])
        result = orchestrator.process_direct_dataset(dataset, incremental=payload.incremental)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Ingest failed"))
        result["userId"] = payload.userId
        result["vendorCount"] = len(payload.vendors)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Direct ingest failed: {e}")

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

@router.get("/vendor/summary", summary="Vendor Summary", description="Aggregated stats and invoice excerpts for a single vendor from indexed knowledge chunks")
async def vendor_summary(
    vendor_name: str = Query(..., description="Vendor name to summarize"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        result = orchestrator.get_vendor_summary(vendor_name)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("message", "Vendor summary not found"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vendor summary failed: {e}")

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

@router.get("/analytics", summary="Analytics Overview", description="Real-time spend & trend analytics across all vendors with live Gemini summary")
async def analytics_overview(
    period: str = Query("year", description="Range: month | quarter | year | all"),
    userId: Optional[str] = Query(None, description="Reserved for future per-user scoping (currently unused)"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    """Always compute fresh analytics and generate a Gemini summary; no caching layer."""
    result = orchestrator.get_analytics(period=period)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Analytics unavailable"))
    result["cached"] = False
    result["period"] = period
    # Indicate live generation
    result["source"] = "live"
    return result