import express from "express";
import cors from "cors";
import {config} from "./config/index.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import logger, { requestLogger } from "./utils/logger.js";

//imports for swagger documentation
import swaggerUi from "swagger-ui-express";
import {swaggerDocs} from "./routes/swaggerDocs.js";
import emailRoutes from "./routes/emailRoutes.js";
import {connectDB} from "./config/db.js";
import { getGoogleAuthURL, googleOAuthCallback } from "./controllers/authController.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: ["http://localhost:8000", "http://localhost:5173", "http://localhost:3000", "http://localhost:4000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

//db connection
connectDB();

// Rate limiters with JSON responses
const authLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { message: "Too many authentication requests. Please try again later.", retryAfter: "15 minutes" }
});

const fetchLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50,
  message: { message: "Too many fetch requests. Please wait before retrying.", retryAfter: "15 minutes" },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * ============================================================================
 * SWAGGER API DOCUMENTATION
 * ============================================================================
 * @route   GET /api-docs
 * @desc    Interactive Swagger UI for API documentation
 * @access  Public
 * @consumers
 *   - Developers integrating with this API
 *   - Frontend/Mobile app developers
 *   - QA and testing teams
 *   - Third-party integration partners
 * @features
 *   - Try-out functionality for testing endpoints
 *   - Complete API specifications with examples
 *   - Request/response schemas
 *   - Error code documentation
 */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check Route
app.get("/health", (req, res) => {
   res.json({status:"OK", service: "email-storage-service"});
});

/**
 * @route   GET /
 * @desc    Welcome endpoint with service information
 * @access  Public
 * @consumers
 *   - API explorers and documentation browsers
 *   - First-time API users
 * @returns {200} Welcome message
 */
app.get("/", (req, res) => {
    res.send("Welcome to the Email Storage Service API");
});

/**
 * @route   GET /api-info
 * @desc    Comprehensive API information and endpoint listing
 * @access  Public
 * @returns {200} API metadata and available endpoints
 */
app.get("/api-info", (req, res) => {
    res.json({
        service: "Email Storage Service",
        version: "1.0.0",
        description: "Service for fetching, storing, and managing emails from Gmail with automated vendor detection and Drive organization",
        documentation: `http://localhost:${config.port}/api-docs`,
        endpoints: {
            authentication: {
                "GET /auth/google": "Initialize Google OAuth flow",
                "GET /auth/google/callback": "OAuth callback handler"
            },
            emails: {
                "POST /api/v1/emails/fetch": "Fetch and process emails with filtering options",
                "GET /api/v1/emails/schedule/:userId": "Get scheduled email fetch jobs for user",
                "DELETE /api/v1/emails/schedule/:userId/:jobId": "Cancel a scheduled job"
            },
            drive: {
                "GET /api/v1/drive/users/:userId/vendors": "List all vendor folders in Drive",
                "GET /api/v1/drive/users/:userId/vendors/:vendorId/invoices": "List invoices for specific vendor"
            },
            users: {
                "GET /api/v1/users/:userId/sync-status": "Get user's last sync timestamp",
                "POST /api/v1/users/:userId/sync-status/reset": "Reset sync status to re-fetch all emails"
            },
            utility: {
                "GET /health": "Service health check",
                "GET /": "Welcome message",
                "GET /api-info": "This endpoint - API information",
                "GET /api-docs": "Interactive Swagger documentation"
            }
        },
        features: [
            "Email-only vendor filtering",
            "Multi-vendor support (comma-separated emails)",
            "Automated vendor detection from email addresses",
            "Google Drive organization (invoiceAutomation folder structure)",
            "Manual and scheduled email fetching (hourly/daily/weekly)",
            "Sync status tracking to avoid duplicate fetches",
            "User-friendly error messages with actionable guidance"
        ],
        rateLimit: {
            auth: "60 requests per 15 minutes",
            fetch: "30 requests per 15 minutes"
        },
        contact: {
            documentation: `http://localhost:${config.port}/api-docs`,
            support: "See README.md for detailed usage examples"
        }
    });
});

// Google OAuth routes
app.get("/auth/google", authLimiter, getGoogleAuthURL);
app.get("/auth/google/callback", authLimiter, googleOAuthCallback);

// Importing email routes
app.use("/api/v1", fetchLimiter, emailRoutes);

// Start the server

/**
 * ============================================================================
 * SERVER STARTUP
 * ============================================================================
 */
app.listen(config.port, () => {
    logger.info(`Email Storage Service is running on port ${config.port}`);
    logger.info(`Swagger docs available at http://localhost:${config.port}/api-docs`);
});