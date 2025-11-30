const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const routes = require('./routes');
const verifyToken = require('./middleware/verifyToken');
const { logger, requestLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;
const FRONTEND_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8000';

// Security & parsing
app.use(helmet());
app.use(cookieParser());

// Apply centralized logging middleware EARLY to capture all requests
app.use(requestLogger);

// IMPORTANT: Don't parse body for proxy routes - let the target service handle it
// Only parse body for direct routes (/, /health)
const shouldParseBody = (req, res, next) => {
  // Skip body parsing for proxied routes
  if (req.path.startsWith('/auth') || 
      req.path.startsWith('/email') || 
      req.path.startsWith('/chat') || 
      req.path.startsWith('/ocr') || 
      req.path.startsWith('/analytics')) {
    return next();
  }
  // Parse body for other routes
  express.json()(req, res, next);
};

app.use(shouldParseBody);
app.use(express.urlencoded({ extended: true }));

// CORS (allow credentials for httpOnly cookies)
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);
app.options('*', cors());

// Logging (morgan removed in favor of centralized logger, but keeping for backwards compatibility)
// app.use(morgan('combined')); // You can remove this line as it's redundant now

// Rate limiting
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Root & health (public)
app.get('/', (req, res) => {
  res.json({
    service: 'VendorIQ API Gateway',
    version: '1.0.0',
    routes: ['/auth/*', '/email/*', '/chat/*', '/ocr/*', '/analytics/*']
  });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount proxies that must be public BEFORE JWT middleware when applicable:
// Auth prefix is public (auth endpoints are public)
app.use('/auth', routes.auth);

// Email has some public OAuth endpoints under /auth/google
// We mount email after JWT middleware but verifyToken will skip /email/auth/* based on rules

// Apply JWT middleware for protected routes
app.use(verifyToken);

// Mount other service prefixes (protected by verifyToken, but verifyToken skips allowed public email auth)
app.use('/email', routes.email);
app.use('/chat', routes.chat);
app.use('/ocr', routes.ocr);
app.use('/analytics', routes.analytics);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Gateway Error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl || req.url,
    method: req.method
  });
  
  if (!res.headersSent) {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  } else {
    next(err);
  }
});

// 404 fallback
app.use((req, res) => {
  logger.warn('Route not found', {
    requestId: req.requestId,
    url: req.originalUrl || req.url,
    method: req.method
  });
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`VendorIQ API Gateway started`, { port: PORT, environment: process.env.NODE_ENV || 'development' });
  console.log(`VendorIQ API Gateway listening on port ${PORT}`);
});
