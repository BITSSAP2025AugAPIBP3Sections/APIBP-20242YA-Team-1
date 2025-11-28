from urllib import request
from fastapi import APIRouter, HTTPException
from app.services.gemini_client import extract_invoice_json_from_text
from app.models.ocr_models import GeminiResponse

router = APIRouter(prefix="/ocr", tags=["Invoice OCR"])
SPREADSHEET_SERVICE_URL = http://localhost:4004/api/v1/sheets/update

@router.post("/text_to_json", response_model=GeminiResponse, summary="Extract structured invoice text to JSON using Gemini")
def extract_json_from_text(text: str):
    """
    Convert extracted PDF text into structured invoice JSON using Gemini API.
    """
    # Input validation: check for empty or whitespace-only text
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Input text is empty.")

    try:
        result = extract_invoice_json_from_text(text)
        if "error" in result:
            error_msg = result["error"]

            if "invalid" in error_msg.lower() or "empty" in error_msg.lower() or "bad request" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)
            else:
                raise HTTPException(status_code=500, detail=error_msg)
            # -----------------------------
        # CALL SPREADSHEET SERVICE HERE
        # -----------------------------
        payload = {
            "fromDrive": True,
            "data": result  # JSON produced from OCR
        }

        try:
            response = request.post(SPREADSHEET_SERVICE_URL, json=payload)
            print("Update endpoint response:", response.text)
        except Exception as call_err:
            print("Failed to call update service:", call_err)

        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(status_code=500, detail=str(e))