import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def extract_invoice_json_from_text(extracted_text: str):
    """
    Send extracted PDF text to Gemini API and receive structured invoice JSON.
    """

    if not GEMINI_API_KEY:
        raise ValueError("❌ GEMINI_API_KEY not found in environment variables")

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    prompt = f"""
    Extract structured invoice information from the following text. 
    Return output ONLY in JSON format with fields not extra unnecessary explanations or informations:
    {{
        "vendor_name": "",
        "invoice_number": "",
        "invoice_date": "",
        "total_amount": "",
        "currency": "",
        "line_items": [
            {{
                "item_description": "",
                "quantity": "",
                "unit_price": "",
                "amount": ""
            }}
        ]
    }}

    Text:
    {extracted_text}
    """

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    try:
        response = requests.post(GEMINI_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        # Safely extract the model output
        model_output = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not model_output:
            raise ValueError("Empty response from Gemini API")

        # Try parsing as JSON
        try:
            parsed_output = json.loads(model_output)
            return parsed_output
        except json.JSONDecodeError:
            # If model returned text with explanations, try to extract JSON manually
            start = model_output.find("{")
            end = model_output.rfind("}")
            if start != -1 and end != -1:
                return json.loads(model_output[start:end + 1])
            raise ValueError("Invalid JSON returned by Gemini API")

    except requests.exceptions.RequestException as e:
        print(f"Gemini API request failed: {e}")
        return {"error": str(e)}
    except Exception as e:
        print(f"Error while parsing Gemini response: {e}")
        return {"error": str(e)}
