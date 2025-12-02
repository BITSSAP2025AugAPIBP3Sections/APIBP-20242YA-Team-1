# 📁 VendorIQ.AI  

### 🤖 AI-Powered Invoice Automation Platform for SMBs

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1)
[![Swagger Docs](https://img.shields.io/badge/docs-swagger-blue)](http://localhost:4000/api-docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1/pulls)
[![Issues](https://img.shields.io/github/issues/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1)](https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1/issues)
[![Contributors](https://img.shields.io/github/contributors/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1)](https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1/graphs/contributors)

[Overview](#-overview) • [Architecture](#-system-architecture) • [Setup](#-getting-started) • [APIs](#-api-endpoints) • [Tech Stack](#-tech-stack) • [Implementation](#-implementation-highlights)

</div>

---

## Overview

### 📌 The Problem
Small and medium businesses (SMBs) handle hundreds of vendor invoices every month.  
They arrive scattered across emails, PDFs, and attachments — making tax audits, reconciliation, and analytics **slow and error-prone**.

### 💡 The Solution
**VendorIQ.AI** is an end-to-end **AI-powered invoice automation system** that:
- Fetches invoices automatically from Gmail.
- Categorizes them by **vendor** into Google Drive.
- Extracts structured data using **OCR + AI**.
- Logs all invoice details into **Google Sheets**.
- Allows querying and insights using a **RAG-based Chatbot**.

---

### 🧩 Services Overview

| Service | Description | Key Tech | Port |
|----------|--------------|-----------|------|
| **Authentication & User Management** | Handles Google OAuth login, email/password registration, JWT tokens, and user profile management. | Python, Flask, JWT, Google OAuth, MongoDB | 4001 |
| **Email & Storage Service** | Fetches invoices from Gmail, identifies vendor from sender, uploads to Drive with vendor-organized folders. Includes scheduler for automatic fetching. | Node.js, Express, MongoDB (Mongoose), Google Gmail/Drive APIs, Helmet, Rate Limiting | 4002 |
| **OCR & Invoice Extraction** | Extracts text from PDF invoices and structures data (vendor, date, amount, items) using AI. | Python, FastAPI, Google Gemini API, pdfminer.six | 4003 |
| **Google Sheets & Analytics** | Logs invoice data to Google Sheets, computes analytics (spending trends, vendor totals). | Node.js, Express, Google Sheets API | 4004 |
| **Chatbot (RAG)** | Vector-based knowledge retrieval system for querying vendor data using natural language. Supports REST and GraphQL. | Python, FastAPI, GraphQL (Strawberry), Embeddings, ChromaDB | 4005 |

> **Note:** Logging is integrated within each service using custom loggers. There is no separate notification service.

---

## 🔄 System Flow

1. **User authenticates** via Authentication Service (Google OAuth or Email/Password).  
2. **Email & Storage Service** connects Gmail, fetches invoice emails, and uploads to Drive in vendor-organized folders.  
3. **OCR Service** extracts structured data from PDF invoices using Google Gemini API.  
4. **Sheets Service** logs extracted invoice data to Google Sheets for analytics.  
5. **RAG Chatbot** uses vector embeddings to answer natural language queries about vendors and invoices.  
6. **Logging** is integrated per-service for audit trails and monitoring.

<div align="center">
  <img src="https://github.com/user-attachments/assets/fa362905-6d4f-4d65-9175-4eb611691ee7" width="80%" alt="System Flow Diagram"/>
</div>

---

##  Features

### Core Features
- 📩 **Gmail Invoice Fetching** (OAuth + scheduled automation)
- 📂 **Google Drive Storage** (vendor-wise folders: `invoiceAutomation/<Vendor>/invoices`)
- 🧾 **AI-Powered OCR** (Google Gemini API for structured extraction)
- 📊 **Google Sheets Analytics** (automatic logging + spending trends)
- 💬 **RAG Chatbot** (natural language queries with vector search)
- 🔔 **Integrated Logging** (per-service audit trails)

### 🔧 Additional Features
- Secure **Google OAuth 2.0** + **Email/Password Authentication**
- **JWT Token Management** (access + refresh tokens)
- RESTful + GraphQL APIs (chat service)
- **Swagger/Flasgger** documentation for all services
- Modular microservice design for independent deployment
- **Security hardening** (Helmet, rate limiting, input validation)
- **Incremental email sync** with lastSyncedAt tracking
- **Cron-based scheduler** (minute/hourly/daily/weekly fetching)

---

## 🛠️ Tech Stack

<div align="center">

| Category | Technologies |
|-----------|---------------|
| **Backend Languages** | Node.js (ES Modules), Python 3.x |
| **Backend Frameworks** | Express.js, Flask, FastAPI |
| **AI/OCR** | Google Gemini API, pdfminer.six |
| **APIs** | Google Gmail API, Google Drive API, Google Sheets API |
| **Database** | MongoDB (Mongoose), Google Sheets |
| **Auth** | Google OAuth 2.0, JWT (PyJWT, jsonwebtoken) |
| **AI/Chatbot** | Vector Embeddings, ChromaDB, RAG Architecture |
| **Security** | Helmet, Express Rate Limit, Cookie Parser |
| **Logging** | Custom Logger (Winston-style), Morgan |
| **Documentation** | Swagger UI, Flasgger |
| **Frontend** | React, Vite, Tailwind CSS, TypeScript |
| **Version Control** | GitHub + Branch Strategy |

</div>

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1.git
cd APIBP-20242YA-Team-1
```

### 2️⃣ Folder Structure

```
VendorIQ.AI/
├── Frontend/                              # React + Vite frontend with Tailwind CSS
└── backend/
    ├── authentication-service/            # Authentication & User Management (Flask)
    ├── email-storage-service/             # Gmail fetch & Drive storage (Express.js)
    ├── ocr-extraction-service/            # OCR + AI extraction (FastAPI + Gemini)
    ├── google-sheets-analytics-service/   # Sheets integration & analytics (Express.js)
    └── chat-service/                      # RAG chatbot with REST + GraphQL (FastAPI)
```

---

### 3️⃣ Environment Setup

Each service has its own `.env` file. Refer to individual service READMEs for detailed setup:
- [Authentication Service](./backend/authentication-service/README.md)
- [Email Storage Service](./backend/email-storage-service/README.md)
- [OCR Extraction Service](./backend/ocr-extraction-service/README.md)
- [Google Sheets Analytics Service](./backend/google-sheets-analytics-service/README.md)
- [Chat Service](./backend/chat-service/README.md)

**Swagger Documentation Available At:**
- 🔐 Auth: `http://localhost:4001/docs`
- 📧 Email: `http://localhost:4002/api-docs`
- 🔍 OCR: `http://localhost:4003/docs`
- 📊 Sheets: `http://localhost:4004/api-docs`
- 💬 Chat: `http://localhost:4005/docs`

---

## 🌿 Branching Strategy

```bash
main                → stable production-ready branch  
dev                 → integration/testing branch  
feature/<name>      → new features  
fix/<name>          → bug fixes  
chore/<name>        → maintenance or config changes

Examples:
feature/gmail-fetch
fix/drive-upload-bug
```

✅ Always link issues in PR:

```
Closes #<issue_number>
```

---

## 📡 API Endpoints

### 🔐 Authentication Service (Port 4001)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/google/login` | GET | Get Google OAuth authorization URL |
| `/auth/callback` | GET | Google OAuth callback handler (unversioned) |
| `/api/v1/auth/login` | POST | Email/password login |
| `/api/v1/auth/register` | POST | Create new user account |
| `/api/v1/auth/refresh` | POST | Refresh JWT access token |
| `/api/v1/auth/me` | GET | Get current user profile |
| `/api/v1/auth/logout` | POST | Logout and clear cookies |
| `/api/v1/users` | GET | List all users (admin) |
| `/api/v1/users/{id}` | DELETE | Delete user account |

### 📧 Email & Storage Service (Port 4002)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/auth/google` | GET | Get Gmail OAuth consent URL |
| `/auth/google/callback` | GET | Gmail OAuth callback |
| `/api/v1/email/fetch` | POST | Fetch emails and upload to Drive |
| `/api/v1/email/schedule` | POST | Schedule automatic email fetching |

### 🔍 OCR Extraction Service (Port 4003)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/ocr/extract` | POST | Extract text from PDF |
| `/api/invoice/extract` | POST | Extract structured invoice data |
| `/text-to-json` | POST | Convert text to JSON via Gemini |

### 📊 Google Sheets Analytics Service (Port 4004)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sheets/update` | POST | Add transaction to Google Sheets |
| `/api/v1/sheets/analytics` | GET | Get spending analytics |
| `/api/v1/sheets/export` | GET | Export data to CSV |

### 💬 Chat Service (Port 4005)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/knowledge/load` | POST | Load & index vendor knowledge |
| `/query` | GET | Query vendor knowledge (RAG) |
| `/delete-context` | DELETE | Clear vector database |
| `/graphql` | POST | GraphQL queries/mutations |

👉 **Full API Documentation:** Visit the Swagger/Flasgger docs for each service using the URLs listed in the Environment Setup section.

---

## 🧩 Example Flow

1️⃣ **User authenticates** → Connects Gmail via OAuth (or email/password login)  
2️⃣ **Email Service** fetches recent invoices → Detects vendor from sender  
3️⃣ **Drive upload** → Stores PDFs in `invoiceAutomation/<Vendor>/invoices`  
4️⃣ **OCR Service** extracts structured data → (vendor, date, amount, items)  
5️⃣ **Sheets Service** logs data → Updates analytics spreadsheet  
6️⃣ **Chatbot** answers queries → "What's my total spend with Amazon in Q1 2025?"  
7️⃣ **Scheduler** runs automatically → Fetches new invoices daily/hourly  
8️⃣ **Logging** tracks all operations → Audit trail for compliance

---

## 🎯 Implementation Highlights

### 🔒 Security Features
- **Helmet** middleware for security headers
- **Rate limiting** on auth and fetch endpoints
- **JWT authentication** with refresh tokens
- **OAuth 2.0** least-privilege scopes (gmail.readonly, drive.file)
- **Input validation** middleware (ObjectId, date formats, schema validation)
- **HTTP-only cookies** for token storage

### 📊 Data Management
- **Incremental sync** using `lastSyncedAt` timestamps
- **Vendor detection** from email sender with sanitization
- **Dynamic Gmail queries** with filters (vendor, date, file type)
- **Idempotent folder creation** in Google Drive
- **Structured data extraction** via Google Gemini API

### 🤖 AI/ML Features
- **Vector embeddings** for semantic search
- **RAG architecture** (Retrieval-Augmented Generation)
- **Google Gemini API** for intelligent text extraction
- **ChromaDB** for vector storage and similarity search

### 📅 Automation
- **Cron-based scheduler** (minute/hourly/daily/weekly)
- **Automatic backfill** for existing users
- **Duplicate job prevention**
- **Error handling and retry logic**

---

## 🧱 Code Quality & PR Guidelines

* Run lint before commits:

  ```bash
  npm run lint
  ```
* Keep PRs small and focused
* Use meaningful commit messages

  ```
  feat(email-storage): implement Gmail fetch API
  fix(ocr): correct date extraction logic
  ```
* PR title format:

  ```
  [ServiceName] Short Description
  ```

---

## 🔮 Future Enhancements

* 📦 Integration with Tally / QuickBooks
* 📊 Expense Trend Visualization Dashboard
* 🔐 Multi-Tenant SaaS Deployment
* 🧾 Automatic Payment Reminder Emails
* 🤖 GPT Fine-tuning for domain-specific invoice Q&A

---

## 🙌 Acknowledgments

* [Google Cloud APIs](https://console.cloud.google.com/apis/dashboard)
* [Google Gemini API](https://ai.google.dev/)
* [Swagger UI](https://swagger.io/tools/swagger-ui/)
* [Node.js](https://nodejs.org/)
* [Express.js](https://expressjs.com/)
* [FastAPI](https://fastapi.tiangolo.com/)
* [Flask](https://flask.palletsprojects.com/)

---

## 👥 Contributors

Thanks to all the amazing contributors 💙

<a href="https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1" />
</a>


<div align="center">

### 🌟 Empowering Businesses through Automation

Built with ❤️ by the **VendorIQ.AI** Team

</div>
