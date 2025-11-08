from fastapi import APIRouter, HTTPException, Query, Depends, Request
from app.core.orchestrator import VendorKnowledgeOrchestrator

# Unified router (no extra prefix to keep paths explicit)
router = APIRouter(tags=["VendorIQ RAG Service"])

# Provide a fresh orchestrator per request (avoid shared mutable state)
def get_orchestrator():
    return VendorKnowledgeOrchestrator()

# Load / build knowledge base (cron/internal use)
@router.post("/knowledge/load", summary="Load & Index Vendor Knowledge", description="Load vendor data, generate embeddings, store in vector DB")
async def load_vendor_knowledge(
    incremental: bool = Query(False, description="Only index new chunks if true"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        result = orchestrator.process_vendor_data(incremental=incremental)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge load failed: {str(e)}")

# Chat RAG endpoint 
@router.get(
    "/query",
    summary="Query Vendor Knowledge",
    description="Answer a question about a specific vendor using vector retrieval + LLM generation.",
)
async def chat_query(
    question: str = Query(..., description="User question"),
    orchestrator: VendorKnowledgeOrchestrator = Depends(get_orchestrator),
):
    try:
        result = orchestrator.answer_query(question=question)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
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
        if path == "/api/v1/endpoints":  # do not list this listing endpoint itself
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