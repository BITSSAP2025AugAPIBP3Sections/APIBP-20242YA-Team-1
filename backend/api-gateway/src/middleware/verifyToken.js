// src/middleware/verifyToken.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';
const COOKIE_NAME = process.env.TOKEN_COOKIE_NAME || 'access_token';

// Public path checks - these will NOT require JWT
function isPublicPath(originalUrl) {
  if (!originalUrl) return false;

  // Public gateway-level endpoints
  if (originalUrl === '/' || originalUrl === '/health') return true;

  // Auth service public endpoints (mounted under /auth)
  if (originalUrl.startsWith('/auth')) return true;

  // Email service OAuth endpoints are public and will be called via /email/auth/*
  if (originalUrl.startsWith('/email/auth')) return true;
  if (originalUrl.startsWith('/email/auth/google')) return true;

  return false;
}

module.exports = function verifyToken(req, res, next) {
  try {
    // If path is public, skip verification
    const originalUrl = req.originalUrl || req.url;
    if (isPublicPath(originalUrl)) return next();

    // Read token from cookie first, fallback to Authorization header
    let token = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } else if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - token missing' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

    // Attach minimal user info
    req.user = decoded || {};
    return next();
  } catch (err) {
    console.error('JWT verification failed:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }
};