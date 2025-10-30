## 🤖 VendorIQ Chat Service

AI-driven chatbot microservice for vendor and invoice analysis, providing intelligent responses based on vendor data and invoice information.

---

## 📊 Current Implementation Status

### ✅ Completed Features
- **FastAPI Application Setup** - Core web framework with proper metadata and documentation
- **CORS Configuration** - Cross-origin resource sharing enabled for frontend integration
- **Health Check Endpoint** - Service monitoring and status verification
- **Environment Configuration** - Setup for API keys and Google credentials
- **OpenAPI Documentation** - Auto-generated API docs with proper tagging

### 🚧 In Progress / TODO
- **AI Integration** - OpenAI/LangChain implementation for intelligent responses
- **Google Sheets Data Reading** - Actual integration with vendor/invoice data
- **Vector Database (ChromaDB)** - Knowledge base for contextual responses
- **Chat History Management** - Conversation persistence and memory
- **Advanced Analytics Queries** - Complex vendor insights and reporting
- **Real-time Data Processing** - Live invoice and vendor data analysis

---

## 🛠 Tech Stack
- **FastAPI** - Modern Python web framework
- **OpenAI** - AI language model integration
- **LangChain** - AI application framework
- **ChromaDB** - Vector database for embeddings
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
├── services/        # Business logic (AI, Sheets integration)
├── routes/          # API route handlers
└── utils/           # Helper functions and utilities
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- OpenAI API Key
- Google Cloud credentials for Sheets API

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
Create a `.env` file with the following variables:
```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CREDENTIALS_FILE=path/to/credentials.json
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
- `GET /chat?query={message}` - Send message to chatbot (currently returns dummy responses)

### Data Integration
- `GET /sheets/{sheet_id}` - Read Google Sheets data (placeholder implementation)

---

## 🎯 Planned Features

### Phase 1: Core AI Integration
- Implement OpenAI GPT integration for natural language processing
- Set up LangChain for prompt engineering and AI workflows
- Create basic vendor query processing

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

The service uses the following configuration files:
- `requirements.txt` - Python dependencies including FastAPI, OpenAI, LangChain
- `requirements.in` - Base dependencies for pip-tools compilation
- `app/config.py` - Environment variable management and settings

---


## 🤝 Contributing

When working on the chat-service:
1. Follow the existing FastAPI patterns for route organization
2. Add proper type hints and documentation strings
3. Include appropriate API tags for OpenAPI documentation
4. Test endpoints using the auto-generated docs at `/docs`
5. Ensure proper error handling and response models

---

## 🔗 Integration

This service integrates with:
- **Authentication Service** - User session management
- **Google Sheets Analytics Service** - Vendor and invoice data
- **Frontend** - Chat interface and user interactions