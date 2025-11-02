from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.pdf_extractor import extract_text_from_pdf

router = APIRouter(prefix="/ocr", tags=["OCR"])

@router.post("/pdf_to_text", summary="Extract raw text from uploaded PDF")
async def extract_text(file: UploadFile = File(...)):
    """
    Upload a PDF and extract its raw text using PDFMiner.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        text = extract_text_from_pdf(file)
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text extracted from the PDF.")
        return {"text": text.strip()}
    except HTTPException as e:
        raise e
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")
