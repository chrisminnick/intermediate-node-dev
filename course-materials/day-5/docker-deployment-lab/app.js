const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

// Initialize Express app
const app = express();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'docker-deployment-lab' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Security middleware
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
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.set('X-Request-ID', req.id);
  next();
});

// Routes
app.get('/', (req, res) => {
  logger.info(`Root endpoint accessed - Request ID: ${req.id}`);
  res.json({
    message: 'Welcome to Docker Deployment Lab!',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.id,
    checks: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      cpu: {
        load: process.cpuUsage(),
      },
    },
  };

  logger.info(`Health check performed - Request ID: ${req.id}`);
  res.status(200).json(healthCheck);
});

// Readiness probe endpoint
app.get('/ready', (req, res) => {
  // In a real application, you would check database connections,
  // external service availability, etc.
  const readinessCheck = {
    status: 'Ready',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected', // Mock status
      cache: 'connected', // Mock status
      external_api: 'connected', // Mock status
    },
    requestId: req.id,
  };

  logger.info(`Readiness check performed - Request ID: ${req.id}`);
  res.status(200).json(readinessCheck);
});

// Liveness probe endpoint
app.get('/live', (req, res) => {
  res.status(200).json({
    status: 'Alive',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// API routes
app.get('/api/info', (req, res) => {
  logger.info(`API info endpoint accessed - Request ID: ${req.id}`);
  res.json({
    application: 'Docker Deployment Lab',
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    container_id: process.env.HOSTNAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    requestId: req.id,
  });
});

// Sample API endpoint with data
app.get('/api/users', (req, res) => {
  logger.info(`Users endpoint accessed - Request ID: ${req.id}`);

  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
  ];

  res.json({
    data: users,
    count: users.length,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// Sample POST endpoint
app.post('/api/users', (req, res) => {
  logger.info(`User creation requested - Request ID: ${req.id}`, {
    body: req.body,
  });

  const { name, email, role = 'user' } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required',
      requestId: req.id,
    });
  }

  const newUser = {
    id: Math.floor(Math.random() * 1000) + 4,
    name,
    email,
    role,
    created_at: new Date().toISOString(),
  };

  res.status(201).json({
    message: 'User created successfully',
    data: newUser,
    requestId: req.id,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error - Request ID: ${req.id}`, {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found - Request ID: ${req.id}`, {
    url: req.originalUrl,
    method: req.method,
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Graceful shutdown handling
let server;

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }

      logger.info('Server closed. Exiting process.');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Start server
if (require.main === module) {
  server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on http://${HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Process ID: ${process.pid}`);
    logger.info(`Node version: ${process.version}`);
  });

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

module.exports = app;
