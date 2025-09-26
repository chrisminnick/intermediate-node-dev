const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Middleware to add correlation ID to requests
const correlationId = (req, res, next) => {
  // Check if correlation ID already exists in headers
  req.correlationId =
    req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);

  next();
};

// Enhanced request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log the incoming request
  logger.http('Request received', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    correlationId: req.correlationId,
    contentLength: req.get('Content-Length') || 0,
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
  });

  // Override res.end to capture response data
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Get response size
    const responseSize =
      res.get('Content-Length') ||
      (chunk ? Buffer.byteLength(chunk, encoding) : 0);

    // Log the response
    logger.logRequest(req, res, responseTime);

    // Additional detailed logging for errors
    if (res.statusCode >= 400) {
      logger.warn('HTTP Error Response', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId: req.correlationId,
        responseSize,
      });
    }

    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      logger.warn('Slow Request', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        correlationId: req.correlationId,
        threshold: '1000ms',
      });
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Security event logging middleware
const securityLogger = (req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /script/i, // Script injection attempts
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
    /<script/i, // XSS attempts
  ];

  const requestData = JSON.stringify({
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: req.headers,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.logSecurity('Suspicious Request Pattern', {
        pattern: pattern.toString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId,
        matchedContent: requestData.substring(0, 500),
      });
      break;
    }
  }

  // Log authentication attempts
  if (req.originalUrl.includes('/auth') || req.originalUrl.includes('/login')) {
    logger.logSecurity('Authentication Attempt', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId,
    });
  }

  next();
};

// User activity logging middleware
const userActivityLogger = (req, res, next) => {
  // Skip logging for health checks and metrics
  if (
    req.originalUrl.includes('/health') ||
    req.originalUrl.includes('/metrics')
  ) {
    return next();
  }

  // Log user activities with business context
  const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
  const sessionId =
    req.session?.id || req.headers['x-session-id'] || 'no-session';

  logger.logBusinessEvent('User Activity', {
    userId,
    sessionId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
    referer: req.get('Referer'),
  });

  next();
};

// Performance logging middleware
const performanceLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  // Override res.end to capture performance data
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log performance metrics for specific routes
    if (req.route) {
      logger.logPerformance('HTTP Request', duration, {
        method: req.method,
        route: req.route.path,
        statusCode: res.statusCode,
        correlationId: req.correlationId,
      });
    }

    // Log performance warnings for slow requests
    if (duration > 5000) {
      // 5 seconds
      logger.warn('Very Slow Request', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        correlationId: req.correlationId,
        threshold: '5000ms',
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error context middleware
const errorContextLogger = (error, req, res, next) => {
  // Enhanced error logging with full context
  logger.logError(error, req);

  // Log additional context for debugging
  logger.error('Error Context', {
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
    params: req.params,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
    stackTrace: error.stack,
  });

  next(error);
};

module.exports = {
  correlationId,
  requestLogger,
  securityLogger,
  userActivityLogger,
  performanceLogger,
  errorContextLogger,
};
