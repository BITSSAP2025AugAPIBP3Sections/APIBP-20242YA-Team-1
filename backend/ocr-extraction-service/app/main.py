import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from dotenv import load_dotenv

from app.routes import base_routes, invoice_routes, pdf_ocr_routes, processing_routes, text_to_json

load_dotenv()

OCR_PORT = int(os.getenv("OCR_PORT", "4003"))
INVOICES_JSON_FOLDER = os.getenv("INVOICES_JSON_FOLDER", "invoices_json")


def ensure_folder_exists(path: str) -> None:
    os.makedirs(path, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_folder_exists(INVOICES_JSON_FOLDER)
    yield


app = FastAPI(title="Invoice OCR Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_VERSION = "/api/v1"
app.include_router(base_routes.router, prefix=API_VERSION)
app.include_router(pdf_ocr_routes.router, prefix=API_VERSION)
app.include_router(text_to_json.router, prefix=API_VERSION)
app.include_router(invoice_routes.router, prefix=API_VERSION)
app.include_router(processing_routes.router)

# After routers are included, inject custom OpenAPI with bearer auth
PUBLIC_PATHS = {"/", "/api/v1/api/health"}

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="Invoice OCR Service with JWT-protected endpoints. Use Authorize button to provide 'Bearer <access_token>'.",
        routes=app.routes,
    )
    comps = schema.setdefault("components", {})
    sec = comps.setdefault("securitySchemes", {})
    sec["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Paste: Bearer <access_token> from authentication-service"
    }
    for path, methods in schema.get("paths", {}).items():
        if path in PUBLIC_PATHS or "health" in path:
            continue
        for m in methods.values():
            m.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = schema
    return app.openapi_schema

app.openapi = custom_openapi


@app.get("/")
def root() -> dict:
    return {"message": "OCR Service Running"}


if __name__ == "__main__":
    import uvicorn

    ensure_folder_exists(INVOICES_JSON_FOLDER)
    uvicorn.run(app, host="0.0.0.0", port=OCR_PORT)
