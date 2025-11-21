from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat
import uvicorn
from app.routes.graphql import graphql_router
from fastapi.openapi.utils import get_openapi


app = FastAPI(
    title="VendorIQ Chat Service",
    description=(
        "### Overview\n"
        "This service provides both **REST** and **GraphQL** APIs.\n\n"
        "**REST Endpoints**\n"
        "- Manage user messages, chat sessions, and system health.\n\n"
        "**GraphQL Endpoint**\n"
        "- **URL:** `/graphql`\n"
        "- Supports queries and mutations for chat interactions.\n"
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST router
app.include_router(chat.router, prefix="/api/v1")
# Include GraphQL router (no /api prefix to follow common convention)
app.include_router(graphql_router, prefix="/graphql")

# Inject OpenAPI security scheme so Swagger UI shows Authorize button
PUBLIC_PATHS = {"/", "/api/v1/health"}

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    components = openapi_schema.setdefault("components", {})
    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Paste: Bearer <access_token> issued by authentication-service"
    }
    # Add security requirement to all non-public paths (exclude health & root)
    for path, methods in openapi_schema.get("paths", {}).items():
        if path in PUBLIC_PATHS or "health" in path:
            continue
        for method_obj in methods.values():
            method_obj.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to VendorIQ Chat Service 🚀", "docs": "/docs", "health": "/api/v1/health"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=4005, reload=True)