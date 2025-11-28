const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';

// Routes that don't require JWT validation
const PUBLIC_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/google/login',
  '/api/v1/auth/me',
  '/api/v1/oauth2callback',
  '/oauth2callback'
];

const verifyToken = async (req, res, next) => {
  const path = req.path;

  // Skip JWT validation for public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route) || path === route)) {
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'No token provided' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token with auth service
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/v1/auth/verify`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    // Attach decoded user info to request
    req.user = response.data.user;
    req.token = token;

    // Add user info to headers for downstream services
    req.headers['x-user-id'] = req.user.id || req.user._id;
    req.headers['x-user-email'] = req.user.email;

    next();
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Unauthorized',
        message: error.response.data.message || 'Invalid token'
      });
    }
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token verification failed'
    });
  }
};

module.exports = verifyToken;