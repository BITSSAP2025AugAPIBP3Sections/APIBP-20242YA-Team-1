import express from "express";
import cors from "cors";
import config from "./config/index.js";
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
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

//db connection
connectDB();

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }); // 60 reqs / 15 min
const fetchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }); // 30 reqs / 15 min

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

/**
 * ============================================================================
 * SYSTEM HEALTH & INFO ENDPOINTS
 * ============================================================================
 */

/**
 * @route   GET /health
 * @desc    Health check endpoint for service monitoring
 * @access  Public
 * @consumers
 *   - Load balancers (AWS ALB, NGINX, etc.)
 *   - Container orchestration (Kubernetes, Docker Swarm)
 *   - Monitoring services (Datadog, New Relic, Prometheus)
 *   - CI/CD pipelines for deployment validation
 * @returns {200} Service is healthy and operational
 * @example
 *   GET /health
 *   Response: { "status": "OK", "service": "email-storage-service" }
 */
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
 * @desc    Returns comprehensive API information including all endpoints and HTTP methods
 * @access  Public
 * @consumers
 *   - Frontend applications for dynamic endpoint discovery
 *   - API documentation generators
 *   - Developer tools and IDE plugins
 *   - Integration testing frameworks
 * @returns {200} Complete API metadata with endpoint list
 * @note
 *   This endpoint replaces OPTIONS / because CORS middleware intercepts
 *   OPTIONS requests for preflight checks and returns 204 No Content
 * @example
 *   GET /api-info
 *   Response: {
 *     "service": "email-storage-service",
 *     "version": "1.0.0",
 *     "endpoints": { ... },
 *     "httpMethods": ["GET", "POST", "DELETE", "OPTIONS"]
 *   }
 */
app.get("/api-info", (req, res) => {
    res.json({
        service: "email-storage-service",
        version: "1.0.0",
        description: "Email & Storage Service API with Google OAuth, Gmail fetch, and Drive upload capabilities",
        endpoints: {
            system: [
                "GET /",
                "GET /health",
                "GET /api-info",
                "GET /api-docs"
            ],
            auth: [
                "GET /auth/google",
                "GET /auth/google/callback"
            ],
            email: [
                "POST /api/v1/email/fetch"
            ],
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
    });
});

/**
 * ============================================================================
 * GOOGLE OAUTH 2.0 AUTHENTICATION ENDPOINTS
 * ============================================================================
 */

/**
 * @route   GET /auth/google
 * @desc    Generate Google OAuth 2.0 consent URL for user authorization
 * @access  Public
 * @consumers
 *   - Frontend web applications (React, Angular, Vue.js)
 *   - Mobile applications (iOS, Android with WebView)
 *   - Desktop applications with OAuth flow
 * @requires
 *   - Google OAuth 2.0 Client ID configured in environment
 *   - Redirect URI registered in Google Cloud Console
 * @rateLimit 60 requests per 15 minutes
 * @returns {200} OAuth consent URL
 * @example
 *   GET /auth/google
 *   Response: { "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
 */
app.get("/auth/google", authLimiter, getGoogleAuthURL);

/**
 * @route   GET /auth/google/callback
 * @desc    Handle OAuth callback from Google and store user tokens
 * @access  Public (called by Google OAuth, not by API consumers directly)
 * @consumers
 *   - Google OAuth service (automatic redirect)
 *   - Browser redirect after user consent
 * @requires
 *   - Valid authorization code from Google (query parameter)
 * @rateLimit 60 requests per 15 minutes
 * @returns {200} User account connected successfully
 * @returns {400} Invalid or missing authorization code
 * @returns {500} OAuth token exchange failed
 * @sideEffects
 *   - Creates or updates user record in MongoDB
 *   - Stores Google access token and refresh token
 *   - Preserves existing refresh token if Google doesn't return new one
 * @example
 *   GET /auth/google/callback?code=4/0AY0e-g7xxx...
 *   Response: {
 *     "message": "Google account connected successfully!",
 *     "email": "user@example.com"
 *   }
 */
app.get("/auth/google/callback", authLimiter, googleOAuthCallback);

/**
 * ============================================================================
 * EMAIL, DRIVE, AND USER MANAGEMENT ENDPOINTS
 * ============================================================================
 * All routes under /api/v1 are rate-limited to 30 requests per 15 minutes
 * See emailRoutes.js for detailed documentation of each endpoint
 *
 * Available Routes:
 * - POST   /api/v1/email/fetch - Fetch emails and upload invoices
 * - GET    /api/v1/drive/users/:userId/vendors - List vendor folders
 * - GET    /api/v1/drive/users/:userId/vendors/:vendorId/invoices - List invoices
 * - GET    /api/v1/users/:userId/sync-status - Get sync status
 * - DELETE /api/v1/users/:userId/sync-status - Reset sync status
 */
app.use("/api/v1", fetchLimiter, emailRoutes);

/**
 * ============================================================================
 * SERVER STARTUP
 * ============================================================================
 */
app.listen(config.port, () => {
    logger.info(`Email Storage Service is running on port ${config.port}`);
    logger.info(`Swagger docs available at http://localhost:${config.port}/api-docs`);
});