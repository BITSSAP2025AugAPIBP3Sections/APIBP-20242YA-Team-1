# Email Storage Service

## Overview

Email Storage Service connects a user's Google account, fetches invoice email attachments from Gmail, and stores them in Google Drive organized by vendor. It exposes endpoints to start Google OAuth, receive the OAuth callback, and fetch/process emails. The service persists Google OAuth tokens and sync metadata in MongoDB.

**🎯 Multi-Vendor Support:** Automatically detects and organizes invoices from popular vendors including Amazon, Flipkart, Zomato, Swiggy, Uber, and more. The intelligent vendor detection system analyzes email addresses and subject lines to accurately categorize invoices.

## Architecture
- Node.js Express service
- MongoDB for user documents and token storage
- Google APIs (Gmail and Drive)
- Incremental sync using `lastSyncedAt`

## Prerequisites
- Google Cloud project with OAuth 2.0 Client ID (Web application)
- Authorized redirect URI set to `http://localhost:4002/auth/google/callback`
- MongoDB connection string
- Node.js 18+

## Environment Setup
Create `email-storage-service/.env` with the following variables (example values shown for local use):

```
PORT=4002
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<dbName>
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
GOOGLE_REDIRECT_URI=http://localhost:4002/auth/google/callback
OCR_SERVICE_BASE_URL=http://localhost:4003
OCR_TRIGGER_TOKEN=<shared_secret>
LOG_LEVEL=info
```

Note: In production, encrypt and store secrets securely. Do not commit real secrets to source control.

## Installation
From the `backend/email-storage-service` directory:

```
npm install
```

## Run
```
npm run dev
```

On startup you should see logs confirming MongoDB connection and the Swagger URL.

## Run with Docker (prebuilt image)

- Pull the Docker Image
  - `docker pull gourav094/vendoriq-email-service:latest`
- Create `.env` from `env.example` and set values safely (do not commit secrets).
- Run the container:
  - `docker run --env-file .env -p 4002:4002 gourav094/vendoriq-email-service:latest`
- Verify:
  - Open `http://localhost:4002/health`
  - Swagger: `http://localhost:4002/api-docs`

Notes:
- Ensure `PORT=4002` (or map ports accordingly).
- Provide `MONGODB_URI`, `GOOGLE_*`, `JWT_*`, etc., in `.env`.
- For Compose, use the included `docker-compose.yaml` and run `docker compose up -d`.

## OAuth Flow
1. Call `GET http://localhost:4002/auth/google` to receive a JSON payload containing a `url` field.
2. Open the returned URL in a browser and complete Google consent.
3. Google redirects to `GET /auth/google/callback`; the service exchanges the code for tokens, queries Google userinfo, and upserts a User document for the returned email. It stores the Google refresh token and access token in MongoDB. If Google does not return a new refresh token, the service keeps the existing one.
4. A successful callback returns a JSON response with `message` and `email`.

Scopes requested:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/userinfo.email`
- `openid`

## Data Model
`User` document fields (relevant subset):
- `email` required and unique
- `googleRefreshToken` Google OAuth refresh token
- `googleAccessToken` Google OAuth access token
- `lastSyncedAt` Date of last successful sync for incremental fetching

## API Endpoints

Health check
- `GET /health`
  - Returns service status JSON

Get Google OAuth URL
- `GET /auth/google`
  - Returns a JSON object: `{ "url": "https://accounts.google.com/..." }`

Google OAuth callback
- `GET /auth/google/callback?code=...`
  - Exchanges the authorization code for tokens, fetches user email, and stores or updates the user document
  - Returns `{ "message": "Google account connected successfully!", "email": "user@example.com" }`

Fetch and process emails
- `POST /api/v1/email/fetch`
  - Processes Gmail messages with attachments and uploads allowed file types to Drive in vendor-wise folders
  - On success, updates `lastSyncedAt` to the current time for the user

Request body example (filtering options):
```javascript
// Option 1: Fetch all vendor emails
{
  "userId": "66fd0a3c8b1f4b2f7f0a1234",
  "fromDate": "2024-01-01",
  "schedule": "manual",
  "onlyPdf": true
}

// Option 2: Single vendor email
{
  "userId": "66fd0a3c8b1f4b2f7f0a1234",
  "fromDate": "2024-01-01",
  "email": "ship-confirm@amazon.in",
  "schedule": "manual"
}

// Option 3: Multiple vendor emails (comma-separated)
{
  "userId": "66fd0a3c8b1f4b2f7f0a1234",
  "fromDate": "2024-01-01",
  "email": "ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com",
  "schedule": "manual"
}
```

Request body fields:
- `userId` required, MongoDB ObjectId of the user that completed OAuth in this service
- `fromDate` required, ISO date string used on first sync if `lastSyncedAt` is not set
- `schedule` either `manual` for immediate processing, or a schedule object if you enable cron-based processing
- `email` **optional** sender filter; single or comma-separated multiple vendor emails. Gmail will search for emails from ANY of the specified addresses (OR logic)
- `onlyPdf` optional boolean; when true, only PDFs are processed; when false, allows `pdf`, `jpg`, `jpeg`, `png`

**Filtering Flexibility:**
- Omit `email` parameter to process all vendor emails
- Single email: `"email": "ship-confirm@amazon.in"`
- Multiple emails: `"email": "ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com"`
- Gmail uses OR logic: fetches emails from ANY of the specified addresses

Response example:
```
{
  "message": "Manual invoice fetch completed.",
  "filtersUsed": {
    "vendor": "Amazon",
    "email": "no-reply@amazon.in",
    "onlyPdf": true,
    "fromDate": "2024-01-01"
  },
  "result": {
    "totalProcessed": 12
  }
}
```

List vendor folders for a user
- `GET /api/v1/drive/users/:userId/vendors`
  - Returns every vendor folder detected under `invoiceAutomation` for the user’s Google Drive
  - Response payload: `{ "userId": "...", "total": 2, "vendors": [{ "id": "<folderId>", "name": "Amazon" }] }`

List invoices for a vendor folder
- `GET /api/v1/drive/users/:userId/vendors/:vendorId/invoices`
  - `vendorId` is the Drive folder ID returned from the vendor list endpoint
  - Returns `{ "userId": "...", "vendorFolderId": "...", "invoiceFolderId": "...", "total": 5, "invoices": [{ "id": "...", "name": "INV-001.pdf" }] }`

## Processing Logic
- Query Gmail using a search string built from `after:<timestamp> has:attachment` plus filename filters and optional `from:` filter
- Retrieve each message and read the `From` header and `Subject` line
- **Intelligent vendor detection:**
  - Checks known vendor patterns (Amazon, Flipkart, Zomato, etc.)
  - Analyzes email domain and username
  - Parses subject line for vendor keywords
  - Falls back to domain-based or username-based detection
- If a vendor filter is provided, skip messages that do not match
- Before uploading, query Drive for an existing file with the same name in the vendor's `invoices` folder to prevent duplicates
- Download allowed attachments and upload to Drive under `invoiceAutomation/<Vendor>/invoices`
- Update `lastSyncedAt` after a successful run to enable incremental sync on later requests

### Automated OCR Hand-off
- Each successful upload triggers a call to the OCR Extraction Service (`OCR_SERVICE_BASE_URL`)
- The service sends the Drive file IDs of newly uploaded invoices grouped by vendor
- OCR service extracts structured JSON, stores `master.json` per vendor folder, and pushes the consolidated file back to Drive without duplicating previous entries
- Failures during OCR trigger logging but do not interrupt email ingestion

### Vendor Detection Examples
| Email From | Subject | Detected Vendor |
|------------|---------|----------------|
| `ship-confirm@amazon.in` | Order Confirmation | **Amazon** |
| `noreply@flipkart.com` | Your Flipkart Order | **Flipkart** |
| `orders@zomato.com` | Order Receipt | **Zomato** |
| `auto-confirm@amazon.com` | - | **Amazon** |
| `hello@myntra.com` | - | **Flipkart** (Myntra is owned by Flipkart) |
| `orders@blinkit.com` | - | **Zomato** (Blinkit is owned by Zomato) |
| `user@gmail.com` | - | **User** (personal email) |
| `billing@acmecorp.com` | - | **Acmecorp** (business domain) |

## Drive Organization
- Root folder: `invoiceAutomation`
- Vendor folder: `invoiceAutomation/<Vendor>` where `Vendor` is a sanitized name from detection
- Invoices subfolder: `invoiceAutomation/<Vendor>/invoices`

## Logging
- A lightweight logger emits request logs and app logs
- Configure verbosity via `LOG_LEVEL` (`error`, `warn`, `info`, `debug`)
- In production (`NODE_ENV=production`) logs are JSON lines suitable for aggregation

## Security and Limits
- Security headers added via `helmet`; `x-powered-by` disabled
- Rate limiting applied on OAuth and API endpoints
- CORS enabled; configure allowed origins and credentials as needed
- Tokens are stored in MongoDB; in production consider encrypting refresh tokens at rest and adding OAuth `state` for CSRF protection

## Troubleshooting
- Redirect URI mismatch: ensure Google Console Authorized redirect URI exactly matches `GOOGLE_REDIRECT_URI`
- No Gmail connected: ensure the user completed OAuth and has a `googleRefreshToken` in MongoDB
- No files uploaded: check `onlyPdf` and ensure attachments exist and match the filters; confirm the Gmail search query is correct
- MongoDB connectivity: verify `MONGO_URI` and network access

## Development Notes
- Swagger UI is served at `/api-docs`
- The fetch endpoint currently accepts filters and implements vendor and sender filtering with support for PDF only or common image types
- To enforce authentication and ownership checks on the fetch endpoint, add a JWT middleware and validate that the token’s user matches the `userId` being requested

## License
This project inherits the repository’s license. See the root LICENSE if present.
