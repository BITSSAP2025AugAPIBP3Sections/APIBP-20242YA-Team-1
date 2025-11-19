from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.pdf_extractor import extract_text_from_pdf
from app.services.gemini_client import extract_invoice_json_from_text
from app.models.ocr_models import GeminiResponse

router = APIRouter(prefix="/invoice", tags=["Invoice API"])

@router.post("/extract", response_model=GeminiResponse, summary="Upload a PDF and extract structured invoice JSON")
async def extract_invoice(file: UploadFile = File(...)):
    """
    Upload a PDF invoice, extract text using OCR, and parse structured JSON via Gemini API.
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a PDF.")

    try:
        # Step 1: Extract text from PDF
        pdf_text = extract_text_from_pdf(file)
        if not pdf_text.strip():
            raise HTTPException(status_code=400, detail="No text found in the PDF.")

        # Step 2: Send text to Gemini API
        result = extract_invoice_json_from_text(pdf_text)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return result

    except HTTPException as e:
        # Re-raise HTTPException to preserve its status code and message
        raise e
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
