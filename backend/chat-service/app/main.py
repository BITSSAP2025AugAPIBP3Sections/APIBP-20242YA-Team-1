from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat
import os, uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="VendorIQ Chat Service",
    description="Backend RAG microservice: /knowledge/load, /chat/query, /health, /delete-context",
    version="1.0.0",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include only RAG/chat router
app.include_router(chat.router, prefix="/api")

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to VendorIQ Chat Service 🚀", "docs": "/docs", "health": "/api/health"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=4005, reload=True)