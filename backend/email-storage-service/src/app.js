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

// Swagger Documentation Route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check Route
app.get("/health", (req, res) => {
   res.json({status:"OK", service: "email-storage-service"});
});

//Default Route
app.get("/", (req, res) => {
    res.send("Welcome to the Email Storage Service API");
});

// Google OAuth routes
app.get("/auth/google", authLimiter, getGoogleAuthURL);
app.get("/auth/google/callback", authLimiter, googleOAuthCallback);

// Importing email routes
app.use("/api/v1", fetchLimiter, emailRoutes);

// Start the server

app.listen(config.port, () => {
    logger.info(`Email Storage Service is running on port ${config.port}`);
    logger.info(`Swagger docs available at http://localhost:${config.port}/api-docs`);
});