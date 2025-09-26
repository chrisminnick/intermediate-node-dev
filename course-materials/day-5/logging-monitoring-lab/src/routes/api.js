const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { asyncErrorHandler } = require('../middleware/errorHandlers');

// API info endpoint
router.get(
  '/info',
  asyncErrorHandler(async (req, res) => {
    logger.info('API info requested', { correlationId: req.correlationId });

    const apiInfo = {
      name: 'Logging & Monitoring Lab API',
      version: '1.0.0',
      description:
        'Comprehensive Node.js application demonstrating logging, monitoring, and health checks',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      correlationId: req.correlationId,
      endpoints: [
        'GET /api/info - API information',
        'GET /api/status - Application status',
        'POST /api/events - Log business events',
        'GET /api/performance - Performance metrics',
        'POST /api/simulate/load - Simulate load',
        'POST /api/simulate/error - Simulate errors',
        'GET /api/users - User operations',
        'GET /health - Health checks',
        'GET /metrics - Prometheus metrics',
      ],
    };

    res.json(apiInfo);
  })
);

// Application status endpoint
router.get(
  '/status',
  asyncErrorHandler(async (req, res) => {
    const memUsage = process.memoryUsage();

    const status = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      application: {
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
    };

    logger.info('Application status requested', {
      correlationId: req.correlationId,
      memoryUsage: status.memory,
      uptime: status.application.uptime,
    });

    res.json(status);
  })
);

// Business event logging endpoint
router.post(
  '/events',
  asyncErrorHandler(async (req, res) => {
    const { event, data = {} } = req.body;

    if (!event) {
      return res.status(400).json({
        error: 'Event name is required',
        correlationId: req.correlationId,
      });
    }

    // Log the business event
    logger.logBusinessEvent(event, {
      ...data,
      correlationId: req.correlationId,
      source: 'api',
    });

    // Record business metrics
    metrics.recordBusinessOperation(event, 0, 'success');

    logger.info('Business event logged via API', {
      event,
      correlationId: req.correlationId,
    });

    res.status(201).json({
      message: 'Event logged successfully',
      event,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// Performance metrics endpoint
router.get(
  '/performance',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();

    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    const responseTime = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const performance = {
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      responseTime: `${responseTime}ms`,
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      cpu: {
        user: `${Math.round(cpuUsage.user / 1000)}ms`,
        system: `${Math.round(cpuUsage.system / 1000)}ms`,
      },
      uptime: `${Math.floor(process.uptime())}s`,
      eventLoop: {
        lag: `${Math.random() * 10}ms`, // Simulated
      },
    };

    logger.logPerformance('performance_check', responseTime, {
      correlationId: req.correlationId,
      memoryUsage: performance.memory,
    });

    res.json(performance);
  })
);

// Load simulation endpoint
router.post(
  '/simulate/load',
  asyncErrorHandler(async (req, res) => {
    const { requests = 10, delay = 100 } = req.body;
    const startTime = Date.now();

    logger.info('Load simulation started', {
      requests,
      delay,
      correlationId: req.correlationId,
    });

    // Simulate multiple requests
    const promises = [];
    for (let i = 0; i < requests; i++) {
      promises.push(
        new Promise((resolve) =>
          setTimeout(
            () => resolve(`Request ${i + 1} completed`),
            delay + Math.random() * delay
          )
        )
      );
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    logger.logPerformance('load_simulation', totalTime, {
      requests,
      delay,
      correlationId: req.correlationId,
    });

    // Record business metrics
    metrics.recordBusinessOperation('load_simulation', totalTime, 'success');

    res.json({
      message: 'Load simulation completed',
      requests,
      delay,
      totalTime: `${totalTime}ms`,
      averageTime: `${Math.round(totalTime / requests)}ms`,
      results: results.slice(0, 5), // Return first 5 results
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// Error simulation endpoint
router.post(
  '/simulate/error',
  asyncErrorHandler(async (req, res) => {
    const { type = 'generic', message = 'Simulated error' } = req.body;

    logger.warn('Error simulation requested', {
      type,
      message,
      correlationId: req.correlationId,
    });

    // Record error metrics
    metrics.recordError(`simulated_${type}`, 'warning');

    switch (type) {
      case 'validation':
        return res.status(400).json({
          error: 'Validation Error',
          message,
          code: 'VALIDATION_ERROR',
          correlationId: req.correlationId,
        });

      case 'unauthorized':
        return res.status(401).json({
          error: 'Unauthorized',
          message,
          code: 'UNAUTHORIZED_ERROR',
          correlationId: req.correlationId,
        });

      case 'forbidden':
        return res.status(403).json({
          error: 'Forbidden',
          message,
          code: 'FORBIDDEN_ERROR',
          correlationId: req.correlationId,
        });

      case 'notfound':
        return res.status(404).json({
          error: 'Not Found',
          message,
          code: 'NOT_FOUND_ERROR',
          correlationId: req.correlationId,
        });

      case 'timeout':
        // Simulate timeout
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return res.status(408).json({
          error: 'Request Timeout',
          message,
          code: 'TIMEOUT_ERROR',
          correlationId: req.correlationId,
        });

      case 'server':
        const error = new Error(message);
        error.name = 'SimulatedServerError';
        throw error;

      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Unknown error type',
          availableTypes: [
            'validation',
            'unauthorized',
            'forbidden',
            'notfound',
            'timeout',
            'server',
          ],
          correlationId: req.correlationId,
        });
    }
  })
);

// Database operation simulation
router.post(
  '/simulate/database',
  asyncErrorHandler(async (req, res) => {
    const { operation = 'select', delay = 50 } = req.body;
    const startTime = Date.now();

    logger.info('Database operation simulation started', {
      operation,
      delay,
      correlationId: req.correlationId,
    });

    // Simulate database operation
    await new Promise((resolve) => setTimeout(resolve, delay));

    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation(
      operation,
      `SELECT * FROM users WHERE id = ?`,
      duration
    );

    // Record database metrics
    metrics.recordDatabaseQuery('postgres', operation, duration, 'success');

    res.json({
      message: 'Database operation completed',
      operation,
      duration: `${duration}ms`,
      query: `SELECT * FROM users WHERE id = ?`,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// External API call simulation
router.post(
  '/simulate/external-api',
  asyncErrorHandler(async (req, res) => {
    const {
      service = 'example-api',
      endpoint = '/users',
      delay = 200,
    } = req.body;
    const startTime = Date.now();

    logger.info('External API call simulation started', {
      service,
      endpoint,
      delay,
      correlationId: req.correlationId,
    });

    // Simulate external API call
    await new Promise((resolve) => setTimeout(resolve, delay));

    const duration = Date.now() - startTime;
    const statusCode = Math.random() > 0.1 ? 200 : 500; // 90% success rate

    // Log external API call
    logger.logExternalAPI(service, endpoint, 'GET', statusCode, duration);

    // Record external API metrics
    metrics.recordExternalApiCall(
      service,
      endpoint,
      duration,
      statusCode < 400 ? 'success' : 'error'
    );

    if (statusCode >= 400) {
      return res.status(502).json({
        error: 'External API Error',
        message: 'Simulated external API failure',
        service,
        endpoint,
        statusCode,
        duration: `${duration}ms`,
        correlationId: req.correlationId,
      });
    }

    res.json({
      message: 'External API call completed',
      service,
      endpoint,
      statusCode,
      duration: `${duration}ms`,
      data: { simulated: true, users: [] },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

module.exports = router;
