const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const responseTime = require('response-time');
const { v4: uuidv4 } = require('uuid');

// Import custom modules
const logger = require('./src/utils/logger');
const metrics = require('./src/utils/metrics');
const healthCheck = require('./src/routes/health');
const {
  errorHandler,
  notFoundHandler,
} = require('./src/middleware/errorHandlers');
const { requestLogger, correlationId } = require('./src/middleware/logging');
const { metricsMiddleware } = require('./src/middleware/metrics');

// Import routes
const apiRoutes = require('./src/routes/api');
const userRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

// Middleware setup
app.use(correlationId); // Add correlation ID first
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(
  cors({
    origin: NODE_ENV === 'production' ? ['https://yourdomain.com'] : true,
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(compression());
app.use(limiter);
app.use(responseTime());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware
app.use(requestLogger);
app.use(metricsMiddleware);

// Routes
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed', {
    correlationId: req.correlationId,
    userAgent: req.get('User-Agent'),
  });

  res.json({
    message: 'Welcome to the Logging & Monitoring Lab! 📊',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      readiness: '/health/ready',
      metrics: '/metrics',
      api: '/api',
      users: '/api/users',
    },
  });
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);

// Health check routes
app.use('/health', healthCheck);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    const metricsData = await metrics.register.metrics();
    res.end(metricsData);
  } catch (error) {
    logger.error('Error generating metrics', {
      error: error.message,
      stack: error.stack,
      correlationId: req.correlationId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulate some business logic endpoints for testing
app.post('/api/simulate-error', (req, res) => {
  const errorType = req.body.type || 'generic';

  logger.warn('Simulating error', {
    errorType,
    correlationId: req.correlationId,
  });

  switch (errorType) {
    case 'validation':
      return res
        .status(400)
        .json({ error: 'Validation failed', code: 'VALIDATION_ERROR' });
    case 'auth':
      return res
        .status(401)
        .json({ error: 'Unauthorized', code: 'AUTH_ERROR' });
    case 'forbidden':
      return res
        .status(403)
        .json({ error: 'Forbidden', code: 'FORBIDDEN_ERROR' });
    case 'notfound':
      return res
        .status(404)
        .json({ error: 'Resource not found', code: 'NOT_FOUND_ERROR' });
    case 'server':
      throw new Error('Simulated server error');
    default:
      return res
        .status(400)
        .json({ error: 'Unknown error type', code: 'UNKNOWN_ERROR' });
  }
});

app.post('/api/simulate-slow', async (req, res) => {
  const delay = parseInt(req.body.delay) || 1000;

  logger.info('Simulating slow request', {
    delay,
    correlationId: req.correlationId,
  });

  await new Promise((resolve) => setTimeout(resolve, delay));

  res.json({
    message: 'Slow request completed',
    delay,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    // Close database connections, cleanup resources, etc.
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    promise: promise.toString(),
  });
  process.exit(1);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });

  // Log memory usage on startup
  const memUsage = process.memoryUsage();
  logger.info('Initial memory usage', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
  });
});

module.exports = app;
