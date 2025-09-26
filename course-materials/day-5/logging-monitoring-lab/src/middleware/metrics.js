const metrics = require('../utils/metrics');
const logger = require('../utils/logger');

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  let requestSize = 0;

  // Capture request size
  if (req.get('Content-Length')) {
    requestSize = parseInt(req.get('Content-Length'));
  }

  // Increment active connections
  metrics.activeConnections.inc();

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    const responseSize =
      res.get('Content-Length') ||
      (chunk ? Buffer.byteLength(chunk, encoding) : 0);

    // Normalize route for metrics (replace dynamic segments)
    const route = normalizeRoute(req.originalUrl, req.route);

    // Record HTTP metrics
    metrics.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration,
      requestSize,
      responseSize
    );

    // Record error metrics
    if (res.statusCode >= 400) {
      const errorType = getErrorType(res.statusCode);
      metrics.recordError(errorType, getErrorSeverity(res.statusCode));
    }

    // Decrement active connections
    metrics.activeConnections.dec();

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware to collect business metrics
const businessMetricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Override res.end to capture business metrics
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;

    // Record business operations based on routes
    if (req.originalUrl.includes('/api/users') && req.method === 'POST') {
      metrics.recordBusinessOperation(
        'user_creation',
        duration,
        res.statusCode < 400 ? 'success' : 'failure'
      );

      if (res.statusCode === 201) {
        metrics.userRegistrations.inc({ source: 'api' });
      }
    }

    if (req.originalUrl.includes('/api/auth/login')) {
      const status = res.statusCode === 200 ? 'success' : 'failure';
      metrics.userLogins.inc({ status });
      metrics.recordBusinessOperation('user_login', duration, status);
    }

    if (req.originalUrl.includes('/api/orders') && req.method === 'POST') {
      metrics.recordBusinessOperation(
        'order_creation',
        duration,
        res.statusCode < 400 ? 'success' : 'failure'
      );
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware to collect database metrics
const databaseMetricsMiddleware = (operation, database = 'default') => {
  return async (req, res, next) => {
    const startTime = Date.now();

    try {
      await next();
      const duration = Date.now() - startTime;
      metrics.recordDatabaseQuery(database, operation, duration, 'success');
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.recordDatabaseQuery(database, operation, duration, 'error');
      throw error;
    }
  };
};

// Middleware to collect cache metrics
const cacheMetricsMiddleware = (operation) => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      // Determine cache hit/miss based on response headers or data
      const cacheStatus =
        res.get('X-Cache-Status') || (data && data.cached ? 'hit' : 'miss');

      metrics.recordCacheOperation(operation, cacheStatus);

      // Update cache hit rate
      if (cacheStatus === 'hit') {
        // This is a simplified calculation - in production, you'd want more sophisticated tracking
        const currentRate = metrics.cacheHitRate._getValue() || 0;
        metrics.cacheHitRate.set(Math.min(currentRate + 0.1, 1));
      }

      originalJson.call(this, data);
    };

    next();
  };
};

// Middleware to collect external API metrics
const externalApiMetricsMiddleware = (service, endpoint) => {
  return async (req, res, next) => {
    const startTime = Date.now();

    try {
      await next();
      const duration = Date.now() - startTime;
      const status = res.statusCode < 400 ? 'success' : 'error';
      metrics.recordExternalApiCall(service, endpoint, duration, status);
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.recordExternalApiCall(service, endpoint, duration, 'error');
      throw error;
    }
  };
};

// Middleware for rate limiting metrics
const rateLimitMetricsMiddleware = (req, res, next) => {
  // Check if request was rate limited
  if (res.headersSent && res.statusCode === 429) {
    metrics.rateLimitHits.inc({
      ip: req.ip.substring(0, 10), // Truncate IP for privacy
      endpoint: normalizeRoute(req.originalUrl, req.route),
    });
  }

  next();
};

// Helper functions

const normalizeRoute = (url, route) => {
  if (route && route.path) {
    return route.path;
  }

  // Normalize common patterns
  return url
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
    .replace(/\/[a-f0-9]{24}/g, '/:objectid') // Replace MongoDB ObjectIds
    .split('?')[0]; // Remove query parameters
};

const getErrorType = (statusCode) => {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        return 'bad_request';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 429:
        return 'rate_limited';
      default:
        return 'client_error';
    }
  } else if (statusCode >= 500) {
    switch (statusCode) {
      case 500:
        return 'internal_server_error';
      case 502:
        return 'bad_gateway';
      case 503:
        return 'service_unavailable';
      case 504:
        return 'gateway_timeout';
      default:
        return 'server_error';
    }
  }
  return 'unknown_error';
};

const getErrorSeverity = (statusCode) => {
  if (statusCode >= 400 && statusCode < 500) {
    return statusCode === 404 ? 'warning' : 'error';
  } else if (statusCode >= 500) {
    return 'critical';
  }
  return 'info';
};

// Metrics collection for unhandled errors
const collectUnhandledErrorMetrics = () => {
  process.on('uncaughtException', (error) => {
    metrics.unhandledErrors.inc({ type: 'uncaught_exception' });
    logger.error('Uncaught Exception Metric', { error: error.message });
  });

  process.on('unhandledRejection', (reason) => {
    metrics.unhandledErrors.inc({ type: 'unhandled_rejection' });
    logger.error('Unhandled Rejection Metric', { reason: reason.toString() });
  });
};

// Initialize unhandled error metrics collection
collectUnhandledErrorMetrics();

// Custom metrics update functions
const updateCustomMetrics = () => {
  // Update system metrics
  metrics.updateSystemMetrics();

  // You can add more custom metric updates here
  // For example, update database connection pools, queue sizes, etc.
};

// Schedule custom metrics updates
setInterval(updateCustomMetrics, 15000); // Every 15 seconds

module.exports = {
  metricsMiddleware,
  businessMetricsMiddleware,
  databaseMetricsMiddleware,
  cacheMetricsMiddleware,
  externalApiMetricsMiddleware,
  rateLimitMetricsMiddleware,
  updateCustomMetrics,
};
