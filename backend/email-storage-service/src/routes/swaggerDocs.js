export const swaggerDocs = {
  openapi: "3.0.0",
  info: {
    title: "Email & Storage Service API",
    version: "1.0.0",
    description:
      "API documentation for the Email & Storage microservice that fetches invoices from Gmail and stores them in Google Drive.",
  },
  servers: [
    {
      url: "http://localhost:4002",
      description: "Local development server",
    },
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
                    status: { type: "string" },
                    service: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
