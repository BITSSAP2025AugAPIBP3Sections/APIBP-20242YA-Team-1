// src/routes.js
const { createProxyMiddleware } = require('http-proxy-middleware');
const { logServiceProxy, logProxyError, logProxyResponse } = require('./middleware/logger');

const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  email: process.env.EMAIL_SERVICE_URL || 'http://localhost:4002',
  ocr: process.env.OCR_SERVICE_URL || 'http://localhost:4003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4004',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:4005'
};

function makeProxyOptions(serviceName, target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    ws: true,
    logLevel: 'warn',
    // remove the gateway prefix (/auth, /email, /chat, /ocr, /analytics)
    pathRewrite: (path, req) => {
      // strip only the first path segment (e.g., /auth -> '')
      // so /auth/api/v1/auth/login -> /api/v1/auth/login
      return path.replace(new RegExp(`^/${serviceName}`), '') || '/';
    },
    onProxyReq: (proxyReq, req, res) => {
      // Log the proxy request
      logServiceProxy(serviceName, target, req, proxyReq);
      
      // remove incoming cookie header so backend does not receive httpOnly cookie
      proxyReq.removeHeader('cookie');

      // add minimal safe headers (user context)
      if (req.user) {
        if (req.user.id) proxyReq.setHeader('x-user-id', req.user.id);
        if (req.user.email) proxyReq.setHeader('x-user-email', req.user.email);
        if (req.user.role) proxyReq.setHeader('x-user-role', req.user.role);
      }

      // forward original request id / trace if present
      if (req.requestId) {
        proxyReq.setHeader('x-request-id', req.requestId);
      } else if (req.headers['x-request-id']) {
        proxyReq.setHeader('x-request-id', req.headers['x-request-id']);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Log the proxy response
      logProxyResponse(serviceName, proxyRes, req);
    },
    onError: (err, req, res) => {
      // Log the proxy error
      logProxyError(serviceName, target, req, err);
      
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad Gateway', message: 'Target service error' });
      }
    },
    timeout: 120000,        // 2 minutes for initial connection
    proxyTimeout: 120000,   // 2 minutes for response
    selfHandleResponse: false
  };
}

// Export proxies to be mounted by index.js
module.exports = {
  auth: createProxyMiddleware(makeProxyOptions('auth', SERVICES.auth)),
  email: createProxyMiddleware(makeProxyOptions('email', SERVICES.email)),
  ocr: createProxyMiddleware(makeProxyOptions('ocr', SERVICES.ocr)),
  analytics: createProxyMiddleware(makeProxyOptions('analytics', SERVICES.analytics)),
  chat: createProxyMiddleware(makeProxyOptions('chat', SERVICES.chat))
};
