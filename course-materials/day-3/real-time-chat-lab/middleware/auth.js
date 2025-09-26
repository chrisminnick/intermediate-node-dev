const jwt = require('jsonwebtoken');
const redisManager = require('../config/redis');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiration = '24h';
  }

  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiration }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async validateSocketAuth(socket, next) {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = this.verifyToken(token);

      // Check if session exists in Redis
      const session = await redisManager.getUserSession(decoded.userId);
      if (!session) {
        return next(new Error('Session expired'));
      }

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.email = decoded.email;
      socket.role = decoded.role;

      console.log(
        `✅ Socket authenticated: ${decoded.username} (${decoded.userId})`
      );
      next();
    } catch (error) {
      console.log(`❌ Socket authentication failed: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  }

  async createGuestUser(socket) {
    try {
      const guestId = `guest_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const guestUsername = `Guest_${Math.random().toString(36).substr(2, 6)}`;

      const guestUser = {
        id: guestId,
        username: guestUsername,
        email: null,
        role: 'guest',
        isGuest: true,
        createdAt: new Date().toISOString(),
      };

      // Save guest session to Redis
      await redisManager.saveUserSession(guestId, {
        ...guestUser,
        socketId: socket.id,
        lastActivity: Date.now(),
      });

      // Attach to socket
      socket.userId = guestId;
      socket.username = guestUsername;
      socket.email = null;
      socket.role = 'guest';
      socket.isGuest = true;

      console.log(`👥 Guest user created: ${guestUsername} (${guestId})`);
      return guestUser;
    } catch (error) {
      console.error('❌ Error creating guest user:', error.message);
      throw error;
    }
  }
}

// Express middleware for HTTP authentication
const authenticateHTTP = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication token required',
      });
    }

    const authService = new AuthService();
    const decoded = authService.verifyToken(token);

    // Check session in Redis
    const session = await redisManager.getUserSession(decoded.userId);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Session expired, please login again',
      });
    }

    req.user = decoded;
    req.session = session;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_FAILED',
      message: 'Invalid or expired token',
    });
  }
};

// Admin role middleware
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Admin privileges required',
    });
  }
};

// Moderator or admin role middleware
const requireModerator = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === 'admin' || req.user.role === 'moderator')
  ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Moderator privileges required',
    });
  }
};

const authService = new AuthService();

module.exports = {
  authService,
  authenticateHTTP,
  requireAdmin,
  requireModerator,
};
