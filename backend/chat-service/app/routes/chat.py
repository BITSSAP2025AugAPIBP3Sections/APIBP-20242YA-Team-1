from fastapi import APIRouter, HTTPException, Query
from app.core.orchestrator import VendorKnowledgeOrchestrator

# Unified router (no extra prefix to keep paths explicit)
router = APIRouter(tags=["VendorIQ RAG Service"])

orchestrator = VendorKnowledgeOrchestrator()

# Load / build knowledge base (cron/internal use)
@router.post("/knowledge/load", summary="Load & Index Vendor Knowledge", description="Load vendor data, generate embeddings, store in vector DB")
async def load_vendor_knowledge(
    incremental: bool = Query(False, description="Only index new chunks if true")
):
    try:
        result = orchestrator.process_vendor_data(incremental=incremental)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge load failed: {str(e)}")


@router.delete(
    "/delete-context",
    summary="Clear Vector Database",
    description="Delete all stored embeddings and reset the vendor knowledge database.",
)
async def delete_context():
    try:
        result = orchestrator.reset_database()
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Failed to clear database."))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete context: {str(e)}")


# Health
@router.get("/health", summary="Health Check", description="Service + vector DB status")
async def health_check():
    try:
        stats = orchestrator.get_system_stats()
        return {
            "status": "ok" if stats.get("success") else "error",
            "service": "chat-rag-service",
            "vector": stats.get("stats", {}),
        }
    except Exception as e:
        return {"status": "error", "service": "chat-rag-service", "error": str(e)}