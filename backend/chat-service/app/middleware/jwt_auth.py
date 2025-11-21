import os
import jwt
from fastapi import Request
from fastapi.responses import JSONResponse

PUBLIC_PATHS = {"/", "/api/v1/health"}

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

async def jwt_http_middleware(request: Request, call_next):
    path = request.url.path
    # Allow docs & openapi and public paths
    if (
        path in PUBLIC_PATHS or
        path.startswith("/docs") or
        path.startswith("/redoc") or
        path.startswith("/openapi.json")
    ):
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})
    token = auth_header[7:]
    if not JWT_SECRET:
        return JSONResponse(status_code=500, content={"detail": "Server JWT secret not configured"})
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        request.state.user = payload
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token expired"})
    except jwt.InvalidTokenError as e:
        return JSONResponse(status_code=401, content={"detail": "Invalid token", "error": str(e)})
    return await call_next(request)


def decode_token_for_health(auth_header: str | None):
    """Utility used by health endpoint to report auth status without enforcing."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"authenticated": False, "reason": "no-token"}
    if not JWT_SECRET:
        return {"authenticated": False, "reason": "server-misconfig"}
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"authenticated": True, "user": {k: payload.get(k) for k in ["sub", "email", "username"]}}
    except jwt.ExpiredSignatureError:
        return {"authenticated": False, "reason": "expired"}
    except jwt.InvalidTokenError:
        return {"authenticated": False, "reason": "invalid"}
