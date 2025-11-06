# 🧾 Invoice OCR + Gemini Extraction Microservice

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



## 🚀 How to Run

1.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
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
    ```
5.  **View API Documentation:**
    Open your browser and go to [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to see the Swagger UI.