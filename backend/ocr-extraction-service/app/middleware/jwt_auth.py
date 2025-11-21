import os
import jwt
from fastapi import Request
from fastapi.responses import JSONResponse

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

PUBLIC_MATCHES = ["/", "/docs", "/redoc", "/openapi.json"]

async def jwt_http_middleware(request: Request, call_next):
    path = request.url.path
    # Allow health + public docs/root
    if any(path.startswith(p) for p in PUBLIC_MATCHES) or "health" in path:
        return await call_next(request)
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})
    if not JWT_SECRET:
        return JSONResponse(status_code=500, content={"detail": "JWT secret not configured"})
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        request.state.user = payload
    except jwt.ExpiredSignatureError:
         return JSONResponse(status_code=401, content={"detail": "Token expired"})
    except jwt.InvalidTokenError as e:
         return JSONResponse(status_code=401, content={"detail": "Invalid token", "error": str(e)})
    return await call_next(request)


def decode_for_health(auth_header: str | None):
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
