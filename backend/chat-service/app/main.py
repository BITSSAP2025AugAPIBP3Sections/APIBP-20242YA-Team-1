from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import base_routes


# Initialize FastAPI app
app = FastAPI(
    title="VendorIQ Chatbot Service",
    description="AI-driven chatbot for vendor and invoice analysis.",
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

# Include routers
app.include_router(base_routes.router)

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint to verify service status.
    """
    return {"message": "VendorIQ Chatbot Service is running successfully."}