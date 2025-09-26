require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', require('./routes/api'));

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MongoDB Transactions Lab API',
    version: '1.0.0',
    description:
      'Banking system demonstrating MongoDB transactions for atomic money transfers',
    documentation: {
      endpoints: {
        health: 'GET /api/health - API and database health check',
        accounts: {
          'POST /api/accounts': 'Create a new account',
          'GET /api/accounts/:id': 'Get account by ID',
          'GET /api/accounts/user/:userId': 'Get all accounts for a user',
          'PATCH /api/accounts/:id/status': 'Update account status',
          'GET /api/accounts/:id/transfers': 'Get account transfer history',
          'GET /api/accounts/:id/stats': 'Get account transfer statistics',
        },
        transfers: {
          'POST /api/transfers': 'Create a new transfer',
          'GET /api/transfers/:transferId': 'Get transfer by ID',
          'POST /api/transfers/:transferId/cancel': 'Cancel a transfer',
        },
      },
      examples: {
        createAccount: {
          method: 'POST',
          url: '/api/accounts',
          body: {
            userId: 'user123',
            initialBalance: 1000,
            currency: 'USD',
            accountType: 'checking',
          },
        },
        transfer: {
          method: 'POST',
          url: '/api/transfers',
          body: {
            fromAccount: 'account_id_1',
            toAccount: 'account_id_2',
            amount: 100,
            description: 'Payment for services',
            initiatedBy: 'user123',
          },
        },
      },
    },
    features: [
      'Atomic money transfers using MongoDB transactions',
      'Account balance validation',
      'Transfer history and audit trail',
      'Daily transfer limits',
      'Currency support',
      'Account status management',
      'Comprehensive error handling',
      'Transfer cancellation',
      'Statistics and reporting',
    ],
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/accounts',
      'GET /api/accounts/:id',
      'POST /api/transfers',
      'GET /api/transfers/:transferId',
    ],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message,
      details: Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      })),
    });
  }

  // Mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ID',
      message: 'Invalid ID format',
    });
  }

  // MongoDB duplicate key errors
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'DUPLICATE_KEY',
      message: 'Duplicate value for unique field',
    });
  }

  // Transaction errors
  if (error.message && error.message.includes('Transaction')) {
    return res.status(500).json({
      success: false,
      error: 'TRANSACTION_ERROR',
      message: 'Database transaction failed',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  // Default server error
  res.status(error.status || 500).json({
    success: false,
    error: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
});

// Connect to database and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log('🚀 MongoDB Transactions Lab Server');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}`);
      console.log('📚 Available endpoints:');
      console.log('   GET  / - API documentation');
      console.log('   GET  /api/health - Health check');
      console.log('   POST /api/accounts - Create account');
      console.log('   GET  /api/accounts/:id - Get account');
      console.log('   POST /api/transfers - Create transfer');
      console.log('   GET  /api/transfers/:id - Get transfer');
      console.log('');
      console.log(
        '💡 Try creating accounts and transfers to test transactions!'
      );
      console.log('⚡ Ready to accept connections!');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;
