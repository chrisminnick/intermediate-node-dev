require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { httpRateLimit } = require('../middleware/rateLimiter');
const {
  authenticateHTTP,
  requireAdmin,
  requireModerator,
} = require('../middleware/auth');
const logger = require('../utils/logger');

const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Rate limiting
app.use('/api', httpRateLimit);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    category: 'http-request',
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.info('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      category: 'http-response',
    });

    originalSend.call(this, data);
  };

  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
const chatService = require('./services/chatService');
const userService = require('./services/userService');
const fileService = require('./services/fileService');
const redisManager = require('../config/redis');

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const redisHealth = await redisManager.healthCheck();
    const fileStats = await fileService.getFileStats();
    const logStats = await logger.getLogStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      api: {
        status: 'healthy',
        uptime: process.uptime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      redis: redisHealth,
      files: fileStats,
      logs: logStats,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      success: false,
      error: 'HEALTH_CHECK_FAILED',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'USERNAME_REQUIRED',
        message: 'Username is required',
      });
    }

    // Authenticate user
    const authResult = await userService.authenticateUser(username, password);

    if (!authResult.success) {
      logger.logLoginFailure(username, authResult.error, req.ip);
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: authResult.error,
      });
    }

    // Generate JWT token
    const { authService } = require('../middleware/auth');
    const token = authService.generateToken(authResult.user);

    logger.logLogin(authResult.user.id, authResult.user.username);

    res.json({
      success: true,
      user: authResult.user,
      token,
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_ERROR',
      message: 'Internal server error during login',
    });
  }
});

app.post('/api/auth/guest', async (req, res) => {
  try {
    const guestUser = {
      username: `Guest_${Math.random().toString(36).substr(2, 6)}`,
      isGuest: true,
    };

    const createResult = await userService.createUser(guestUser);

    if (!createResult.success) {
      return res.status(500).json({
        success: false,
        error: 'GUEST_CREATION_FAILED',
        message: 'Failed to create guest user',
      });
    }

    // Generate JWT token
    const { authService } = require('../middleware/auth');
    const token = authService.generateToken(createResult.user);

    logger.logLogin(createResult.user.id, createResult.user.username, 'guest');

    res.json({
      success: true,
      user: createResult.user,
      token,
      message: 'Guest user created successfully',
    });
  } catch (error) {
    logger.error('Guest creation error', error);
    res.status(500).json({
      success: false,
      error: 'GUEST_ERROR',
      message: 'Internal server error during guest creation',
    });
  }
});

// Chat endpoints
app.get('/api/rooms', authenticateHTTP, async (req, res) => {
  try {
    const rooms = await chatService.getAllRooms();
    res.json({
      success: true,
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    logger.error('Error getting rooms', error);
    res.status(500).json({
      success: false,
      error: 'ROOMS_ERROR',
      message: 'Failed to retrieve rooms',
    });
  }
});

app.post('/api/rooms', authenticateHTTP, async (req, res) => {
  try {
    const { name, description, isPrivate, password, maxUsers } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ROOM_NAME_REQUIRED',
        message: 'Room name is required',
      });
    }

    const roomId = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    const room = await chatService.createRoom(roomId, {
      name: name.trim(),
      description: description?.trim() || '',
      isPrivate: Boolean(isPrivate),
      password: isPrivate ? password : null,
      maxUsers: maxUsers || 100,
      createdBy: req.user.userId,
    });

    if (!room) {
      return res.status(409).json({
        success: false,
        error: 'ROOM_EXISTS',
        message: 'Room already exists',
      });
    }

    logger.logRoomActivity(roomId, 'created', req.user.userId, { name });

    res.status(201).json({
      success: true,
      room,
      message: 'Room created successfully',
    });
  } catch (error) {
    logger.error('Error creating room', error);
    res.status(500).json({
      success: false,
      error: 'ROOM_CREATION_ERROR',
      message: 'Failed to create room',
    });
  }
});

app.get('/api/rooms/:roomId', authenticateHTTP, async (req, res) => {
  try {
    const { roomId } = req.params;
    const stats = await chatService.getRoomStats(roomId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      room: stats,
    });
  } catch (error) {
    logger.error('Error getting room stats', error);
    res.status(500).json({
      success: false,
      error: 'ROOM_STATS_ERROR',
      message: 'Failed to retrieve room stats',
    });
  }
});

app.get('/api/rooms/:roomId/messages', authenticateHTTP, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const messages = await chatService.getMessages(
      roomId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      messages,
      count: messages.length,
      roomId,
    });
  } catch (error) {
    logger.error('Error getting messages', error);
    res.status(500).json({
      success: false,
      error: 'MESSAGES_ERROR',
      message: 'Failed to retrieve messages',
    });
  }
});

// User endpoints
app.get('/api/users/me', authenticateHTTP, async (req, res) => {
  try {
    const userStats = await userService.getUserStats(req.user.userId);

    if (!userStats) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      ...userStats,
    });
  } catch (error) {
    logger.error('Error getting user stats', error);
    res.status(500).json({
      success: false,
      error: 'USER_STATS_ERROR',
      message: 'Failed to retrieve user stats',
    });
  }
});

app.put('/api/users/me', authenticateHTTP, async (req, res) => {
  try {
    const { username, email, avatar, preferences } = req.body;

    const updateResult = await userService.updateUser(req.user.userId, {
      username,
      email,
      avatar,
      preferences,
    });

    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        error: 'UPDATE_FAILED',
        message: updateResult.error,
      });
    }

    logger.logUserAction(req.user.userId, req.user.username, 'profile-updated');

    res.json({
      success: true,
      user: updateResult.user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    logger.error('Error updating user', error);
    res.status(500).json({
      success: false,
      error: 'USER_UPDATE_ERROR',
      message: 'Failed to update profile',
    });
  }
});

app.get('/api/users/online', authenticateHTTP, async (req, res) => {
  try {
    const onlineUsers = await userService.getOnlineUsers();

    res.json({
      success: true,
      users: onlineUsers,
      count: onlineUsers.length,
    });
  } catch (error) {
    logger.error('Error getting online users', error);
    res.status(500).json({
      success: false,
      error: 'ONLINE_USERS_ERROR',
      message: 'Failed to retrieve online users',
    });
  }
});

// File upload endpoint
app.post(
  '/api/upload',
  authenticateHTTP,
  fileService.getUploadMiddleware(),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: 'No file uploaded',
        });
      }

      const { roomId } = req.body;

      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: 'ROOM_ID_REQUIRED',
          message: 'Room ID is required',
        });
      }

      // Validate file
      const validation = fileService.validateFile(req.file);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE',
          message: validation.errors[0],
          details: validation.errors,
        });
      }

      // Process upload
      const fileInfo = await fileService.processUpload(
        req.file,
        req.user.userId,
        roomId
      );

      logger.logFileUpload(
        req.user.userId,
        req.file.originalname,
        req.file.size,
        req.file.mimetype
      );

      res.json({
        success: true,
        file: fileInfo,
        message: 'File uploaded successfully',
      });
    } catch (error) {
      logger.logFileUploadError(
        req.user?.userId,
        error,
        req.file?.originalname
      );
      res.status(500).json({
        success: false,
        error: 'UPLOAD_ERROR',
        message: 'File upload failed',
      });
    }
  }
);

// Admin endpoints
app.get(
  '/api/admin/stats',
  authenticateHTTP,
  requireAdmin,
  async (req, res) => {
    try {
      const redisStats = await redisManager.getStats();
      const fileStats = await fileService.getFileStats();
      const allUsers = await userService.getAllUsers(true);
      const onlineUsers = await userService.getOnlineUsers();
      const allRooms = await chatService.getAllRooms();

      res.json({
        success: true,
        stats: {
          users: {
            total: allUsers.length,
            online: onlineUsers.length,
            guests: allUsers.filter((u) => u.isGuest).length,
            registered: allUsers.filter((u) => !u.isGuest).length,
          },
          rooms: {
            total: allRooms.length,
            active: allRooms.filter((r) => r.currentUsers > 0).length,
            private: allRooms.filter((r) => r.isPrivate).length,
          },
          redis: redisStats,
          files: fileStats,
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '1.0.0',
          },
        },
      });
    } catch (error) {
      logger.error('Error getting admin stats', error);
      res.status(500).json({
        success: false,
        error: 'ADMIN_STATS_ERROR',
        message: 'Failed to retrieve admin statistics',
      });
    }
  }
);

app.get(
  '/api/admin/users',
  authenticateHTTP,
  requireAdmin,
  async (req, res) => {
    try {
      const users = await userService.getAllUsers(true);
      res.json({
        success: true,
        users,
        count: users.length,
      });
    } catch (error) {
      logger.error('Error getting all users', error);
      res.status(500).json({
        success: false,
        error: 'USERS_ERROR',
        message: 'Failed to retrieve users',
      });
    }
  }
);

app.put(
  '/api/admin/users/:userId/role',
  authenticateHTTP,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const result = await userService.promoteUser(userId, role);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'PROMOTION_FAILED',
          message: result.error,
        });
      }

      logger.logAdminAction(req.user.userId, 'user-promoted', userId, {
        newRole: role,
      });

      res.json({
        success: true,
        user: result.user,
        message: `User promoted to ${role}`,
      });
    } catch (error) {
      logger.error('Error promoting user', error);
      res.status(500).json({
        success: false,
        error: 'PROMOTION_ERROR',
        message: 'Failed to promote user',
      });
    }
  }
);

// Fallback to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled API error', error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: 'File size exceeds the maximum limit',
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_FIELD',
      message: 'Unexpected file field',
    });
  }

  // JSON parsing errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
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

module.exports = app;
