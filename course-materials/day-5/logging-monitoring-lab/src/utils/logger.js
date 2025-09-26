const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, errors, json, printf, colorize, align } =
  winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  align(),
  printf((info) => {
    const { timestamp, level, message, correlationId, ...meta } = info;
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';
    const corrId = correlationId ? `[${correlationId}]` : '';
    return `${timestamp} ${level} ${corrId}: ${message} ${metaStr}`;
  })
);

// JSON format for file output
const fileFormat = combine(timestamp(), errors({ stack: true }), json());

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Configure transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true,
  })
);

// File transports (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      handleExceptions: true,
      handleRejections: true,
    })
  );

  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
    })
  );

  // HTTP requests log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '7d',
    })
  );

  // Debug log file (only in development)
  if (process.env.NODE_ENV === 'development') {
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'debug-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'debug',
        format: fileFormat,
        maxSize: '10m',
        maxFiles: '3d',
      })
    );
  }
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
logger.logRequest = (req, res, responseTime) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    correlationId: req.correlationId,
    contentLength: res.get('Content-Length') || 0,
  });
};

logger.logError = (error, req) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    correlationId: req?.correlationId,
    timestamp: new Date().toISOString(),
  });
};

logger.logBusinessEvent = (event, data = {}) => {
  logger.info('Business Event', {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

logger.logSecurity = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

logger.logDatabaseOperation = (operation, query, duration, error = null) => {
  const logLevel = error ? 'error' : 'debug';
  logger[logLevel]('Database Operation', {
    operation,
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    duration: `${duration}ms`,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
};

logger.logExternalAPI = (
  service,
  endpoint,
  method,
  statusCode,
  duration,
  error = null
) => {
  const logLevel = error || statusCode >= 400 ? 'error' : 'info';
  logger[logLevel]('External API Call', {
    service,
    endpoint,
    method,
    statusCode,
    duration: `${duration}ms`,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
};

// Log system information on startup
if (process.env.NODE_ENV !== 'test') {
  logger.info('Logger initialized', {
    environment: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    pid: process.pid,
  });
}

module.exports = logger;
