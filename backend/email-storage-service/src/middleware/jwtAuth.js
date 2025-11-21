import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// Public paths that do not require auth
const PUBLIC_PATHS = new Set([
  '/',
  '/health',
  '/api-info',
  '/api-docs',
  '/auth/google',
  '/auth/google/callback'
]);

export function jwtAuth(req, res, next) {
  const path = req.path;
  // Allow public + swagger assets
  if (
    PUBLIC_PATHS.has(path) ||
    path.startsWith('/api-docs') ||
    path.startsWith('/docs') // future docs
  ) {
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing bearer token' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ detail: 'Server JWT secret not configured' });
  }
  const token = auth.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = payload;
    return next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ detail: 'Token expired' });
    }
    return res.status(401).json({ detail: 'Invalid token', error: e.message });
  }
}

export function decodeForHealth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, reason: 'no-token' };
  }
  if (!JWT_SECRET) {
    return { authenticated: false, reason: 'server-misconfig' };
  }
  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    return { authenticated: true, user: { sub: payload.sub, email: payload.email, username: payload.username } };
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return { authenticated: false, reason: 'expired' };
    }
    return { authenticated: false, reason: 'invalid' };
  }
}
