const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

const redisManager = require('../config/redis');
const { authService } = require('../middleware/auth');
const {
  socketRateLimiter,
  spamDetector,
} = require('../middleware/rateLimiter');
const { validationService } = require('../middleware/validation');

const chatService = require('./services/chatService');
const userService = require('./services/userService');
const logger = require('../utils/logger');

class SocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',')
          : ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.typingUsers = new Map(); // roomId -> Set of user IDs
    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  async setupRedisAdapter() {
    try {
      const { publisher, subscriber } = redisManager.getClients();
      this.io.adapter(createAdapter(publisher, subscriber));
      console.log('✅ Socket.IO Redis adapter configured');
    } catch (error) {
      console.error('❌ Failed to setup Redis adapter:', error.message);
    }
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        // Try to authenticate with token
        const token = socket.handshake.auth.token;

        if (token) {
          await authService.validateSocketAuth(socket, next);
        } else {
          // Create guest user if no token provided
          const guestUser = await authService.createGuestUser(socket);
          console.log(`👥 Guest user connected: ${guestUser.username}`);
          next();
        }
      } catch (error) {
        console.log(`❌ Socket authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const ip = socket.handshake.address;
      const rateLimitResult = await socketRateLimiter.checkConnectionRate(ip);

      if (!rateLimitResult.allowed) {
        logger.logSecurityEvent(
          'connection-rate-limit',
          socket.userId,
          ip,
          rateLimitResult
        );
        return next(new Error('Connection rate limit exceeded'));
      }

      next();
    });

    // Logging middleware
    this.io.use((socket, next) => {
      logger.logUserAction(socket.userId, socket.username, 'socket-connected', {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
      });
      next();
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 Socket connected: ${socket.username} (${socket.id})`);

      // Set user online
      userService.setUserOnline(socket.userId, socket.id, {
        username: socket.username,
        email: socket.email,
        role: socket.role,
      });

      // Join user to default room
      this.handleJoinRoom(socket, { roomId: 'general' });

      // Send welcome message
      socket.emit('welcome', {
        message: 'Welcome to the chat!',
        user: {
          id: socket.userId,
          username: socket.username,
          role: socket.role,
        },
        timestamp: new Date().toISOString(),
      });

      // Event handlers
      socket.on('join-room', (data) => this.handleJoinRoom(socket, data));
      socket.on('leave-room', (data) => this.handleLeaveRoom(socket, data));
      socket.on('send-message', (data) => this.handleSendMessage(socket, data));
      socket.on('private-message', (data) =>
        this.handlePrivateMessage(socket, data)
      );
      socket.on('typing-start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing-stop', (data) => this.handleTypingStop(socket, data));
      socket.on('get-room-users', (data) =>
        this.handleGetRoomUsers(socket, data)
      );
      socket.on('get-online-users', () => this.handleGetOnlineUsers(socket));
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // Admin events (if user is admin/moderator)
      if (socket.role === 'admin' || socket.role === 'moderator') {
        socket.on('admin-ban-user', (data) => this.handleBanUser(socket, data));
        socket.on('admin-delete-message', (data) =>
          this.handleDeleteMessage(socket, data)
        );
        socket.on('admin-clear-room', (data) =>
          this.handleClearRoom(socket, data)
        );
      }
    });
  }

  async handleJoinRoom(socket, data) {
    try {
      // Validate input
      const validatedData = validationService.validate('joinRoom', data);
      const { roomId, password } = validatedData;

      // Leave previous rooms (except private message rooms)
      const currentRooms = Array.from(socket.rooms).filter(
        (room) => room !== socket.id && !room.startsWith('private_')
      );

      for (const room of currentRooms) {
        socket.leave(room);
        await chatService.leaveRoom(room, socket.userId);
      }

      // Join new room
      const joinResult = await chatService.joinRoom(
        roomId,
        socket.userId,
        socket.username,
        password
      );

      if (!joinResult.success) {
        socket.emit('room-error', {
          error: 'JOIN_FAILED',
          message: joinResult.error,
          roomId,
        });
        return;
      }

      // Join socket room
      socket.join(roomId);
      socket.currentRoom = roomId;

      // Get room info and recent messages
      const [roomUsers, recentMessages] = await Promise.all([
        chatService.getRoomUsers(roomId),
        chatService.getMessages(roomId, 50),
      ]);

      // Send room info to user
      socket.emit('room-joined', {
        room: joinResult.room,
        users: roomUsers,
        messages: recentMessages,
        timestamp: new Date().toISOString(),
      });

      // Notify other users in room
      socket.to(roomId).emit('user-joined', {
        user: {
          id: socket.userId,
          username: socket.username,
          role: socket.role,
        },
        roomId,
        timestamp: new Date().toISOString(),
      });

      // Send updated user list to room
      this.io.to(roomId).emit('room-users-updated', {
        roomId,
        users: roomUsers,
        count: roomUsers.length,
      });

      logger.logRoomActivity(roomId, 'user-joined', socket.userId, {
        username: socket.username,
      });
    } catch (error) {
      logger.error('Error joining room', error, {
        userId: socket.userId,
        roomId: data?.roomId,
      });
      socket.emit('room-error', {
        error: 'JOIN_ERROR',
        message: 'Failed to join room',
        roomId: data?.roomId,
      });
    }
  }

  async handleLeaveRoom(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId || !socket.rooms.has(roomId)) {
        return;
      }

      // Leave socket room
      socket.leave(roomId);

      // Remove from chat service
      await chatService.leaveRoom(roomId, socket.userId);

      // Get updated user list
      const roomUsers = await chatService.getRoomUsers(roomId);

      // Notify other users
      socket.to(roomId).emit('user-left', {
        user: {
          id: socket.userId,
          username: socket.username,
        },
        roomId,
        timestamp: new Date().toISOString(),
      });

      // Send updated user list
      this.io.to(roomId).emit('room-users-updated', {
        roomId,
        users: roomUsers,
        count: roomUsers.length,
      });

      socket.emit('room-left', { roomId });

      logger.logRoomActivity(roomId, 'user-left', socket.userId, {
        username: socket.username,
      });
    } catch (error) {
      logger.error('Error leaving room', error, {
        userId: socket.userId,
        roomId: data?.roomId,
      });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      // Rate limiting check
      const rateLimitResult = await socketRateLimiter.checkMessageRate(
        socket.userId,
        socket.id
      );

      if (!rateLimitResult.allowed) {
        socket.emit('rate-limit-exceeded', {
          error: 'MESSAGE_RATE_LIMIT',
          message: rateLimitResult.message,
          limit: rateLimitResult.limit,
          resetTime: rateLimitResult.resetTime,
        });
        return;
      }

      // Validate message
      const validatedData = validationService.validate('message', data);
      const { content, roomId, type } = validatedData;

      // Spam detection
      const spamResult = await spamDetector.checkMessage(
        socket.userId,
        content
      );

      if (spamResult.isSpam) {
        logger.logSpamDetection(
          socket.userId,
          content,
          spamResult.score,
          spamResult.action
        );

        if (spamResult.action === 'block') {
          socket.emit('message-blocked', {
            error: 'SPAM_DETECTED',
            message: 'Message blocked due to spam detection',
            score: spamResult.score,
          });
          return;
        }
      }

      // Check if user is in the room
      if (!socket.rooms.has(roomId)) {
        socket.emit('message-error', {
          error: 'NOT_IN_ROOM',
          message: 'You are not in this room',
          roomId,
        });
        return;
      }

      // Save message
      const message = await chatService.saveMessage(
        roomId,
        socket.userId,
        socket.username,
        content,
        type
      );

      if (!message) {
        socket.emit('message-error', {
          error: 'MESSAGE_SAVE_FAILED',
          message: 'Failed to save message',
        });
        return;
      }

      // Broadcast message to room
      this.io.to(roomId).emit('new-message', {
        ...message,
        user: {
          id: socket.userId,
          username: socket.username,
          role: socket.role,
        },
      });

      // Stop typing indicator for this user
      this.handleTypingStop(socket, { roomId });

      logger.logChatMessage(
        roomId,
        socket.userId,
        socket.username,
        content.length
      );
    } catch (error) {
      logger.logValidationError(error, data, { userId: socket.userId });
      socket.emit('message-error', {
        error: 'MESSAGE_ERROR',
        message: error.message || 'Failed to send message',
      });
    }
  }

  async handlePrivateMessage(socket, data) {
    try {
      // Rate limiting
      const rateLimitResult = await socketRateLimiter.checkMessageRate(
        socket.userId,
        socket.id
      );

      if (!rateLimitResult.allowed) {
        socket.emit('rate-limit-exceeded', rateLimitResult);
        return;
      }

      // Validate message
      const validatedData = validationService.validate('privateMessage', data);
      const { content, recipientId, type } = validatedData;

      // Check if recipient exists and is online
      const recipientSocketId = userService.getSocketIdByUserId(recipientId);

      if (!recipientSocketId) {
        socket.emit('private-message-error', {
          error: 'RECIPIENT_OFFLINE',
          message: 'Recipient is not online',
          recipientId,
        });
        return;
      }

      // Create private message
      const privateMessage = {
        id: require('uuid').v4(),
        senderId: socket.userId,
        senderUsername: socket.username,
        recipientId,
        content,
        type,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        isPrivate: true,
      };

      // Send to recipient
      this.io.to(recipientSocketId).emit('private-message-received', {
        ...privateMessage,
        sender: {
          id: socket.userId,
          username: socket.username,
          role: socket.role,
        },
      });

      // Confirm to sender
      socket.emit('private-message-sent', {
        ...privateMessage,
        recipient: {
          id: recipientId,
        },
      });

      logger.logUserAction(
        socket.userId,
        socket.username,
        'private-message-sent',
        { recipientId }
      );
    } catch (error) {
      logger.logValidationError(error, data, { userId: socket.userId });
      socket.emit('private-message-error', {
        error: 'PRIVATE_MESSAGE_ERROR',
        message: error.message || 'Failed to send private message',
      });
    }
  }

  async handleTypingStart(socket, data) {
    try {
      const validatedData = validationService.validate('typing', {
        ...data,
        isTyping: true,
      });
      const { roomId } = validatedData;

      if (!socket.rooms.has(roomId)) {
        return;
      }

      // Add to typing users
      if (!this.typingUsers.has(roomId)) {
        this.typingUsers.set(roomId, new Set());
      }
      this.typingUsers.get(roomId).add(socket.userId);

      // Notify other users in room
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        roomId,
        isTyping: true,
      });

      // Clear typing indicator after timeout
      const timeout = parseInt(process.env.TYPING_TIMEOUT) || 3000;
      setTimeout(() => {
        this.handleTypingStop(socket, { roomId });
      }, timeout);
    } catch (error) {
      // Ignore typing errors to avoid spam
    }
  }

  async handleTypingStop(socket, data) {
    try {
      const { roomId } = data;

      if (!this.typingUsers.has(roomId)) {
        return;
      }

      // Remove from typing users
      this.typingUsers.get(roomId).delete(socket.userId);

      // Notify other users in room
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        roomId,
        isTyping: false,
      });
    } catch (error) {
      // Ignore typing errors
    }
  }

  async handleGetRoomUsers(socket, data) {
    try {
      const { roomId } = data;
      const roomUsers = await chatService.getRoomUsers(roomId);

      socket.emit('room-users', {
        roomId,
        users: roomUsers,
        count: roomUsers.length,
      });
    } catch (error) {
      socket.emit('room-users-error', {
        error: 'ROOM_USERS_ERROR',
        message: 'Failed to get room users',
      });
    }
  }

  async handleGetOnlineUsers(socket) {
    try {
      const onlineUsers = await userService.getOnlineUsers();

      socket.emit('online-users', {
        users: onlineUsers,
        count: onlineUsers.length,
      });
    } catch (error) {
      socket.emit('online-users-error', {
        error: 'ONLINE_USERS_ERROR',
        message: 'Failed to get online users',
      });
    }
  }

  async handleDisconnect(socket) {
    try {
      console.log(`🔌 Socket disconnected: ${socket.username} (${socket.id})`);

      // Remove from online users
      await userService.setUserOffline(socket.userId, socket.id);

      // Leave all rooms
      const rooms = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );

      for (const roomId of rooms) {
        if (!roomId.startsWith('private_')) {
          await chatService.leaveRoom(roomId, socket.userId);

          // Notify room users
          socket.to(roomId).emit('user-left', {
            user: {
              id: socket.userId,
              username: socket.username,
            },
            roomId,
            timestamp: new Date().toISOString(),
          });

          // Update room user list
          const roomUsers = await chatService.getRoomUsers(roomId);
          this.io.to(roomId).emit('room-users-updated', {
            roomId,
            users: roomUsers,
            count: roomUsers.length,
          });
        }
      }

      // Remove from typing users
      for (const [roomId, typingSet] of this.typingUsers.entries()) {
        if (typingSet.has(socket.userId)) {
          typingSet.delete(socket.userId);
          this.io.to(roomId).emit('user-typing', {
            userId: socket.userId,
            username: socket.username,
            roomId,
            isTyping: false,
          });
        }
      }

      logger.logUserAction(
        socket.userId,
        socket.username,
        'socket-disconnected',
        {
          socketId: socket.id,
        }
      );
    } catch (error) {
      logger.error('Error handling disconnect', error, {
        userId: socket.userId,
      });
    }
  }

  // Admin event handlers
  async handleBanUser(socket, data) {
    try {
      if (socket.role !== 'admin' && socket.role !== 'moderator') {
        return;
      }

      const { userId, reason } = data;

      // Deactivate user
      const result = await userService.deactivateUser(userId);

      if (result.success) {
        // Disconnect user's socket
        const targetSocketId = userService.getSocketIdByUserId(userId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('banned', {
            reason: reason || 'Banned by moderator',
            timestamp: new Date().toISOString(),
          });
          this.io.sockets.sockets.get(targetSocketId)?.disconnect(true);
        }

        logger.logAdminAction(socket.userId, 'user-banned', userId, { reason });
      }
    } catch (error) {
      logger.error('Error banning user', error, { adminId: socket.userId });
    }
  }

  async handleDeleteMessage(socket, data) {
    try {
      if (socket.role !== 'admin' && socket.role !== 'moderator') {
        return;
      }

      const { messageId, roomId } = data;

      // In a real app, you'd delete from database
      // For now, just broadcast the deletion
      this.io.to(roomId).emit('message-deleted', {
        messageId,
        roomId,
        deletedBy: socket.username,
        timestamp: new Date().toISOString(),
      });

      logger.logAdminAction(socket.userId, 'message-deleted', messageId, {
        roomId,
      });
    } catch (error) {
      logger.error('Error deleting message', error, { adminId: socket.userId });
    }
  }

  async handleClearRoom(socket, data) {
    try {
      if (socket.role !== 'admin') {
        return;
      }

      const { roomId } = data;

      // Clear room messages (in Redis)
      const messagesKey = `chat:${roomId}:messages`;
      await redisManager.client.del(messagesKey);

      // Notify room
      this.io.to(roomId).emit('room-cleared', {
        roomId,
        clearedBy: socket.username,
        timestamp: new Date().toISOString(),
      });

      logger.logAdminAction(socket.userId, 'room-cleared', roomId);
    } catch (error) {
      logger.error('Error clearing room', error, { adminId: socket.userId });
    }
  }

  // Get server statistics
  getStats() {
    return {
      connectedSockets: this.io.sockets.sockets.size,
      rooms: this.io.sockets.adapter.rooms.size,
      typingUsers: Array.from(this.typingUsers.entries()).reduce(
        (acc, [roomId, users]) => {
          acc[roomId] = users.size;
          return acc;
        },
        {}
      ),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = SocketHandler;
