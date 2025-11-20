# 🧾 VendorIQ.ai :- Invoice OCR + Gemini Extraction Microservice

This microservice extracts text from vendor invoice PDFs using OCR and converts it into structured JSON using the **Gemini API**.

---

## Tech Stack
- **FastAPI** — Web Framework
- **PDFMiner** — OCR Text Extraction
- **Google Gemini API** — AI-based JSON Conversion
- **Uvicorn** — ASGI Server

---

## 📁 Project Structure
app/
├── routes/ # API routes
├── services/ # Business logic (Gemini, OCR)
├── models/ # Data models (Pydantic)
└── utils/ # Helper functions
        "refreshToken": "<user-drive-refresh-token>",



## 🚀 How to Run

1.  **Create a virtual environment:**
- Each request must include the calling user's Drive refresh token; environment-level tokens are no longer used.
- Processed JSON files are written to `invoices_json/<invoiceFolderId>/` and a vendor-level `master.json` is generated locally and pushed back to Google Drive.
- To fetch the latest vendor/invoice lists and process everything in one shot, call `POST /api/v1/processing/vendor/sync` with `{ "userId": "...", "refreshToken": "..." }`.
    ```
2.  **Activate the virtual environment:**
    * On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```
    * On Windows:
        ```bash
        venv\Scripts\activate
        ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the application:**
    ```bash
    uvicorn app.main:app --reload 
    or 
    python -m app.main
    ```
5.  **View API Documentation:**
    Open your browser and go to [http://0.0.0.0:4003/docs](http://0.0.0.0:4003/docs) to see the Swagger UI.

---

## 🔁 Triggering OCR from the Email Service

- Use `POST /api/v1/processing/vendor` to synchronously process the invoices that were just uploaded for a vendor. Provide the Drive metadata captured by the email microservice:

    ```json
    {
        "userId": "<user-id>",
        "vendorName": "Acme Inc",
        "vendorFolderId": "<drive-folder-id>",
        "invoiceFolderId": "<drive-invoice-folder-id>",
        "invoices": [
            { "fileId": "<drive-file-id>", "fileName": "invoice.pdf" }
        ]
    }
    ```

- Optional header `x-ocr-token` must match the `OCR_TRIGGER_TOKEN` env var when set.
- Processed JSON files are written to `invoices_json/<invoiceFolderId>/` and a vendor-level `master.json` is generated locally and pushed back to Google Drive.
- To fetch the latest vendor/invoice lists and process everything in one shot, call `POST /api/v1/processing/vendor/sync` with `{ "userId": "..." }`.