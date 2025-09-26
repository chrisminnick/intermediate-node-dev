const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'real-time-chat' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Write chat-specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'chat.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

class Logger {
  constructor() {
    this.winston = logger;
  }

  info(message, meta = {}) {
    this.winston.info(message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = {
      ...meta,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : null,
    };
    this.winston.error(message, errorMeta);
  }

  warn(message, meta = {}) {
    this.winston.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.winston.debug(message, meta);
  }

  // Chat-specific logging methods
  logUserAction(userId, username, action, details = {}) {
    this.info(`User action: ${action}`, {
      userId,
      username,
      action,
      ...details,
      category: 'user-action',
    });
  }

  logChatMessage(roomId, userId, username, messageLength) {
    this.info('Chat message sent', {
      roomId,
      userId,
      username,
      messageLength,
      category: 'chat-message',
    });
  }

  logRoomActivity(roomId, action, userId, details = {}) {
    this.info(`Room activity: ${action}`, {
      roomId,
      userId,
      action,
      ...details,
      category: 'room-activity',
    });
  }

  logSecurityEvent(type, userId, ip, details = {}) {
    this.warn(`Security event: ${type}`, {
      type,
      userId,
      ip,
      ...details,
      category: 'security',
    });
  }

  logPerformance(operation, duration, details = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      ...details,
      category: 'performance',
    });
  }

  logSystemEvent(event, details = {}) {
    this.info(`System event: ${event}`, {
      event,
      ...details,
      category: 'system',
    });
  }

  // Error logging with context
  logConnectionError(error, context = {}) {
    this.error('Connection error', error, {
      ...context,
      category: 'connection',
    });
  }

  logDatabaseError(error, operation, context = {}) {
    this.error(`Database error: ${operation}`, error, {
      operation,
      ...context,
      category: 'database',
    });
  }

  logValidationError(error, input, context = {}) {
    this.error('Validation error', error, {
      input: typeof input === 'object' ? JSON.stringify(input) : input,
      ...context,
      category: 'validation',
    });
  }

  // Rate limiting and spam logs
  logRateLimitExceeded(userId, action, count, limit) {
    this.warn('Rate limit exceeded', {
      userId,
      action,
      count,
      limit,
      category: 'rate-limit',
    });
  }

  logSpamDetection(userId, content, score, action) {
    this.warn('Spam detected', {
      userId,
      contentLength: content ? content.length : 0,
      spamScore: score,
      action,
      category: 'spam',
    });
  }

  // File upload logs
  logFileUpload(userId, filename, size, mimetype) {
    this.info('File uploaded', {
      userId,
      filename,
      size,
      mimetype,
      category: 'file-upload',
    });
  }

  logFileUploadError(userId, error, filename = null) {
    this.error('File upload error', error, {
      userId,
      filename,
      category: 'file-upload',
    });
  }

  // Authentication logs
  logLogin(userId, username, method = 'standard') {
    this.info('User login', {
      userId,
      username,
      method,
      category: 'authentication',
    });
  }

  logLoginFailure(username, reason, ip) {
    this.warn('Login failure', {
      username,
      reason,
      ip,
      category: 'authentication',
    });
  }

  logLogout(userId, username) {
    this.info('User logout', {
      userId,
      username,
      category: 'authentication',
    });
  }

  // Admin actions
  logAdminAction(adminId, action, targetId, details = {}) {
    this.info(`Admin action: ${action}`, {
      adminId,
      action,
      targetId,
      ...details,
      category: 'admin',
    });
  }

  // Get log statistics
  async getLogStats() {
    try {
      const logFiles = ['error.log', 'combined.log', 'chat.log'];
      const stats = {};

      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        try {
          const fileStats = fs.statSync(filePath);
          stats[file] = {
            size: fileStats.size,
            modified: fileStats.mtime,
            sizeFormatted: this.formatFileSize(fileStats.size),
          };
        } catch (error) {
          stats[file] = { error: 'File not found' };
        }
      }

      return stats;
    } catch (error) {
      this.error('Error getting log stats', error);
      return null;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clean up old logs
  async cleanupLogs(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      const logFiles = fs.readdirSync(logsDir);

      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate && file.includes('.log.')) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      this.logSystemEvent('logs-cleanup', { cleanedCount, daysOld });
      return cleanedCount;
    } catch (error) {
      this.error('Error cleaning up logs', error);
      return 0;
    }
  }
}

const appLogger = new Logger();

module.exports = appLogger;
