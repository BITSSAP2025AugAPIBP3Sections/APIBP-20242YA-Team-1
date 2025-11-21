from fastapi import APIRouter, Request
from app.middleware.jwt_auth import decode_for_health

router = APIRouter(
    prefix="/api",
    tags=["Base"]
)

@router.get("/health", summary="Health Check", description="Check if the OCR service is up and running and report JWT status.")
async def health_check(request: Request):
    """
    Health check endpoint to verify the service status.
    """
    return {
        "status": "ok",
        "service": "invoice-ocr",
        "version": "1.0.0",
        "auth": decode_for_health(request.headers.get("Authorization"))
    }
