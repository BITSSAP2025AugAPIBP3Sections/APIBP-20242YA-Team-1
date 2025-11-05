from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat
import uvicorn
from app.routes.graphql import graphql_router  


app = FastAPI(
    title="VendorIQ Chat Service",
    description=(
        "### Overview\n"
        "This service provides both **REST** and **GraphQL** APIs.\n\n"
        "**REST Endpoints**\n"
        "- Manage user messages, chat sessions, and system health.\n\n"
        "**GraphQL Endpoint**\n"
        "- **URL:** `/graphql`\n"
        "- Supports queries and mutations for chat interactions.\n"
    ),
    version="1.1.0", 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST router
app.include_router(chat.router, prefix="/api")
# Include GraphQL router (no /api prefix to follow common convention)
app.include_router(graphql_router, prefix="/graphql")

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to VendorIQ Chat Service 🚀", "docs": "/docs", "health": "/api/health"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=4005, reload=True)