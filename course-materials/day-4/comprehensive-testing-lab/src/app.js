const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Import database connection
const database = require('./database/connection');

class Application {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(
      cors({
        origin:
          process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
        credentials: true,
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api', limiter);

    // Request parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use(
      expressWinston.logger({
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: 'logs/access.log' }),
        ],
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        meta: true,
        msg: 'HTTP {{req.method}} {{req.url}}',
        expressFormat: true,
        colorize: false,
        ignoreRoute: (req) => req.url === '/health',
      })
    );

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      });
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/projects', authMiddleware, projectRoutes);
    this.app.use('/api/tasks', authMiddleware, taskRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/teams', authMiddleware, teamRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  setupErrorHandling() {
    // Error logging middleware
    this.app.use(
      expressWinston.errorLogger({
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: 'logs/error.log' }),
        ],
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    // Global error handler
    this.app.use(errorHandler);
  }

  async initialize() {
    try {
      // Initialize database connection
      await database.connect();
      console.log('Database connection established');

      // Run migrations if needed
      if (process.env.NODE_ENV !== 'test') {
        await database.migrate();
        console.log('Database migrations completed');
      }

      return this.app;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      await database.disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

module.exports = Application;
