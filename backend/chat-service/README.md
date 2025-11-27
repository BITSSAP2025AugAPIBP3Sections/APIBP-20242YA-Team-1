## 🤖 VendorIQ Chat Service

AI-driven chatbot microservice for vendor and invoice analysis, providing intelligent responses based on vendor data and invoice information.

---

## 📊 Current Implementation Status

### Features
- **FastAPI Application Setup** - Core web framework with proper metadata and documentation
- **CORS Configuration** - Cross-origin resource sharing enabled for frontend integration
- **Health Check Endpoint** - Service monitoring for embedding and vector DB. Return collections and chunks counts from vector DB
- **Environment Configuration** - Setup for API keys and Google credentials
- **GraphQL API** - Strawberry GraphQL endpoint at `/graphql` with queries & mutations for knowledge base management and chat

- **OpenAPI Documentation** - Auto-generated API docs with proper tagging
- **AI Integration** - Gemini 2.5 Flash integration & RAG workflow

- **Vector Database (ChromaDB)** - Knowledge base for contextual responses with proper metadata serialization
- **Invoice Schema Support** - Handles new array-based invoice format with detailed line items
- **Chat History Management** - Conversation persistence and memory
- **Advanced Analytics Queries** - Complex vendor insights and reporting
- **Real-time Data Processing** - Live invoice and vendor data analysis

---

## 📊 Data Schema Format

### Invoice Data Structure
The service expects invoice data in the following array format:

```json
[
  {
    "vendor_name": "Zencorporations",
    "invoice_number": "1213",
    "invoice_date": "16.12.2021",
    "total_amount": "2809.30",
    "line_items": [
      {
        "item_description": "Product Name",
        "quantity": "3",
        "unit_price": "9.90",
        "amount": "29.70"
      }
    ]
  }
]
```

### Key Schema Fields
- `vendor_name` - Name of the vendor/supplier
- `invoice_number` - Unique invoice identifier
- `invoice_date` - Invoice date (string format)
- `total_amount` - Total invoice amount (string, can be null)
- `line_items` - Array of invoice line items with:
  - `item_description` - Description of the item/service
  - `quantity` - Quantity ordered (string, can be null)
  - `unit_price` - Price per unit (string)
  - `amount` - Total amount for line item (string, can be null)

---

## 🧠 AI Stack Overview (Updated)
- LLM: Gemini 2.5 Flash (Google Generative AI)
- Retrieval Framework: Custom prompt builder (LangChain no longer required for core LLM usage, kept for future orchestration)
- Vector DB: ChromaDB with JSON serialization for complex metadata
- Embedding Model: sentence-transformers (all-mpnet-base-v2 by default)

## 🔄 Pipeline
### Data Ingestion Pipeline:
```
Load vendor JSON -> Parse invoice arrays -> Convert to knowledge chunks -> Generate Embeddings -> Store in ChromaDB
```
### Query Retrieval Pipeline:
```
Query -> Generate Embedding -> Retrieve context from ChromaDB -> (context + Query) to Gemini LLM -> Response
```

---

## 🛠 Tech Stack
- **FastAPI** - Modern Python web framework
- **Strawberry GraphQL** - Code-first GraphQL schema
- **(Optional) LangChain** - Future orchestration needs
- **Gemini 2.5 Flash** - Hosted multimodal instruction model
- **sentence-transformers** - Embedding generation
- **ChromaDB** - Vector storage & similarity search with metadata serialization
- **Google APIs** - Sheets and authentication integration
- **Pandas** - Data processing and analysis
- **Uvicorn** - ASGI server

---

## 📁 Project Structure
```
app/
├── main.py              # FastAPI application and route mounting (REST + GraphQL)
├── config.py            # Environment variables and settings
├── core/                # Main logic (LLM, embeddings, retrieval, orchestrator)
│   ├── loader.py        # Data loading and chunk creation with new schema support
│   ├── embedder.py      # Embedding generation using sentence-transformers
│   ├── retriever.py     # ChromaDB vector database operations
│   ├── orchestrator.py  # Main coordination logic
│   └── llm_service.py   # Gemini LLM integration
├── routes/              # REST API route handlers (prefixed with /api)
├── graphql/             # Strawberry GraphQL schema & router
├── models/              # Data / Pydantic schemas with LineItem and Invoice models
├── sample-data/         # Sample vendor invoice data in new array format
└── data/vectordb/       # ChromaDB persistence directory
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
python3 -m venv venv
source venv/bin/activate  

# Install dependencies
pip3 install -r requirements.txt
```

### Environment Setup
Create a `.env` file (if customizing):
```env
GEMINI_MODEL_NAME=gemini-2.5-flash 
GOOGLE_GEMINI_API_KEY=your_api_key_here
VECTORDB_PERSIST_DIRECTORY=data/vectordb
VENDOR_DATA_DIRECTORY=sample-data
```

### Data Setup
Place your invoice data in JSON files within the `sample-data/` directory following the schema format above. The service automatically loads all `.json` files from this directory.

### Running the Service
```bash
# Start the development server
uvicorn app.main:app --host 0.0.0.0 --port 4005 --reload
```

The service will be available at:
- **Base**: `http://localhost:4005`
- **REST Docs (Swagger)**: `http://localhost:4005/docs`
- **GraphQL Playground**: `http://localhost:4005/graphql`
- **Health (REST)**: `http://localhost:4005/api/health`

---

## 📋 REST API Endpoints (Prefix: /api/v1)

### Health & Monitoring
- `GET /api/v1/health` - Health check and service status

### Knowledge Base Management
- `POST /api/v1/knowledge/load?incremental=false` - Load vendor invoice data into vector database
  - Processes JSON files from `sample-data/` directory
  - Creates knowledge chunks for vendor summaries and individual invoices
  - Generates embeddings and stores in ChromaDB
  - Returns processing statistics (vendors loaded, chunks created, embeddings generated)

### Chatbot
- `GET /api/v1/query?question=...` - Ask a question about vendors/invoices using RAG
- `DELETE /api/v1/delete-context` - Clear knowledge base / vector database

---

## 🧬 GraphQL API

Endpoint: `POST /graphql`
Playground UI: Open the endpoint in a browser; Strawberry serves an interactive explorer.

### Schema (high level)
```
Query {
  vendorQuery(question: String!): String
  health: String
}

Mutation {
  loadVendorKnowledge(incremental: Boolean = false): String
  clearKnowledgeBase: String
}
```

### Example Queries
```graphql
query HealthCheck {
  health
}

query AskVendor {
  vendorQuery(question: "What is the total spend for Zencorporations?")
}

query LineItemAnalysis {
  vendorQuery(question: "What items did Zencorporations purchase in invoice 1213?")
}
```

### Example Mutations
```graphql
mutation LoadAll {
  loadVendorKnowledge(incremental: false)
}

mutation ClearKB {
  clearKnowledgeBase
}
```

### Curl Examples
```bash
# Health (GraphQL)
curl -X POST http://localhost:4005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ health }"}'

# Ask about specific vendor
curl -X POST http://localhost:4005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ vendorQuery(question: \\\"Show me invoices from Zencorporations\\\") }"}'

# Load knowledge base
curl -X POST http://localhost:4005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query": "mutation { loadVendorKnowledge(incremental: false) }"}'
```

### When to Use REST vs GraphQL
| Use Case | REST (/api/v1) | GraphQL |
|----------|----------------|---------|
| Simple health or load operations | ✅ | ✅ |
| Ad-hoc question answering | ✅ (query param) | ✅ (more flexible) |
| Batch queries in one round trip | ❌ | ✅ |
| Schema introspection/exploration | ❌ | ✅ |


---

## 🔧 Configuration

Key files:
- `requirements.txt` - Python dependencies (FastAPI, Strawberry, Gemini SDK, embeddings, vector DB)
- `app/config.py` - Environment variable management and settings
- `app/graphql/` - GraphQL schema & router
- `app/core/orchestrator.py` - Central coordination logic
- `app/models/schema.py` - Data models supporting new invoice schema with LineItem

---

## 🤝 Contributing

When working on the chat-service:
1. Follow existing FastAPI and GraphQL patterns (Strawberry schema in `app/graphql`)
2. Add proper type hints and documentation strings
3. Keep REST endpoints under `/api/*`
4. Use GraphQL for composable / multi-field queries
5. Test REST via `/docs` and GraphQL via `/graphql`
6. Ensure proper error handling and response models
7. Keep prompts concise and grounded only in retrieved context
8. When adding new data fields, ensure they're JSON-serializable for ChromaDB storage

---

## 🔗 Integration

This service integrates with:
- **Authentication Service** - User session management
- **Google Sheets Analytics Service** - Vendor and invoice data
- **OCR Extraction Service** - Structured invoice data extraction
- **Frontend** - Chat interface and user interactions


----------------------------------------

# Build
docker build -t chat-service:latest .

# Stop existing container (if running)
docker stop chat-service 2>/dev/null && docker rm chat-service 2>/dev/null || true

# Run with .env file
docker run -d \
  --name chat-service \
  --env-file .env \
  -p 4005:4005 \
  -v "$(pwd)/data:/app/data" \
  chat-service:latest

# View logs
docker logs -f chat-service

# Stop
docker stop chat-service && docker rm chat-service

--------------------------


# 1. Start Minikube
minikube start

# 2. Apply deployment
kubectl apply -f k8s/k8s-deployment.yaml

# 3. Check pods
kubectl get pods -n vendoriq

# 4. Check service
kubectl get svc -n vendoriq

# 5. View logs
kubectl logs -n vendoriq -l app=chat-service -f

# 6. Port forward to access locally
kubectl port-forward -n vendoriq service/chat-service 4005:4005

# 7. Or get Minikube service URL
minikube service chat-service -n vendoriq --url