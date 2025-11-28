const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const verifyToken = require('./middleware/verifyToken');

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Root route
app.get('/', (req, res) => {
  res.json({
    service: 'VendorIQ API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      email: '/api/v1/email',
      ocr: '/api/v1/ocr',
      chat: '/api/v1/chat',
      analytics: '/api/v1/analytics'
    }
  });
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'API Gateway' });
});

// Apply JWT middleware to all routes
app.use(verifyToken);

// Routes - mount at /api/v1
app.use('/api/v1/auth', routes.auth);
app.use('/api/v1/email', routes.email);
app.use('/api/v1/ocr', routes.ocr);
app.use('/api/v1/chat', routes.chat);
app.use('/api/v1/analytics', routes.analytics);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});