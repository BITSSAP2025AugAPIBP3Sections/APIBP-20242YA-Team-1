# Email Storage Service

## Overview
Email Storage Service connects a user’s Google account, fetches invoice email attachments from Gmail, and stores them in Google Drive organized by vendor. It exposes endpoints to start Google OAuth, receive the OAuth callback, and fetch/process emails. The service persists Google OAuth tokens and sync metadata in MongoDB.

## Architecture
- Node.js Express service
- MongoDB for user documents and token storage
- Google APIs (Gmail and Drive)
- Incremental sync using `lastSyncedAt`
- Vendor-wise foldering: `invoiceAutomation/<Vendor>/invoices`
- Swagger UI available at `/api-docs`

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

Request body example:
```
{
  "userId": "66fd0a3c8b1f4b2f7f0a1234",
  "fromDate": "2024-01-01",
  "schedule": "manual",
  "vendor": "Amazon",
  "email": "no-reply@amazon.in",
  "onlyPdf": true
}
```

Request body fields:
- `userId` required, MongoDB ObjectId of the user that completed OAuth in this service
- `fromDate` required, ISO date string used on first sync if `lastSyncedAt` is not set
- `schedule` either `manual` for immediate processing, or a schedule object if you enable cron-based processing
- `vendor` optional filter; when provided, only emails detected as that vendor are processed
- `email` optional sender filter; when provided, included in Gmail search query as `from:sender`
- `onlyPdf` optional boolean; when true, only PDFs are processed; when false, allows `pdf`, `jpg`, `jpeg`, `png`

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

## Processing Logic
- Query Gmail using a search string built from `after:<timestamp> has:attachment` plus filename filters and optional `from:` filter
- Retrieve each message and read the `From` header
- Detect vendor from the sender address
- If a vendor filter is provided, skip messages that do not match
- Download allowed attachments and upload to Drive under `invoiceAutomation/<Vendor>/invoices`
- Update `lastSyncedAt` after a successful run to enable incremental sync on later requests

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
