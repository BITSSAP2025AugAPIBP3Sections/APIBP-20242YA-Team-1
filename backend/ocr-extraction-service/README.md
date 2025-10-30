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
