## 🤖 VendorIQ Chat Service

AI-driven chatbot microservice for vendor and invoice analysis, providing intelligent responses based on vendor data and invoice information.

---

## 📊 Current Implementation Status

### Features
- **FastAPI Application Setup** - Core web framework with proper metadata and documentation
- **CORS Configuration** - Cross-origin resource sharing enabled for frontend integration
- **Health Check Endpoint** - Service monitoring for embedding and vector DB. Return collections and chunks counts from vector DB
- **Environment Configuration** - Setup for API keys and Google credentials

- **OpenAPI Documentation** - Auto-generated API docs with proper tagging
- **AI Integration** - Gemini 2.5 Flash integration & RAG workflow

- **Google Sheets Data Reading** - Actual integration with vendor/invoice data
- **Vector Database (ChromaDB)** - Knowledge base for contextual responses
- **Chat History Management** - Conversation persistence and memory
- **Advanced Analytics Queries** - Complex vendor insights and reporting
- **Real-time Data Processing** - Live invoice and vendor data analysis

---

## 🧠 AI Stack Overview (Updated)
- LLM: Gemini 2.5 Flash (Google Generative AI)
- Retrieval Framework: Custom prompt builder (LangChain no longer required for core LLM usage, kept for future orchestration)
- Vector DB: ChromaDB
- Embedding Model: sentence-transformers (all-mpnet-base-v2 by default)

## 🔄 Pipeline
### Data Ingestion Pipeline:
`
Load vendor JSON -> Convert to chunks -> Generate Embedding -> Store in vector DB 
`
### Query Retrieval Pipeline:
`
Query -> Convert to chunks -> Generate Embedding -> get context from vectorDB  -> (context + Query) to LLM
`


---

## 🛠 Tech Stack
- **FastAPI** - Modern Python web framework
- **(Optional) LangChain** - Future orchestration needs
- **Gemini 2.5 Flash** - Hosted multimodal instruction model
- **sentence-transformers** - Embedding generation
- **ChromaDB** - Vector storage & similarity search
- **Google APIs** - Sheets and authentication integration
- **Pandas** - Data processing and analysis
- **Uvicorn** - ASGI server

---

## 📁 Project Structure
```
app/
├── main.py          # FastAPI application and routes
├── config.py        # Environment variables and settings
├── models/          # Data models (Pydantic schemas)
├── services/        # External integrations (AI, Sheets)
├── routes/          # API route handlers
└── core/            # Main Logic (LLM, embeddings, retrieval)
```
Note: Run `source clean_cache.sh` to clean up the cached file from this folder
---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Google Generative AI API key (Gemini) -> https://ai.google.dev

### Installation
```bash
# Navigate to chat-service directory
cd backend/chat-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  

# Install dependencies
pip install -r requirements.txt
```

### Environment Setup
Create a `.env` file (if customizing):
```env
GEMINI_MODEL_NAME=gemini-2.5-flash 
GOOGLE_GEMINI_API_KEY=your_api_key_here
VECTORDB_PERSIST_DIRECTORY=data/vectordb
VENDOR_DATA_DIRECTORY=sample-data
```

### Running the Service
```bash
# Start the development server
uvicorn app.main:app --host 0.0.0.0 --port 4005 --reload
```

The service will be available at:
- **API**: `http://localhost:4005`
- **Documentation**: `http://localhost:4005/docs`
- **Health Check**: `http://localhost:4005/health`

---

## 📋 API Endpoints

### Health & Monitoring
- `GET /health` - Health check and service status

### Chatbot
- `GET /chat?query={message}` - Send message to chatbot (Gemini-backed RAG)

### Data Integration
- `GET /sheets/{sheet_id}` - Read Google Sheets data (placeholder implementation)

---

## 🎯 Planned Features

### Phase 1: Core AI Integration (Updated)
- Integrate Gemini 2.5 Flash via google-generativeai SDK
- Implement RAG with ChromaDB + structured prompt builder
- Optimize prompt templates for vendor invoice Q&A

### Phase 2: Data Intelligence
- Connect to Google Sheets for live vendor/invoice data
- Implement ChromaDB for semantic search capabilities
- Add context-aware responses based on historical data

### Phase 3: Advanced Analytics
- Vendor spending analysis and insights
- Invoice trend identification
- Predictive analytics for vendor management
- Custom report generation through chat interface

---

## 🔧 Configuration

Key files:
- `requirements.txt` - Python dependencies (FastAPI, Gemini SDK, embeddings, vector DB)
- `app/config.py` - Environment variable management and settings

---

## 🤝 Contributing

When working on the chat-service:
1. Follow existing FastAPI patterns for route organization
2. Add proper type hints and documentation strings
3. Include appropriate API tags for OpenAPI documentation
4. Test endpoints using the auto-generated docs at `/docs`
5. Ensure proper error handling and response models
6. Keep prompts concise and grounded only in retrieved context

---

## 🔗 Integration

This service integrates with:
- **Authentication Service** - User session management
- **Google Sheets Analytics Service** - Vendor and invoice data
- **Frontend** - Chat interface and user interactions