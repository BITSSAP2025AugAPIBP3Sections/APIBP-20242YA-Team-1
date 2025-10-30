from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["Base"]
)

@router.get("/health", summary="Health Check", description="Check if the OCR service is up and running.")
async def health_check():
    """
    Health check endpoint to verify the service status.
    """
    return {
        "status": "ok",
        "service": "invoice-ocr",
        "version": "1.0.0"
    }
