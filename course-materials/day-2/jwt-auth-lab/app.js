const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { authenticate } = require('./middleware/auth');

const app = express();

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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  })
);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/api/auth', authLimiter);

// Logging
app.use(
  morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  })
);

app.use(
  morgan('dev', {
    skip: (req, res) =>
      res.statusCode >= 400 || process.env.NODE_ENV === 'production',
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Protected demo endpoint
app.get('/api/protected', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'This is a protected endpoint',
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

// Admin demo endpoint
app.get(
  '/api/admin',
  authenticate,
  (req, res, next) => {
    if (!req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: 'INSUFFICIENT_PRIVILEGES',
      });
    }
    next();
  },
  (req, res) => {
    res.json({
      success: true,
      message: 'This is an admin-only endpoint',
      user: req.user,
      timestamp: new Date().toISOString(),
    });
  }
);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'JWT Authentication Lab API',
    version: '1.0.0',
    documentation: {
      endpoints: {
        auth: {
          'POST /api/auth/register': 'Register a new user',
          'POST /api/auth/login': 'Login user',
          'POST /api/auth/refresh': 'Refresh access token',
          'POST /api/auth/logout': 'Logout user',
          'GET /api/auth/profile': 'Get user profile',
          'PUT /api/auth/profile': 'Update user profile',
          'POST /api/auth/change-password': 'Change password',
          'GET /api/auth/token-info': 'Get token information',
          'POST /api/auth/validate-token': 'Validate token',
        },
        users: {
          'GET /api/users': 'Get all users (admin)',
          'GET /api/users/:id': 'Get user by ID',
          'PUT /api/users/:id': 'Update user',
          'DELETE /api/users/:id': 'Delete user (admin)',
          'POST /api/users/:id/deactivate': 'Deactivate user (admin)',
          'POST /api/users/:id/activate': 'Activate user (admin)',
          'GET /api/users/stats': 'Get user statistics (admin)',
          'GET /api/users/search': 'Search users (admin)',
        },
        general: {
          'GET /': 'API information',
          'GET /health': 'Health check',
          'GET /api/protected': 'Protected endpoint demo',
          'GET /api/admin': 'Admin endpoint demo',
        },
      },
      authentication: 'Bearer token required for protected endpoints',
      rateLimit: 'General: 100 req/15min, Auth: 10 req/15min',
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'ROUTE_NOT_FOUND',
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/users (admin)',
      'GET /api/protected',
      'GET /api/admin',
    ],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      error: 'TOKEN_EXPIRED',
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: error.message,
    });
  }

  // Default server error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: error.code || 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
});

module.exports = app;
