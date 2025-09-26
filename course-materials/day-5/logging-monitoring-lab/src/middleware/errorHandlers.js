const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Not Found (404) handler
const notFoundHandler = (req, res, next) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.correlationId,
  });

  // Record 404 metric
  metrics.recordError('not_found', 'warning');

  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    path: req.originalUrl,
  });
};

// Global error handler
const errorHandler = (error, req, res, next) => {
  // Ensure we have a correlation ID
  if (!req.correlationId) {
    req.correlationId = 'error-' + Date.now();
  }

  // Log the error with full context
  logger.logError(error, req);

  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'internal_server_error';
  let message = 'Internal Server Error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'validation_error';
    message = 'Validation Error';
  } else if (
    error.name === 'UnauthorizedError' ||
    error.message.includes('unauthorized')
  ) {
    statusCode = 401;
    errorType = 'unauthorized_error';
    message = 'Unauthorized';
  } else if (
    error.name === 'ForbiddenError' ||
    error.message.includes('forbidden')
  ) {
    statusCode = 403;
    errorType = 'forbidden_error';
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorType = 'not_found_error';
    message = 'Not Found';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    errorType = 'conflict_error';
    message = 'Conflict';
  } else if (error.name === 'TooManyRequestsError') {
    statusCode = 429;
    errorType = 'rate_limit_error';
    message = 'Too Many Requests';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    errorType = `http_${statusCode}_error`;
    message = error.message || message;
  }

  // Record error metrics
  metrics.recordError(errorType, getErrorSeverity(statusCode));

  // Prepare error response
  const errorResponse = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    path: req.originalUrl,
  };

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  // Add validation errors if present
  if (error.errors && Array.isArray(error.errors)) {
    errorResponse.validationErrors = error.errors;
  }

  // Security: Don't expose sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    // Only include safe error information
    if (statusCode >= 500) {
      errorResponse.error = 'Internal Server Error';
      errorResponse.message = 'An unexpected error occurred';
    }
  } else {
    errorResponse.message = error.message;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class TooManyRequestsError extends Error {
  constructor(message = 'Too Many Requests') {
    super(message);
    this.name = 'TooManyRequestsError';
    this.statusCode = 429;
  }
}

class InternalServerError extends Error {
  constructor(message = 'Internal Server Error') {
    super(message);
    this.name = 'InternalServerError';
    this.statusCode = 500;
  }
}

// Error severity helper
const getErrorSeverity = (statusCode) => {
  if (statusCode >= 400 && statusCode < 500) {
    return statusCode === 404 ? 'warning' : 'error';
  } else if (statusCode >= 500) {
    return 'critical';
  }
  return 'info';
};

// Database error handler
const handleDatabaseError = (error, operation = 'unknown') => {
  logger.error('Database Error', {
    operation,
    error: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString(),
  });

  // Record database error metrics
  metrics.recordError('database_error', 'critical');

  // Return appropriate error based on database error type
  if (error.code === '23505' || error.code === 11000) {
    // Unique constraint violation
    throw new ConflictError('Resource already exists');
  } else if (error.code === '23503') {
    // Foreign key violation
    throw new ValidationError('Invalid reference');
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new InternalServerError('Database connection failed');
  } else {
    throw new InternalServerError('Database operation failed');
  }
};

// External API error handler
const handleExternalApiError = (
  error,
  service = 'unknown',
  endpoint = 'unknown'
) => {
  logger.error('External API Error', {
    service,
    endpoint,
    error: error.message,
    stack: error.stack,
    status: error.response?.status,
    data: error.response?.data,
    timestamp: new Date().toISOString(),
  });

  // Record external API error metrics
  metrics.recordError('external_api_error', 'error');

  // Return appropriate error based on external API error
  if (error.response?.status === 404) {
    throw new NotFoundError('External resource not found');
  } else if (error.response?.status === 401) {
    throw new UnauthorizedError('External service authentication failed');
  } else if (error.response?.status === 403) {
    throw new ForbiddenError('External service access denied');
  } else if (error.response?.status === 429) {
    throw new TooManyRequestsError('External service rate limit exceeded');
  } else if (error.response?.status >= 500) {
    throw new InternalServerError('External service unavailable');
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    throw new InternalServerError('External service connection failed');
  } else {
    throw new InternalServerError('External service error');
  }
};

// Validation error handler
const handleValidationError = (errors) => {
  const validationErrors = errors.map((error) => ({
    field: error.field || error.path,
    message: error.message,
    value: error.value,
    code: error.code || 'VALIDATION_ERROR',
  }));

  logger.warn('Validation Error', {
    errors: validationErrors,
    timestamp: new Date().toISOString(),
  });

  metrics.recordError('validation_error', 'warning');

  throw new ValidationError('Validation failed', validationErrors);
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncErrorHandler,
  // Error classes
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
  // Error handlers
  handleDatabaseError,
  handleExternalApiError,
  handleValidationError,
  getErrorSeverity,
};
