export const swaggerDocs = {
  openapi: "3.0.0",
  info: {
    title: "Email & Storage Service API",
    version: "1.0.0",
    description:
      "# Email & Storage Service API\n\nAutomated invoice management service that fetches email attachments from Gmail and organizes files in Google Drive.",
    contact: {
      name: "API Support Team",
      email: "support@example.com",
      url: "https://example.com/support"
    },
    license: {
      name: "MIT License",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      url: "http://localhost:4002",
      description: "Local development server",
    },
    {
      url: "https://api.example.com",
      description: "Production server",
    },
  ],
  tags: [
    { name: "System", description: "System health and service information endpoints" },
    { name: "Auth", description: "Google OAuth 2.0 authentication endpoints" },
    { name: "Email", description: "Email fetching and processing operations" },
    { name: "Drive", description: "Google Drive file and folder listing operations" },
    { name: "User", description: "User management and sync status operations" },
  ],
  paths: {
    "/": {
      get: {
        summary: "Service welcome endpoint",
        description: "Returns a welcome message for the Email Storage Service API",
        tags: ["System"],
        operationId: "getWelcome",
        responses: {
          200: {
            description: "Welcome message",
            content: {
              "text/html": {
                schema: {
                  type: "string",
                  example: "Welcome to the Email Storage Service API"
                }
              }
            }
          }
        }
      }
    },
    "/api-info": {
      get: {
        summary: "API information and available endpoints",
        description: "**Purpose:** Returns comprehensive information about the service, all available endpoints, and supported HTTP methods.\n\n**Use Cases:**\n- Service discovery and exploration\n- API documentation reference\n- Integration planning\n- Debugging and troubleshooting\n\n**Who Can Use:**\n- ✅ Frontend developers (React, Vue, Angular)\n- ✅ Mobile app developers (iOS, Android, Flutter)\n- ✅ Backend integration engineers\n- ✅ API consumers and third-party integrators\n- ✅ Public access - no authentication required\n\n**Request:** GET request, no parameters needed.\n\n**Response:** JSON object containing service metadata, categorized endpoint list, and HTTP methods.\n\n**Note:** This endpoint replaces OPTIONS / because CORS middleware intercepts OPTIONS requests for preflight checks.",
        tags: ["System"],
        operationId: "getApiInfo",
        responses: {
          200: {
            description: "Complete API information retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OptionsResponse" },
                example: {
                  service: "email-storage-service",
                  version: "1.0.0",
                  description: "Email & Storage Service API with Google OAuth, Gmail fetch, and Drive upload capabilities",
                  endpoints: {
                    system: ["GET /", "GET /health", "GET /api-info", "GET /api-docs"],
                    auth: ["GET /auth/google", "GET /auth/google/callback"],
                    email: ["POST /api/v1/email/fetch"],
                    drive: [
                      "GET /api/v1/drive/users/:userId/vendors",
                      "GET /api/v1/drive/users/:userId/vendors/:vendorId/invoices"
                    ],
                    user: [
                      "GET /api/v1/users/:userId/sync-status",
                      "DELETE /api/v1/users/:userId/sync-status"
                    ]
                  },
                  httpMethods: ["GET", "POST", "DELETE", "OPTIONS"],
                  documentation: "http://localhost:4002/api-docs"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      get: {
        summary: "Health check endpoint",
        description: "**Purpose:** Checks if the Email & Storage Service is running and operational.\n\n**Use Case:** Service monitoring, health checks, load balancer probes.\n\n**Who Can Use:**\n- ✅ Monitoring tools (Prometheus, Datadog, New Relic)\n- ✅ Load balancers (AWS ALB, Nginx, HAProxy)\n- ✅ DevOps automation scripts\n- ✅ CI/CD pipelines\n- ✅ Public access - no authentication required\n\n**Request:** No parameters required.\n\n**Response:** JSON object with service status.",
        tags: ["System"],
        operationId: "healthCheck",
        responses: {
          200: {
            description: "Service is healthy and operational",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "OK", description: "Service health status" },
                    service: { type: "string", example: "email-storage-service", description: "Service identifier" },
                  },
                  required: ["status", "service"]
                },
                example: {
                  status: "OK",
                  service: "email-storage-service"
                }
              },
            },
          },
        },
      },
    },

    "/auth/google": {
      get: {
        summary: "Initiate Google OAuth 2.0 flow",
        description: "**Purpose:** Generates and returns a Google OAuth 2.0 consent URL for user authorization.\n\n**Who Can Use:**\n- ✅ Frontend web applications (React, Vue, Angular dashboards)\n- ✅ Mobile applications (iOS, Android, React Native, Flutter)\n- ✅ Desktop applications with web view\n- ✅ Backend services initiating OAuth on behalf of users\n- ✅ Any client needing Gmail and Drive access for users\n- ✅ Public access - no authentication required (step 1 of OAuth)\n\n**Authentication Flow:**\n1. Call this endpoint to get the OAuth URL\n2. Redirect user to the returned URL\n3. User grants permissions on Google\n4. Google redirects to `/auth/google/callback` with authorization code\n\n**Required Scopes:**\n- `gmail.readonly` - Read Gmail messages\n- `drive.file` - Create/manage Drive files\n- `userinfo.email` - Access user email\n- `openid` - OpenID Connect authentication\n\n**Request:** GET request, no parameters needed.\n\n**Response:** JSON object containing the OAuth consent URL.\n\n**Example Usage:**\n```javascript\nfetch('http://localhost:4002/auth/google')\n  .then(res => res.json())\n  .then(data => window.location.href = data.url);\n```",
        tags: ["Auth"],
        operationId: "getGoogleAuthUrl",
        responses: {
          200: {
            description: "OAuth consent URL generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { 
                    url: { 
                      type: "string", 
                      format: "uri",
                      description: "Google OAuth 2.0 consent page URL",
                      example: "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
                    } 
                  },
                  required: ["url"]
                },
              },
            },
          },
        },
      },
    },
    "/auth/google/callback": {
      get: {
        summary: "Google OAuth 2.0 callback handler",
        description: "**Purpose:** Receives authorization code from Google and exchanges it for access/refresh tokens.\n\n**Who Can Use:**\n- 🔒 Google OAuth system only (automatic redirect)\n- ⚠️ Do NOT call this endpoint directly from your application\n- This is configured as the redirect URI in Google Cloud Console\n- After user consent, Google automatically redirects here\n\n**Integration Note:** Your application should handle the redirect after this endpoint completes. Store the returned email/userId in your session/local storage for subsequent API calls.\n\n**Flow:**\n1. Google redirects here after user grants permissions\n2. Service exchanges authorization code for tokens\n3. Service fetches user email from Google\n4. User record is created/updated in MongoDB with tokens\n5. Existing refresh token is preserved if Google doesn't return a new one\n\n**Request:** GET request with `code` query parameter (provided by Google).\n\n**Response:** JSON object confirming successful connection.\n\n**Security Note:** The refresh token is stored securely in MongoDB and used for subsequent API calls without requiring user re-authentication.",
        tags: ["Auth"],
        operationId: "googleOAuthCallback",
        parameters: [
          { 
            in: "query", 
            name: "code", 
            required: true, 
            schema: { type: "string" },
            description: "Authorization code provided by Google OAuth",
            example: "4/0AY0e-g7xxxxxxxxxxxxxxxxxxxxxxxxxxx"
          },
        ],
        responses: {
          200: { 
            description: "Google account connected successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Google account connected successfully!" },
                    email: { type: "string", format: "email", example: "user@example.com" }
                  },
                  required: ["message", "email"]
                }
              }
            }
          },
          400: { 
            description: "Bad request - Invalid or missing authorization code",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          500: { 
            description: "OAuth exchange failed - Unable to exchange code for tokens",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
        },
      },
    },

    "/api/v1/email/fetch": {
      post: {
        summary: "Fetch and process invoice emails from Gmail",
        description:
          "**Purpose:** Fetches Gmail messages with attachments, extracts invoice files, detects vendor, and uploads to Google Drive.\n\n**Who Can Use:**\n- ✅ Frontend dashboards (invoice management UIs)\n- ✅ Mobile applications (business expense trackers)\n- ✅ Backend automation services (scheduled invoice collection)\n- ✅ Integration platforms (Zapier, Make.com workflows)\n- ✅ ETL pipelines for accounting systems\n- 🔒 **Requires:** Valid `userId` (MongoDB ObjectId) obtained after OAuth\n- 🔒 **Requires:** User must have completed Google OAuth flow\n- ⚠️ **Rate Limited:** 30 requests per 15 minutes per IP\n\n**Common Consumer Scenarios:**\n1. **React Dashboard:** User clicks \"Sync Invoices\" button → calls this endpoint\n2. **Cron Job:** Nightly batch job fetches invoices for all users\n3. **Mobile App:** Background service syncs invoices when app opens\n4. **Zapier Integration:** Trigger action calls this to fetch new invoices\n\n**How It Works:**\n1. Authenticates with Gmail using user's refresh token\n2. Searches for emails with attachments after `fromDate` or `lastSyncedAt`\n3. Downloads PDF/image attachments from matching emails\n4. Detects vendor name from sender email address\n5. Uploads files to Drive: `invoiceAutomation/<Vendor>/invoices/`\n6. Updates user's `lastSyncedAt` timestamp\n\n**Smart Sync Behavior:**\n- **First fetch:** Uses `fromDate` parameter\n- **Subsequent fetches:** Uses `lastSyncedAt` (last successful sync) to avoid duplicates\n- **To re-fetch old emails:** Use GET `/api/v1/users/{userId}/sync-status` and DELETE to reset\n\n**Filtering Options:**\n1. **All vendor emails:** Omit the `email` parameter to process all invoice emails\n2. **Single vendor:** Set `email` to one address (e.g., \"ship-confirm@amazon.in\")\n3. **Multiple vendors:** Set `email` to comma-separated addresses (e.g., \"ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com\")\n\n**Request Body:**\n- `userId` (required): MongoDB ObjectId\n- `fromDate` (required): ISO date string (YYYY-MM-DD)\n- `email` (optional): Single or comma-separated multiple vendor emails (Gmail OR logic)\n- `onlyPdf` (optional, default: true): Process only PDFs or include JPG/PNG\n- `schedule` (optional, default: 'manual'): 'manual' or cron schedule object\n\n**Response:** Summary of emails processed and files uploaded.\n\n**Rate Limiting:** 30 requests per 15 minutes.",
        tags: ["Email"],
        operationId: "fetchEmails",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EmailFetchRequest" },
              examples: {
                allVendors: {
                  summary: "Option 1: All vendor emails from date",
                  description: "Fetch invoices from all vendor emails after the specified date",
                  value: {
                    userId: "690c7d0ee107fb31784c1b1b",
                    fromDate: "2024-01-01",
                    onlyPdf: true,
                    schedule: "manual",
                  },
                },
                amazonEmail: {
                  summary: "Option 2: Amazon emails only",
                  description: "Fetch invoices only from Amazon email addresses",
                  value: {
                    userId: "690c7d0ee107fb31784c1b1b",
                    fromDate: "2024-01-01",
                    email: "ship-confirm@amazon.in",
                    onlyPdf: true,
                    schedule: "manual",
                  },
                },
                zomatoEmail: {
                  summary: "Option 3: Zomato emails only",
                  description: "Fetch invoices only from Zomato email addresses",
                  value: {
                    userId: "690c7d0ee107fb31784c1b1b",
                    fromDate: "2024-01-01",
                    email: "orders@zomato.com",
                    onlyPdf: true,
                    schedule: "manual",
                  },
                },
                multipleVendors: {
                  summary: "Option 4: Multiple vendors (comma-separated)",
                  description: "Fetch invoices from Amazon, Zomato, and Flipkart simultaneously",
                  value: {
                    userId: "690c7d0ee107fb31784c1b1b",
                    fromDate: "2024-01-01",
                    email: "ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com",
                    onlyPdf: true,
                    schedule: "manual",
                  },
                },
                autoDaily: {
                  summary: "Schedule auto fetch daily",
                  description: "Automated daily fetch from Flipkart",
                  value: {
                    userId: "690c7d0ee107fb31784c1b1b",
                    fromDate: "2024-01-01",
                    email: "noreply@flipkart.com",
                    schedule: { type: "auto", frequency: "daily" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Fetch completed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmailFetchResponse" },
                example: {
                  message: "Manual invoice fetch completed.",
                  filtersUsed: {
                    email: "ship-confirm@amazon.in",
                    onlyPdf: true,
                    fromDate: "2024-01-01"
                  },
                  result: {
                    totalProcessed: 25,
                    filesUploaded: 25
                  }
                }
              },
            },
          },
          400: { 
            description: "Bad request - Missing required fields (userId, fromDate) or invalid schedule format",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "userId and fromDate are required."
                }
              }
            }
          },
          404: { 
            description: "User not found in database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User not found"
                }
              }
            }
          },
          500: { 
            description: "Server error - Failed to fetch emails or upload to Drive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "Failed to fetch emails.",
                  error: "No Gmail connected"
                }
              }
            }
          },
        },
      },
    },
    "/api/v1/drive/users/{userId}/vendors": {
      get: {
        summary: "List all vendor folders",
        description:
          "**Purpose:** Retrieves a list of all vendor folders created in the user's Google Drive.\n\n**Who Can Use:**\n- ✅ Frontend applications (display vendor dropdown/list)\n- ✅ Mobile apps (vendor selection screen)\n- ✅ Analytics dashboards (vendor activity monitoring)\n- ✅ Reporting tools (vendor count metrics)\n- ✅ Backend services (vendor data aggregation)\n- 🔒 **Requires:** Valid `userId` path parameter\n- 🔒 **Requires:** User must have completed OAuth and have Drive access\n\n**Common Consumer Scenarios:**\n1. **Invoice Dashboard:** Load vendor list for filter dropdown\n2. **Analytics App:** Count unique vendors over time\n3. **Mobile App:** Display vendor cards with invoice counts\n4. **Reporting Service:** Export vendor list to CSV/Excel\n\n**How It Works:**\n1. Authenticates with Google Drive using user's refresh token\n2. Locates the root `invoiceAutomation` folder\n3. Lists all subfolders (each represents a detected vendor)\n4. Returns folder metadata including Drive IDs, names, and timestamps\n\n**Use Cases:**\n- Display vendor list in frontend dropdown\n- Get vendor folder IDs for invoice listing\n- Monitor which vendors have been processed\n\n**Request:**\n- **Method:** GET\n- **Path Parameter:** `userId` (MongoDB ObjectId)\n- **Authentication:** Uses stored Google refresh token\n\n**Response:**\n- Array of vendor folders with Drive IDs and metadata\n- Total count of vendors\n- Folders ordered alphabetically by name\n\n**Error Scenarios:**\n- User not found (404)\n- No Google connection (400)\n- Drive API errors (500)",
        tags: ["Drive"],
        operationId: "listVendors",
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
            description: "MongoDB ObjectId of the user (24-character hex string)",
            example: "690c7d0ee107fb31784c1b1b"
          },
        ],
        responses: {
          200: {
            description: "Vendor list retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VendorListResponse" },
                example: {
                  userId: "690c7d0ee107fb31784c1b1b",
                  total: 3,
                  vendors: [
                    {
                      id: "1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp",
                      name: "Amazon",
                      createdTime: "2024-11-15T10:30:00.000Z",
                      modifiedTime: "2024-11-18T14:20:00.000Z"
                    },
                    {
                      id: "2ABCDefgh4TSrhLWil_y3JY4ttlZQCaOp",
                      name: "Flipkart",
                      createdTime: "2024-10-20T08:15:00.000Z",
                      modifiedTime: "2024-11-10T16:45:00.000Z"
                    }
                  ]
                }
              },
            },
          },
          400: { 
            description: "User has not connected Google Drive/Gmail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User has not connected Google Drive/Gmail yet"
                }
              }
            }
          },
          404: { 
            description: "User not found in database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User not found"
                }
              }
            }
          },
          500: { 
            description: "Server error - Failed to access Google Drive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "Failed to retrieve vendor folders",
                  error: "Drive API rate limit exceeded"
                }
              }
            }
          },
        },
      },
    },
    "/api/v1/drive/users/{userId}/vendors/{vendorId}/invoices": {
      get: {
        summary: "List invoices for a specific vendor",
        description:
          "**Purpose:** Retrieves all invoice files stored in a vendor's invoices subfolder on Google Drive.\n\n**Who Can Use:**\n- ✅ Frontend invoice viewers (display invoice gallery/table)\n- ✅ Mobile apps (invoice detail screens)\n- ✅ Download managers (batch PDF downloads)\n- ✅ OCR processing services (extract text from invoices)\n- ✅ Accounting integrations (sync invoices to QuickBooks/Xero)\n- ✅ AI/ML pipelines (invoice data extraction)\n- 🔒 **Requires:** Valid `userId` and `vendorId` path parameters\n- 🔒 **Requires:** User must have completed OAuth and have Drive access\n\n**Common Consumer Scenarios:**\n1. **Invoice Table:** User clicks vendor → loads invoice list with thumbnails\n2. **Mobile App:** Display invoices as swipeable cards with preview\n3. **OCR Service:** Fetch all invoices → process via OCR API → extract data\n4. **Accounting Sync:** Nightly job downloads new invoices → pushes to QuickBooks\n5. **AI Training:** Batch download invoices for ML model training\n\n**How It Works:**\n1. Authenticates with Google Drive using user's refresh token\n2. Locates the vendor folder by `vendorId`\n3. Finds the `invoices` subfolder within the vendor folder\n4. Lists all files (PDFs, images) in the invoices folder\n5. Returns file metadata including Drive IDs, sizes, and download links\n\n**Drive Structure:**\n```\ninvoiceAutomation/\n  └── {Vendor}/              ← vendorId points here\n      └── invoices/          ← Files listed from here\n          ├── invoice_001.pdf\n          ├── invoice_002.pdf\n          └── receipt_003.jpg\n```\n\n**Use Cases:**\n- Display invoice list for a specific vendor\n- Download invoice files via `webContentLink`\n- View invoice files via `webViewLink`\n- Track invoice counts per vendor\n\n**Request:**\n- **Method:** GET\n- **Path Parameters:**\n  - `userId`: MongoDB ObjectId\n  - `vendorId`: Google Drive folder ID (from vendor list endpoint)\n- **Authentication:** Uses stored Google refresh token\n\n**Response:**\n- Array of invoice files with metadata\n- Total count of invoices\n- Drive folder IDs for vendor and invoices subfolder\n- Files ordered alphabetically by name\n\n**Error Scenarios:**\n- User not found (404)\n- No Google connection (400)\n- Vendor folder not found (returns empty array)\n- Drive API errors (500)",
        tags: ["Drive"],
        operationId: "listInvoices",
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
            description: "MongoDB ObjectId of the user (24-character hex string)",
            example: "690c7d0ee107fb31784c1b1b"
          },
          {
            in: "path",
            name: "vendorId",
            required: true,
            schema: { type: "string" },
            description: "Google Drive folder ID of the vendor (obtained from vendor list endpoint)",
            example: "1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp"
          },
        ],
        responses: {
          200: {
            description: "Invoice list retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvoiceListResponse" },
                example: {
                  userId: "690c7d0ee107fb31784c1b1b",
                  vendorFolderId: "1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp",
                  invoiceFolderId: "3XYZabcde5TSrhLWil_y3JY4ttlZQCaOp",
                  total: 25,
                  invoices: [
                    {
                      id: "4PDFfile67TSrhLWil_y3JY4ttlZQCaOp",
                      name: "invoice_amazon_2024_001.pdf",
                      mimeType: "application/pdf",
                      size: 245678,
                      createdTime: "2024-11-15T10:35:00.000Z",
                      modifiedTime: "2024-11-15T10:35:00.000Z",
                      webViewLink: "https://drive.google.com/file/d/4PDFfile67TSrhLWil_y3JY4ttlZQCaOp/view",
                      webContentLink: "https://drive.google.com/uc?id=4PDFfile67TSrhLWil_y3JY4ttlZQCaOp&export=download"
                    }
                  ]
                }
              },
            },
          },
          400: { 
            description: "Bad request - User has not connected Google Drive or missing parameters",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User has not connected Google Drive/Gmail yet"
                }
              }
            }
          },
          404: { 
            description: "User not found in database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User not found"
                }
              }
            }
          },
          500: { 
            description: "Server error - Failed to access Google Drive",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "Failed to retrieve invoices",
                  error: "Invalid vendor folder ID"
                }
              }
            }
          },
        },
      },
    },
    "/api/v1/users/{userId}/sync-status": {
      get: {
        summary: "Get user's email sync status",
        description:
          "**Purpose:** Retrieves the user's last successful email sync timestamp and connection status.\n\n**Who Can Use:**\n- ✅ Frontend dashboards (display last sync time in UI)\n- ✅ Mobile apps (show sync status badge)\n- ✅ Admin panels (monitor user sync health)\n- ✅ Support tools (troubleshoot sync issues)\n- ✅ Automation scripts (check sync before processing)\n- 🔒 **Requires:** Valid `userId` path parameter\n\n**Common Consumer Scenarios:**\n1. **Dashboard UI:** Show \"Last synced: 2 hours ago\" badge\n2. **Troubleshooting:** User reports missing invoices → check sync status\n3. **Admin Panel:** List all users with sync issues (lastSyncedAt > 7 days)\n4. **Mobile App:** Display sync indicator before manual refresh\n\n**Why This Matters:**\nThe email fetch endpoint uses incremental sync - it only fetches emails AFTER the `lastSyncedAt` timestamp to avoid duplicates. If you're not seeing emails, this endpoint explains why.\n\n**Use Cases:**\n- Diagnose why emails aren't being fetched\n- Check if user has completed Google OAuth\n- Determine the date range for next email fetch\n- Display last sync time in UI\n\n**Request:**\n- **Method:** GET\n- **Path Parameter:** `userId` (MongoDB ObjectId)\n\n**Response:**\n- User email address\n- Last sync timestamp (or null if never synced)\n- Google connection status\n- Helpful message explaining sync behavior\n\n**Example Workflow:**\n```\n1. Call this endpoint before fetching emails\n2. If lastSyncedAt is recent, only new emails will be fetched\n3. If you need to re-fetch old emails, call DELETE on this endpoint first\n```",
        tags: ["User"],
        operationId: "getUserSyncStatus",
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
            description: "MongoDB ObjectId of the user (24-character hex string)",
            example: "690c7d0ee107fb31784c1b1b"
          },
        ],
        responses: {
          200: {
            description: "Sync status retrieved successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SyncStatusResponse" },
                example: {
                  userId: "690c7d0ee107fb31784c1b1b",
                  email: "user@example.com",
                  lastSyncedAt: "2025-11-18T19:24:34.602Z",
                  hasGoogleConnection: true,
                  message: "User last synced on 2025-11-18T19:24:34.602Z. Next fetch will only get emails after this date unless forceSync=true is set."
                }
              },
            },
          },
          404: { 
            description: "User not found in database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User not found"
                }
              }
            }
          },
          500: { 
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "Failed to retrieve sync status",
                  error: "Database connection failed"
                }
              }
            }
          },
        },
      },
      delete: {
        summary: "Reset user's email sync status",
        description:
          "**Purpose:** Clears the user's `lastSyncedAt` timestamp to enable re-fetching all historical emails.\n\n**Who Can Use:**\n- ✅ Admin panels (reset user sync as support action)\n- ✅ Testing/QA tools (reset for test scenarios)\n- ✅ User settings pages (\"Re-sync all invoices\" button)\n- ✅ Backend maintenance scripts (bulk reset for data migration)\n- 🔒 **Requires:** Valid `userId` path parameter\n- ⚠️ **Use with caution:** Can cause duplicate files in Drive\n\n**Common Consumer Scenarios:**\n1. **Admin Support:** User reports missing invoices → support resets sync → user fetches again\n2. **Testing:** QA engineer resets sync between test runs\n3. **User Action:** User clicks \"Re-sync all historical invoices\" in settings\n4. **Data Migration:** Backend script resets all users during system upgrade\n\n**When To Use:**\n- Initial setup completed, now want to fetch all historical emails\n- Sync got out of sync and need to start fresh\n- Testing email fetch with old data\n- User requests to re-import all invoices\n\n**What Happens:**\n1. Sets user's `lastSyncedAt` to `null` in MongoDB\n2. Next email fetch will use the `fromDate` parameter instead\n3. All emails after `fromDate` will be processed (even if already fetched before)\n\n**⚠️ Warning:**\nThis will cause duplicate files in Drive if emails were already processed. Consider:\n1. Manually cleaning up Drive folders first, OR\n2. Using a new/different user account for testing\n\n**Request:**\n- **Method:** DELETE\n- **Path Parameter:** `userId` (MongoDB ObjectId)\n\n**Response:**\n- Confirmation message\n- User ID\n\n**Alternative:** Instead of resetting permanently, you can also check the current sync status first and decide if reset is needed.",
        tags: ["User"],
        operationId: "resetUserSyncStatus",
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
            description: "MongoDB ObjectId of the user (24-character hex string)",
            example: "690c7d0ee107fb31784c1b1b"
          },
        ],
        responses: {
          200: {
            description: "Sync status reset successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { 
                      type: "string",
                      example: "Sync status reset successfully. Next fetch will use the fromDate parameter."
                    },
                    userId: { 
                      type: "string",
                      example: "690c7d0ee107fb31784c1b1b"
                    },
                  },
                  required: ["message", "userId"]
                },
                example: {
                  message: "Sync status reset successfully. Next fetch will use the fromDate parameter.",
                  userId: "690c7d0ee107fb31784c1b1b"
                }
              },
            },
          },
          404: { 
            description: "User not found in database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "User not found"
                }
              }
            }
          },
          500: { 
            description: "Server error - Failed to update database",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  message: "Failed to reset sync status",
                  error: "Database write operation failed"
                }
              }
            }
          },
        },
      },
    },
  },
  components: {
    schemas: {
      OptionsResponse: {
        type: "object",
        properties: {
          service: { type: "string", example: "email-storage-service" },
          version: { type: "string", example: "1.0.0" },
          endpoints: {
            type: "object",
            properties: {
              system: {
                type: "array",
                items: { type: "string" },
                example: ["GET /", "GET /health", "OPTIONS /"]
              },
              auth: {
                type: "array",
                items: { type: "string" },
                example: ["GET /auth/google", "GET /auth/google/callback"]
              },
              email: {
                type: "array",
                items: { type: "string" },
                example: ["POST /api/v1/email/fetch"]
              },
              drive: {
                type: "array",
                items: { type: "string" },
                example: [
                  "GET /api/v1/drive/users/:userId/vendors",
                  "GET /api/v1/drive/users/:userId/vendors/:vendorId/invoices"
                ]
              },
              user: {
                type: "array",
                items: { type: "string" },
                example: [
                  "GET /api/v1/users/:userId/sync-status",
                  "DELETE /api/v1/users/:userId/sync-status"
                ]
              }
            }
          },
          httpMethods: {
            type: "array",
            items: { type: "string" },
            example: ["GET", "POST", "DELETE", "OPTIONS"]
          }
        }
      },
      EmailFetchRequest: {
        type: "object",
        required: ["userId", "fromDate"],
        properties: {
          userId: { 
            type: "string",
            pattern: "^[a-f0-9]{24}$",
            description: "MongoDB ObjectId of the user (24-character hex string)",
            example: "690c7d0ee107fb31784c1b1b"
          },
          fromDate: { 
            type: "string",
            format: "date",
            description: "Start date for email search in YYYY-MM-DD format. Used only on first fetch or after sync reset.",
            example: "2024-01-01"
          },
          email: { 
            type: "string",
            nullable: true,
            description: "Optional vendor email filter. Supports single email or comma-separated multiple emails. Gmail will search for emails from ANY of the specified senders (OR logic). Examples: 'ship-confirm@amazon.in' or 'ship-confirm@amazon.in,orders@zomato.com,noreply@flipkart.com'",
            example: "ship-confirm@amazon.in,orders@zomato.com"
          },
          onlyPdf: { 
            type: "boolean",
            default: true,
            description: "File type filter. If true, only PDF attachments are processed. If false, includes PDF, JPG, JPEG, and PNG files.",
            example: true
          },
          schedule: {
            description: "Execution mode. Use 'manual' for immediate one-time fetch, or provide schedule object for automated recurring fetches.",
            oneOf: [
              { type: "string", enum: ["manual"], example: "manual" },
              {
                type: "object",
                required: ["type", "frequency"],
                properties: {
                  type: { type: "string", enum: ["auto"], description: "Must be 'auto' for scheduled fetches" },
                  frequency: { 
                    type: "string",
                    enum: ["hourly", "daily", "weekly", "minute"],
                    description: "How often to run the automated fetch"
                  },
                },
                example: { type: "auto", frequency: "daily" }
              },
            ],
          },
        },
      },
      VendorListResponse: {
        type: "object",
        required: ["userId", "total", "vendors"],
        properties: {
          userId: { 
            type: "string",
            description: "MongoDB ObjectId of the user",
            example: "690c7d0ee107fb31784c1b1b"
          },
          total: { 
            type: "integer",
            description: "Total number of vendor folders found",
            example: 3
          },
          vendors: {
            type: "array",
            description: "Array of vendor folders, ordered alphabetically by name",
            items: {
              type: "object",
              required: ["id", "name"],
              properties: {
                id: { 
                  type: "string",
                  description: "Google Drive folder ID (use this to fetch invoices)",
                  example: "1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp"
                },
                name: { 
                  type: "string",
                  description: "Vendor name (detected from email addresses)",
                  example: "Amazon"
                },
                createdTime: { 
                  type: "string",
                  format: "date-time",
                  description: "Timestamp when the folder was first created in Drive",
                  example: "2024-11-15T10:30:00.000Z"
                },
                modifiedTime: { 
                  type: "string",
                  format: "date-time",
                  description: "Timestamp when the folder was last modified",
                  example: "2024-11-18T14:20:00.000Z"
                },
              },
            },
          },
        },
      },
      InvoiceListResponse: {
        type: "object",
        required: ["userId", "vendorFolderId", "total", "invoices"],
        properties: {
          userId: { 
            type: "string",
            description: "MongoDB ObjectId of the user",
            example: "690c7d0ee107fb31784c1b1b"
          },
          vendorFolderId: { 
            type: "string",
            description: "Google Drive folder ID of the vendor (from path parameter)",
            example: "1MNDIrzwi3TSrhLWil_y3JY4ttlZQCaOp"
          },
          invoiceFolderId: { 
            type: "string",
            nullable: true,
            description: "Google Drive folder ID of the invoices subfolder. Null if subfolder doesn't exist yet.",
            example: "3XYZabcde5TSrhLWil_y3JY4ttlZQCaOp"
          },
          total: { 
            type: "integer",
            description: "Total number of invoice files found",
            example: 25
          },
          invoices: {
            type: "array",
            description: "Array of invoice files, ordered alphabetically by filename",
            items: {
              type: "object",
              required: ["id", "name", "mimeType"],
              properties: {
                id: { 
                  type: "string",
                  description: "Google Drive file ID (unique identifier)",
                  example: "4PDFfile67TSrhLWil_y3JY4ttlZQCaOp"
                },
                name: { 
                  type: "string",
                  description: "Original filename from the email attachment",
                  example: "invoice_amazon_2024_001.pdf"
                },
                mimeType: { 
                  type: "string",
                  description: "MIME type of the file",
                  enum: ["application/pdf", "image/jpeg", "image/png"],
                  example: "application/pdf"
                },
                size: { 
                  type: "integer",
                  nullable: true,
                  description: "File size in bytes (null if unavailable)",
                  example: 245678
                },
                createdTime: { 
                  type: "string",
                  format: "date-time",
                  description: "Timestamp when the file was uploaded to Drive",
                  example: "2024-11-15T10:35:00.000Z"
                },
                modifiedTime: { 
                  type: "string",
                  format: "date-time",
                  description: "Timestamp when the file was last modified",
                  example: "2024-11-15T10:35:00.000Z"
                },
                webViewLink: { 
                  type: "string",
                  format: "uri",
                  nullable: true,
                  description: "Direct link to view the file in Google Drive web interface",
                  example: "https://drive.google.com/file/d/4PDFfile67TSrhLWil_y3JY4ttlZQCaOp/view"
                },
                webContentLink: { 
                  type: "string",
                  format: "uri",
                  nullable: true,
                  description: "Direct download link for the file",
                  example: "https://drive.google.com/uc?id=4PDFfile67TSrhLWil_y3JY4ttlZQCaOp&export=download"
                },
              },
            },
          },
        },
      },
      SyncStatusResponse: {
        type: "object",
        required: ["userId", "email", "hasGoogleConnection", "message"],
        properties: {
          userId: { 
            type: "string",
            description: "MongoDB ObjectId of the user",
            example: "690c7d0ee107fb31784c1b1b"
          },
          email: { 
            type: "string",
            format: "email",
            description: "User's Google account email address",
            example: "user@example.com"
          },
          lastSyncedAt: { 
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Timestamp of last successful email fetch. If null, user has never synced. If set, next fetch will only retrieve emails after this timestamp to avoid duplicates.",
            example: "2025-11-18T19:24:34.602Z"
          },
          hasGoogleConnection: { 
            type: "boolean",
            description: "Indicates whether user has completed Google OAuth and has a valid refresh token stored",
            example: true
          },
          message: { 
            type: "string",
            description: "Human-readable explanation of the sync status and next fetch behavior",
            example: "User last synced on 2025-11-18T19:24:34.602Z. Next fetch will only get emails after this date unless forceSync=true is set."
          },
        },
      },
      EmailFetchResponse: {
        type: "object",
        required: ["message", "result"],
        properties: {
          message: { 
            type: "string",
            description: "Human-readable status message",
            example: "Manual invoice fetch completed."
          },
          result: {
            type: "object",
            required: ["totalProcessed"],
            properties: {
              totalProcessed: { 
                type: "integer",
                description: "Number of Gmail messages that matched the search criteria",
                example: 25
              },
              filesUploaded: {
                type: "integer",
                description: "Number of invoice files successfully uploaded to Google Drive",
                example: 25
              }
            },
          },
          filtersUsed: {
            type: "object",
            nullable: true,
            description: "Echo of the filters applied during this fetch operation",
            properties: {
              email: { 
                type: "string",
                format: "email",
                nullable: true,
                description: "Vendor email filter used (null if not specified)",
                example: "ship-confirm@amazon.in"
              },
              onlyPdf: { 
                type: "boolean",
                description: "File type filter applied",
                example: true
              },
              fromDate: { 
                type: "string",
                format: "date",
                description: "Date range start parameter",
                example: "2024-01-01"
              },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          googleAccessToken: { type: "string", nullable: true },
          googleRefreshToken: { type: "string", nullable: true },
          lastSyncedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
    },
  },
};
