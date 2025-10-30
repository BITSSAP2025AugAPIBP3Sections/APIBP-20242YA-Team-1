from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html

tags_metadata = [
    {
        "name": "Health",
        "description": "Health check and monitoring endpoints."
    },
    {
        "name": "Chatbot",
        "description": "Endpoints related to vendor chat and AI responses."
    },
    {
        "name": "Sheets",
        "description": "Endpoints for reading Google Sheets data."
    }
]

app = FastAPI(
    title="VendorIQ Chatbot Service",
    description="AI-driven chatbot for vendor and invoice analysis.",
    version="1.0.0",
    openapi_tags=tags_metadata
)


# Allow frontend CORS   
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or list specific domains ["https://vendoriq.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Example routes
@app.get("/ping", tags=["Health"])
def ping():
    return {"status": "ok", "message": "Chatbot Service running"}

@app.get("/chat", tags=["Chatbot"])
def chat(query: str):
    return {"query": query, "response": "This is a dummy response from chatbot."}

@app.get("/sheets/{sheet_id}", tags=["Sheets"])
def read_sheet(sheet_id: str):
    return {"sheet_id": sheet_id, "data": "This is a dummy sheet data."}