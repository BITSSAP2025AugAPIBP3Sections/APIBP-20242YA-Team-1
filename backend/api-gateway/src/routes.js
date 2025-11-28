const express = require('express');
const axios = require('axios');

// Service URLs from environment variables
const SERVICES = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  EMAIL: process.env.EMAIL_SERVICE_URL || 'http://localhost:4002',
  OCR: process.env.OCR_SERVICE_URL || 'http://localhost:4003',
  CHAT: process.env.CHAT_SERVICE_URL || 'http://localhost:4005',
  ANALYTICS: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4004'
};

// Helper function to proxy requests with user context
const proxyRequest = (serviceUrl, servicePrefix) => async (req, res, next) => {
  try {
    // Build the full path for the backend service
    const fullPath = `${servicePrefix}${req.path}`;
    
    // Prepare headers with user context
    const headers = {
      ...req.headers,
      host: new URL(serviceUrl).host
    };

    // Add user info from JWT middleware if available
    if (req.user) {
      headers['x-user-id'] = req.user.id || req.user._id || '';
      headers['x-user-email'] = req.user.email || '';
      headers['x-user-role'] = req.user.role || '';
    }

    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${fullPath}`,
      data: req.body,
      headers: headers,
      params: req.query,
      maxRedirects: 5,
      validateStatus: (status) => status < 600 // Accept all status codes
    });

    // Forward response headers
    Object.keys(response.headers).forEach(key => {
      res.setHeader(key, response.headers[key]);
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Backend service is not responding'
      });
    } else {
      next(error);
    }
  }
};

// Auth routes
const authRouter = express.Router();
authRouter.all('*', proxyRequest(SERVICES.AUTH, '/api/v1/auth'));

// Email routes
const emailRouter = express.Router();
emailRouter.all('*', proxyRequest(SERVICES.EMAIL, '/api/v1/email'));

// OCR routes
const ocrRouter = express.Router();
ocrRouter.all('*', proxyRequest(SERVICES.OCR, '/api/v1/ocr'));

// Chat routes
const chatRouter = express.Router();
chatRouter.all('*', proxyRequest(SERVICES.CHAT, '/api/v1/chat'));

// Analytics routes
const analyticsRouter = express.Router();
analyticsRouter.all('*', proxyRequest(SERVICES.ANALYTICS, '/api/v1/analytics'));

module.exports = {
  auth: authRouter,
  email: emailRouter,
  ocr: ocrRouter,
  chat: chatRouter,
  analytics: analyticsRouter
};