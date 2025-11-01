from pdfminer.high_level import extract_text
from fastapi import UploadFile
import tempfile
import os

def extract_text_from_pdf(file: UploadFile) -> str:
    """
    Extracts text from uploaded PDF file using pdfminer.
    """
    tmp_path = None  # Initialize tmp_path to None
    try:
        # Create a temp file to save the uploaded PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name

        # Extract text from the saved file
        extracted_text = extract_text(tmp_path)
        return extracted_text.strip()

    except Exception as e:
        raise Exception(f"Error extracting PDF text: {str(e)}")

    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)