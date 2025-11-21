from fastapi import APIRouter, Request
from app.middleware.jwt_auth import decode_for_health

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

@router.get("/verify", summary="Verify JWT access token", description="Decode and validate Authorization: Bearer access token.")
async def verify(request: Request):
    auth = request.headers.get("Authorization")
    return decode_for_health(auth)