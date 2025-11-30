const winston = require('winston');
const path = require('path');

// Create logs directory path
const logsDir = path.join(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Service-specific logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'gateway.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Middleware to log all incoming requests and outgoing responses
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Attach request ID to request object
  req.requestId = requestId;
  
  // Log incoming request
  logger.info('Incoming Request', {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id,
    userEmail: req.user?.email
  });

  // Capture the original res.json and res.send to log responses
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function(body) {
    logResponse(body);
    return originalJson(body);
  };

  res.send = function(body) {
    logResponse(body);
    return originalSend(body);
  };

  function logResponse(body) {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel]('Outgoing Response', {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      userEmail: req.user?.email,
      responseSize: body ? JSON.stringify(body).length : 0
    });
  }

  // Log on response finish (for proxied requests that don't use json/send)
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    // Only log if we haven't logged yet (avoid duplicate logs)
    if (!res.locals.logged) {
      logger[logLevel]('Response Finished', {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
        userEmail: req.user?.email
      });
    }
  });

  next();
};

// Log service proxy events
const logServiceProxy = (serviceName, target, req, proxyReq) => {
  logger.info('Proxying to Service', {
    requestId: req.requestId,
    service: serviceName,
    target,
    method: req.method,
    path: req.path,
    fullUrl: req.originalUrl || req.url,
    userId: req.user?.id
  });
};

// Log proxy errors
const logProxyError = (serviceName, target, req, err) => {
  logger.error('Proxy Error', {
    requestId: req.requestId,
    service: serviceName,
    target,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
};

// Log successful proxy responses
const logProxyResponse = (serviceName, proxyRes, req) => {
  logger.info('Service Response', {
    requestId: req.requestId,
    service: serviceName,
    method: req.method,
    path: req.path,
    statusCode: proxyRes.statusCode
  });
};

module.exports = {
  logger,
  requestLogger,
  logServiceProxy,
  logProxyError,
  logProxyResponse
};
