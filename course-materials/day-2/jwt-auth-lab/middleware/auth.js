const jwtService = require('../services/jwtService');
const userRepository = require('../repositories/userRepository');

// Extract token from request
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  // Check Authorization header (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  // Check query parameter (not recommended for production)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

// Basic authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'NO_TOKEN',
      });
    }

    // Validate token structure
    if (!jwtService.constructor.validateTokenStructure(token)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        error: 'INVALID_TOKEN_FORMAT',
      });
    }

    // Verify and decode token
    const decoded = jwtService.verifyAccessToken(token);

    // Get user from repository
    const user = userRepository.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        error: 'ACCOUNT_DEACTIVATED',
      });
    }

    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts',
        error: 'ACCOUNT_LOCKED',
      });
    }

    // Check if token is expiring soon and add warning
    if (jwtService.isTokenExpiringSoon(token)) {
      req.tokenWarning = 'Token expires soon, consider refreshing';
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    let errorCode = 'INVALID_TOKEN';
    let statusCode = 401;

    if (error.message.includes('expired')) {
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message.includes('revoked')) {
      errorCode = 'TOKEN_REVOKED';
    } else if (error.message.includes('format')) {
      errorCode = 'INVALID_TOKEN_FORMAT';
    }

    return res.status(statusCode).json({
      success: false,
      message: 'Authentication failed',
      error: errorCode,
      details: error.message,
    });
  }
};

// Role-based authorization middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
    }

    const hasRole = req.user.hasAnyRole(roles);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_ROLE',
        required: roles,
        current: req.user.roles,
      });
    }

    // Add authorization info to request
    req.authorization = {
      type: 'role',
      required: roles,
      granted: req.user.roles.filter((role) => roles.includes(role)),
    };

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
    }

    const hasPermission = req.user.hasAnyPermission(permissions);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSION',
        required: permissions,
        current: req.user.permissions,
      });
    }

    // Add authorization info to request
    req.authorization = {
      type: 'permission',
      required: permissions,
      granted: req.user.permissions.filter((perm) =>
        permissions.includes(perm)
      ),
    };

    next();
  };
};

// Combined role OR permission middleware
const requireRoleOrPermission = (roles = [], permissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
    }

    const hasRole = roles.length > 0 ? req.user.hasAnyRole(roles) : false;
    const hasPermission =
      permissions.length > 0 ? req.user.hasAnyPermission(permissions) : false;

    if (!hasRole && !hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_ACCESS',
        required: {
          roles: roles,
          permissions: permissions,
        },
        current: {
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
      });
    }

    // Add authorization info to request
    req.authorization = {
      type: 'combined',
      required: { roles, permissions },
      granted: {
        roles: req.user.roles.filter((role) => roles.includes(role)),
        permissions: req.user.permissions.filter((perm) =>
          permissions.includes(perm)
        ),
      },
    };

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token && jwtService.constructor.validateTokenStructure(token)) {
      const decoded = jwtService.verifyAccessToken(token);
      const user = userRepository.findById(decoded.id);

      if (user && user.isActive && !user.isLocked()) {
        req.user = user;
        req.token = token;
        req.tokenPayload = decoded;
        req.authenticated = true;
      }
    }
  } catch (error) {
    // Silently ignore token errors for optional auth
    console.log('Optional auth failed:', error.message);
  }

  // Always proceed, regardless of token validity
  req.authenticated = !!req.user;
  next();
};

// Middleware to check if user owns resource or has admin role
const requireOwnershipOrRole = (
  resourceIdParam = 'id',
  allowedRoles = ['admin']
) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED',
      });
    }

    const resourceId = parseInt(req.params[resourceIdParam]);
    const isOwner = req.user.id === resourceId;
    const hasRole = req.user.hasAnyRole(allowedRoles);

    if (!isOwner && !hasRole) {
      return res.status(403).json({
        success: false,
        message:
          'Access denied. You can only access your own resources or need elevated privileges.',
        error: 'ACCESS_DENIED',
        required: {
          ownership: `Resource ID ${resourceId}`,
          roles: allowedRoles,
        },
      });
    }

    req.authorization = {
      type: 'ownership_or_role',
      isOwner,
      hasElevatedRole: hasRole,
      resourceId,
    };

    next();
  };
};

// Rate limiting middleware (simple in-memory implementation)
const createRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const clients = new Map();

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!clients.has(clientId)) {
      clients.set(clientId, { requests: 1, windowStart: now });
      return next();
    }

    const client = clients.get(clientId);

    // Reset window if expired
    if (now - client.windowStart > windowMs) {
      client.requests = 1;
      client.windowStart = now;
      return next();
    }

    // Check if limit exceeded
    if (client.requests >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((windowMs - (now - client.windowStart)) / 1000),
      });
    }

    client.requests++;
    next();
  };
};

// Middleware to add security headers
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add token warning to response if exists
  if (req.tokenWarning) {
    res.setHeader('X-Token-Warning', req.tokenWarning);
  }

  next();
};

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  requireRoleOrPermission,
  requireOwnershipOrRole,
  optionalAuth,
  extractToken,
  createRateLimiter,
  securityHeaders,
};
