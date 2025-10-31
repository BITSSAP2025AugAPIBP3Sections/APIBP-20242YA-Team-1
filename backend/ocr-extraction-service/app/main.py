from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import base_routes, pdf_ocr_routes, text_to_json, invoice_routes

# Initialize FastAPI app
app = FastAPI(
    title="Invoice OCR + Gemini Extraction Service",
    description="Microservice for extracting structured data from invoice PDFs using OCR and Gemini API.",
    version="1.0.0"
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(base_routes.router)
app.include_router(pdf_ocr_routes.router)
app.include_router(text_to_json.router)
app.include_router(invoice_routes.router)

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to Invoice OCR + Gemini Extraction Service!"}