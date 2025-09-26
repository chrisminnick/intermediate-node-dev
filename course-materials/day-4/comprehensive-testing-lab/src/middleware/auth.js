const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Authentication middleware
 * Validates JWT tokens and attaches user information to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided or invalid format',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const decoded = await promisify(jwt.verify)(token, JWT_SECRET);

      // Attach user info to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please log in again',
        });
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Token is malformed',
        });
      }

      throw jwtError;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await promisify(jwt.verify)(token, JWT_SECRET);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (jwtError) {
      // Ignore JWT errors in optional auth
      console.warn('Optional auth JWT error:', jwtError.message);
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth,
};
