export const swaggerDocs = {
  openapi: "3.0.0",
  info: {
    title: "Email & Storage Service API",
    version: "1.0.0",
    description:
      "Service that connects Gmail via OAuth, fetches invoice attachments, detects vendor, and stores files in Google Drive under invoiceAutomation/<Vendor>/invoices.",
  },
  servers: [
    {
      url: "http://localhost:4002",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Email" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check for Email & Storage Service",
        tags: ["System"],
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "OK" },
                    service: { type: "string", example: "email-storage-service" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Auth (mounted under /api/v1 and also with root aliases)
    "/auth/google": {
      get: {
        summary: "Get Google OAuth consent URL",
        tags: ["Auth"],
        responses: {
          200: {
            description: "OAuth consent URL returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { url: { type: "string", format: "uri" } },
                },
              },
            },
          },
        },
      },
    },
    "/auth/google/callback": {
      get: {
        summary: "Google OAuth callback",
        tags: ["Auth"],
        parameters: [
          { in: "query", name: "code", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Account connected" },
          400: { description: "Bad request" },
          500: { description: "OAuth exchange failed" },
        },
      },
    },

    "/api/v1/email/fetch": {
      post: {
        summary: "Fetch emails and upload invoice PDFs to Google Drive",
        description:
          "Fetches Gmail messages with attachments after a given date (or the user's lastSyncedAt), detects vendor from the From header, and uploads PDF attachments into Drive under invoiceAutomation/<Vendor>/invoices. Updates lastSyncedAt on success.",
        tags: ["Email"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EmailFetchRequest" },
              examples: {
                manual: {
                  summary: "Manual fetch",
                  value: {
                    userId: "66fd0a3c8b1f4b2f7f0a1234",
                    fromDate: "2024-01-01",
                    vendor: "Amazon",
                    onlyPdf: true,
                    schedule: "manual",
                  },
                },
                autoDaily: {
                  summary: "Schedule auto fetch daily",
                  value: {
                    userId: "66fd0a3c8b1f4b2f7f0a1234",
                    fromDate: "2024-01-01",
                    vendor: "Flipkart",
                    schedule: { type: "auto", frequency: "daily" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Fetch completed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmailFetchResponse" },
              },
            },
          },
          400: { description: "Missing required fields or invalid schedule" },
          401: { description: "User not connected to Gmail" },
          500: { description: "Server error while fetching emails" },
        },
      },
    },
  },
  components: {
    schemas: {
      EmailFetchRequest: {
        type: "object",
        required: ["userId", "fromDate", "vendor"],
        properties: {
          userId: { type: "string", description: "MongoDB ObjectId of the user" },
          fromDate: { type: "string", format: "date", description: "YYYY-MM-DD (used only if lastSyncedAt is null)" },
          vendor: { type: "string", description: "Vendor filter (required by current controller)" },
          email: { type: "string", format: "email", nullable: true, description: "Optional sender email filter (not enforced server-side in current implementation)" },
          onlyPdf: { type: "boolean", default: true, description: "If true, only PDF attachments are processed" },
          schedule: {
            description: "Either 'manual' or an object describing auto schedule",
            oneOf: [
              { type: "string", enum: ["manual"] },
              {
                type: "object",
                required: ["type", "frequency"],
                properties: {
                  type: { type: "string", enum: ["auto"] },
                  frequency: { type: "string", enum: ["hourly", "daily", "weekly", "minute"] },
                },
              },
            ],
          },
        },
      },
      EmailFetchResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Manual invoice fetch completed." },
          result: {
            type: "object",
            properties: {
              totalProcessed: { type: "integer", example: 12 },
            },
          },
          filtersUsed: {
            type: "object",
            nullable: true,
            properties: {
              vendor: { type: "string" },
              email: { type: "string", format: "email" },
              onlyPdf: { type: "boolean" },
              fromDate: { type: "string", format: "date" },
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
