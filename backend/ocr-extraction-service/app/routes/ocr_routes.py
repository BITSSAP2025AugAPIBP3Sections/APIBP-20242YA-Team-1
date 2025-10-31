from fastapi import APIRouter, HTTPException
from app.services.gemini_client import extract_invoice_json_from_text
from app.models.ocr_models import GeminiResponse

router = APIRouter(prefix="/ocr", tags=["Invoice OCR"])

@router.post("/extract-json", response_model=GeminiResponse, summary="Extract structured invoice JSON using Gemini")
def extract_json_from_text(text: str):
    """
    Convert extracted PDF text into structured invoice JSON using Gemini API.
    """
    try:
        result = extract_invoice_json_from_text(text)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
