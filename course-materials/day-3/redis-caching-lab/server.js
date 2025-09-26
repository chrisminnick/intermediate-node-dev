require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const redisConfig = require('./config/redis');
const performanceMonitor = require('./utils/performance');

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging and performance tracking
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  req.startTime = Date.now();

  console.log(
    `📨 ${new Date().toISOString()} - ${req.method} ${req.path} - ID: ${req.id}`
  );

  // Track performance
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - req.startTime;
    const cached = res.get('X-Cache') === 'HIT';

    performanceMonitor.recordRequest(req.path, duration, cached);
    originalEnd.apply(this, args);
  };

  next();
});

// API routes
app.use('/api', require('./routes/api'));

// Root endpoint with comprehensive API documentation
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Redis Caching Lab API',
    version: '1.0.0',
    description:
      'Demonstrating Redis caching strategies for performance optimization',
    documentation: {
      endpoints: {
        data: {
          'GET /api/news?category=:category&limit=:limit':
            'Get news articles (cached 5min)',
          'GET /api/users/:userId': 'Get user profile (cached 10min)',
          'GET /api/weather/:city': 'Get weather data (cached 10min)',
          'GET /api/products?category=:category&page=:page&limit=:limit':
            'Get products (cached 30min)',
          'GET /api/reports/:reportType': 'Generate reports (cached 1hour)',
        },
        cache: {
          'GET /api/cache/stats':
            'Get cache statistics and performance metrics',
          'DELETE /api/cache/clear': 'Clear all cache',
          'DELETE /api/cache/clear/:namespace': 'Clear cache by namespace',
          'POST /api/cache/warm': 'Warm up cache with popular data',
          'GET /api/cache/keys/:namespace?': 'List cache keys',
          'DELETE /api/cache/invalidate/:namespace/:key':
            'Invalidate specific cache key',
        },
        performance: {
          'GET /api/benchmark/:endpoint?iterations=:n':
            'Benchmark endpoint performance',
          'GET /performance/stats': 'Get application performance statistics',
          'GET /performance/report': 'Get comprehensive performance report',
        },
      },
      examples: {
        basicUsage: {
          'Get cached news': 'GET /api/news?category=technology&limit=5',
          'Check cache stats': 'GET /api/cache/stats',
          'Clear cache': 'DELETE /api/cache/clear',
          'Warm cache': 'POST /api/cache/warm',
        },
        performanceTesting: {
          'Benchmark news endpoint': 'GET /api/benchmark/news?iterations=20',
          'Compare performance': 'GET /performance/report',
          'Get metrics': 'GET /performance/stats',
        },
      },
      cacheStrategies: {
        'cache-aside': 'Check cache first, fetch and cache on miss',
        'write-through': 'Write to cache and database simultaneously',
        'cache-warming': 'Pre-populate cache with frequently accessed data',
        'ttl-management':
          'Different expiration times based on data characteristics',
      },
    },
    features: [
      'Multiple caching strategies (cache-aside, write-through)',
      'Cache stampede prevention',
      'Performance monitoring and benchmarking',
      'Cache warming and invalidation',
      'Namespace-based cache organization',
      'Automatic fallback on Redis failures',
      'Comprehensive cache statistics',
      'Load testing and performance analysis',
    ],
    quickStart: {
      1: 'Ensure Redis is running on localhost:6379',
      2: 'Try: GET /api/news (slow first time, fast on repeat)',
      3: 'Check: GET /api/cache/stats',
      4: 'Clear: DELETE /api/cache/clear',
      5: 'Warm: POST /api/cache/warm',
      6: 'Monitor: GET /performance/stats',
    },
    timestamp: new Date().toISOString(),
  });
});

// Performance monitoring endpoints
app.get('/performance/stats', (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    res.json({
      success: true,
      performance: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get performance stats',
      message: error.message,
    });
  }
});

app.get('/performance/report', (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    res.json({
      success: true,
      report: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report',
      message: error.message,
    });
  }
});

app.delete('/performance/reset', (req, res) => {
  try {
    performanceMonitor.reset();
    res.json({
      success: true,
      message: 'Performance statistics reset',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset performance stats',
      message: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisHealth = await redisConfig.healthCheck();
    const performanceStats = performanceMonitor.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      api: {
        status: 'healthy',
        uptime: process.uptime(),
        version: '1.0.0',
      },
      redis: redisHealth,
      performance: {
        totalRequests: performanceStats.summary.totalRequests,
        cacheHitRatio: performanceStats.summary.cacheHitRatio,
        avgResponseTime: {
          cached: performanceStats.responseTimeStats.cached.average,
          uncached: performanceStats.responseTimeStats.uncached.average,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ROUTE_NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Visit GET / for API documentation',
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api/news',
      'GET /api/users/:userId',
      'GET /api/weather/:city',
      'GET /api/cache/stats',
      'GET /performance/stats',
    ],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Redis connection errors
  if (
    error.message.includes('Redis') ||
    error.message.includes('ECONNREFUSED')
  ) {
    return res.status(503).json({
      success: false,
      error: 'REDIS_UNAVAILABLE',
      message: 'Redis service is unavailable. Operating in degraded mode.',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message,
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

// Connect to Redis and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to Redis
    console.log('🔄 Connecting to Redis...');
    await redisConfig.connect();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log('🚀 Redis Caching Lab Server');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}`);
      console.log(
        `📊 Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`
      );
      console.log('📚 Available endpoints:');
      console.log('   GET  / - API documentation');
      console.log('   GET  /health - Health check');
      console.log('   GET  /api/news - News articles (cached)');
      console.log('   GET  /api/users/:id - User profiles (cached)');
      console.log('   GET  /api/weather/:city - Weather data (cached)');
      console.log('   GET  /api/cache/stats - Cache statistics');
      console.log('   POST /api/cache/warm - Warm up cache');
      console.log('   GET  /performance/stats - Performance metrics');
      console.log('');
      console.log(
        '💡 Try making the same request twice to see caching in action!'
      );
      console.log('📈 Monitor cache performance with /api/cache/stats');
      console.log('⚡ Ready to accept connections!');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`🛑 ${signal} received, shutting down gracefully...`);

      server.close(async () => {
        try {
          await redisConfig.disconnect();
          console.log('✅ Server shut down gracefully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error.message);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);

    if (error.message.includes('Redis')) {
      console.error('💡 Make sure Redis is running:');
      console.error('   - brew services start redis (macOS)');
      console.error('   - sudo systemctl start redis (Linux)');
      console.error('   - docker run -d -p 6379:6379 redis:7-alpine (Docker)');
    }

    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;
