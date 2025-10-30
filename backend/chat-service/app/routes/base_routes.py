from fastapi import APIRouter

router = APIRouter()

@router.get("/chat", tags=["Chatbot"])
def chat(query: str):
    return {"query": query, "response": "This is a dummy response from chatbot."}

@router.get("/sheets/{sheet_id}", tags=["Sheets"])
def read_sheet(sheet_id: str):
    return {"sheet_id": sheet_id, "data": "This is a dummy sheet data."}

@router.get("/health", summary="Health Check", description="Check if the OCR service is up and running.")
async def health_check():
    """
    Health check endpoint to verify the service status.
    """
    return {
        "status": "ok",
        "service": "chat-service",
        "version": "1.0.0"
    }