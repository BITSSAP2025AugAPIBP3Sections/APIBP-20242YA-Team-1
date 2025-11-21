import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import base_routes, invoice_routes, pdf_ocr_routes, processing_routes, text_to_json
from app.middleware.jwt_auth import jwt_http_middleware

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

# Register JWT middleware
app.middleware("http")(jwt_http_middleware)

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


@app.get("/")
def root() -> dict:
    return {"message": "OCR Service Running"}


if __name__ == "__main__":
    import uvicorn

    ensure_folder_exists(INVOICES_JSON_FOLDER)
    uvicorn.run(app, host="0.0.0.0", port=OCR_PORT)
