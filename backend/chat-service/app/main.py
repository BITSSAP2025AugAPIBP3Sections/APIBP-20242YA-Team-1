from fastapi import FastAPI

app = FastAPI(title="Chatbot Service")

@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Chatbot Service running"}
