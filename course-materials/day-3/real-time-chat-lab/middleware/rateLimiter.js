const rateLimit = require('express-rate-limit');
const redisManager = require('../config/redis');

// HTTP Rate Limiter
const httpRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW) || 60000) / 1000
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(
        (parseInt(process.env.RATE_LIMIT_WINDOW) || 60000) / 1000
      ),
    });
  },
});

// Socket.IO Rate Limiter
class SocketRateLimiter {
  constructor() {
    this.maxMessages = parseInt(process.env.MAX_MESSAGES_PER_MINUTE) || 10;
    this.windowMs = 60000; // 1 minute
  }

  async checkMessageRate(userId, socketId) {
    try {
      const result = await redisManager.checkRateLimit(
        userId,
        'messages',
        this.maxMessages,
        this.windowMs
      );

      if (!result.allowed) {
        console.log(
          `⚠️  Message rate limit exceeded for user ${userId} (${result.count}/${result.limit})`
        );
        return {
          allowed: false,
          message: `Message rate limit exceeded. You can send ${this.maxMessages} messages per minute.`,
          count: result.count,
          limit: result.limit,
          resetTime: result.resetTime,
        };
      }

      return {
        allowed: true,
        count: result.count,
        limit: result.limit,
        resetTime: result.resetTime,
      };
    } catch (error) {
      console.error('❌ Error checking message rate limit:', error.message);
      // Allow on error to prevent breaking functionality
      return { allowed: true, count: 0, limit: this.maxMessages };
    }
  }

  async checkConnectionRate(ip) {
    try {
      const result = await redisManager.checkRateLimit(
        ip,
        'connections',
        5, // Max 5 connections per minute per IP
        this.windowMs
      );

      if (!result.allowed) {
        console.log(
          `⚠️  Connection rate limit exceeded for IP ${ip} (${result.count}/${result.limit})`
        );
        return {
          allowed: false,
          message: 'Too many connection attempts. Please try again later.',
          count: result.count,
          limit: result.limit,
          resetTime: result.resetTime,
        };
      }

      return {
        allowed: true,
        count: result.count,
        limit: result.limit,
        resetTime: result.resetTime,
      };
    } catch (error) {
      console.error('❌ Error checking connection rate limit:', error.message);
      return { allowed: true, count: 0, limit: 5 };
    }
  }

  async checkFileUploadRate(userId) {
    try {
      const result = await redisManager.checkRateLimit(
        userId,
        'file_uploads',
        3, // Max 3 file uploads per minute
        this.windowMs
      );

      if (!result.allowed) {
        console.log(
          `⚠️  File upload rate limit exceeded for user ${userId} (${result.count}/${result.limit})`
        );
        return {
          allowed: false,
          message:
            'File upload rate limit exceeded. You can upload 3 files per minute.',
          count: result.count,
          limit: result.limit,
          resetTime: result.resetTime,
        };
      }

      return {
        allowed: true,
        count: result.count,
        limit: result.limit,
        resetTime: result.resetTime,
      };
    } catch (error) {
      console.error('❌ Error checking file upload rate limit:', error.message);
      return { allowed: true, count: 0, limit: 3 };
    }
  }

  // Middleware factory for different actions
  createSocketMiddleware(action, limit, windowMs) {
    return async (socket, next) => {
      try {
        const userId = socket.userId || socket.id;
        const result = await redisManager.checkRateLimit(
          userId,
          action,
          limit,
          windowMs || this.windowMs
        );

        if (!result.allowed) {
          const error = new Error(`Rate limit exceeded for ${action}`);
          error.data = {
            action,
            count: result.count,
            limit: result.limit,
            resetTime: result.resetTime,
          };
          return next(error);
        }

        socket.rateLimit = socket.rateLimit || {};
        socket.rateLimit[action] = result;
        next();
      } catch (error) {
        console.error(
          `❌ Error in socket rate limit middleware for ${action}:`,
          error.message
        );
        next(); // Allow on error
      }
    };
  }
}

// Spam Detection
class SpamDetector {
  constructor() {
    this.suspiciousPatterns = [
      /(.)\1{10,}/, // Repeated characters
      /https?:\/\/[^\s]{10,}/gi, // URLs
      /(.{1,20})\1{3,}/, // Repeated phrases
      /[A-Z]{20,}/, // Too many caps
      /[!@#$%^&*()]{10,}/, // Too many special chars
    ];
  }

  async checkMessage(userId, content) {
    try {
      // Check for suspicious patterns
      const isSpam = this.suspiciousPatterns.some((pattern) =>
        pattern.test(content)
      );

      if (isSpam) {
        // Increment spam score
        const spamKey = `spam:${userId}`;
        const spamScore = await redisManager.client.incr(spamKey);
        await redisManager.client.expire(spamKey, 3600); // 1 hour

        if (spamScore > 5) {
          console.log(
            `🚨 User ${userId} flagged as spammer (score: ${spamScore})`
          );
          return {
            isSpam: true,
            action: 'block',
            reason: 'Spam detection triggered',
            score: spamScore,
          };
        }

        return {
          isSpam: true,
          action: 'warn',
          reason: 'Potentially suspicious content',
          score: spamScore,
        };
      }

      return {
        isSpam: false,
        action: 'allow',
        score: 0,
      };
    } catch (error) {
      console.error('❌ Error in spam detection:', error.message);
      return { isSpam: false, action: 'allow', score: 0 };
    }
  }

  async getSpamScore(userId) {
    try {
      const spamKey = `spam:${userId}`;
      const score = await redisManager.client.get(spamKey);
      return parseInt(score) || 0;
    } catch (error) {
      console.error('❌ Error getting spam score:', error.message);
      return 0;
    }
  }

  async clearSpamScore(userId) {
    try {
      const spamKey = `spam:${userId}`;
      await redisManager.client.del(spamKey);
      return true;
    } catch (error) {
      console.error('❌ Error clearing spam score:', error.message);
      return false;
    }
  }
}

const socketRateLimiter = new SocketRateLimiter();
const spamDetector = new SpamDetector();

module.exports = {
  httpRateLimit,
  socketRateLimiter,
  spamDetector,
};
