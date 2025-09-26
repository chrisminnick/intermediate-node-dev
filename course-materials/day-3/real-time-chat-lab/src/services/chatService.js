const redisManager = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

class ChatService {
  constructor() {
    this.rooms = new Map(); // In-memory room cache
    this.defaultRooms = ['general', 'random', 'help'];
    this.maxRoomUsers = 100;
  }

  async initialize() {
    // Create default rooms if they don't exist
    for (const roomId of this.defaultRooms) {
      await this.createRoom(roomId, {
        name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
        description: `Default ${roomId} chat room`,
        isPrivate: false,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });
    }
    console.log('✅ Chat service initialized with default rooms');
  }

  async createRoom(roomId, roomData) {
    try {
      const roomKey = `room:${roomId}:info`;

      // Check if room already exists
      const existingRoom = await redisManager.client.exists(roomKey);
      if (existingRoom) {
        return false; // Room already exists
      }

      const room = {
        id: roomId,
        name: roomData.name || roomId,
        description: roomData.description || '',
        isPrivate: roomData.isPrivate || false,
        password: roomData.password || null,
        maxUsers: roomData.maxUsers || this.maxRoomUsers,
        createdBy: roomData.createdBy || 'system',
        createdAt: roomData.createdAt || new Date().toISOString(),
        messageCount: 0,
        lastActivity: new Date().toISOString(),
      };

      // Save room info to Redis
      await redisManager.client.hSet(roomKey, room);

      // Cache in memory
      this.rooms.set(roomId, room);

      console.log(`🏠 Room created: ${roomId} (${room.name})`);
      return room;
    } catch (error) {
      console.error('❌ Error creating room:', error.message);
      return false;
    }
  }

  async getRoomInfo(roomId) {
    try {
      // Check memory cache first
      if (this.rooms.has(roomId)) {
        return this.rooms.get(roomId);
      }

      // Get from Redis
      const roomKey = `room:${roomId}:info`;
      const roomData = await redisManager.client.hGetAll(roomKey);

      if (Object.keys(roomData).length === 0) {
        return null; // Room doesn't exist
      }

      // Convert string fields back to appropriate types
      const room = {
        ...roomData,
        isPrivate: roomData.isPrivate === 'true',
        maxUsers: parseInt(roomData.maxUsers) || this.maxRoomUsers,
        messageCount: parseInt(roomData.messageCount) || 0,
      };

      // Cache in memory
      this.rooms.set(roomId, room);
      return room;
    } catch (error) {
      console.error('❌ Error getting room info:', error.message);
      return null;
    }
  }

  async updateRoomActivity(roomId) {
    try {
      const roomKey = `room:${roomId}:info`;
      const now = new Date().toISOString();

      await redisManager.client.hSet(roomKey, 'lastActivity', now);

      // Update memory cache
      if (this.rooms.has(roomId)) {
        const room = this.rooms.get(roomId);
        room.lastActivity = now;
        this.rooms.set(roomId, room);
      }
    } catch (error) {
      console.error('❌ Error updating room activity:', error.message);
    }
  }

  async saveMessage(roomId, userId, username, content, type = 'text') {
    try {
      const message = {
        id: uuidv4(),
        roomId,
        userId,
        username,
        content,
        type,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
      };

      // Save to Redis
      const success = await redisManager.saveMessage(roomId, message);

      if (success) {
        // Update room message count and activity
        await this.incrementMessageCount(roomId);
        await this.updateRoomActivity(roomId);

        console.log(`💬 Message saved: ${username} in ${roomId}`);
        return message;
      }

      return null;
    } catch (error) {
      console.error('❌ Error saving message:', error.message);
      return null;
    }
  }

  async getMessages(roomId, limit = 50, offset = 0) {
    try {
      const messages = await redisManager.getMessages(roomId, limit, offset);
      return messages;
    } catch (error) {
      console.error('❌ Error getting messages:', error.message);
      return [];
    }
  }

  async incrementMessageCount(roomId) {
    try {
      const roomKey = `room:${roomId}:info`;
      await redisManager.client.hIncrBy(roomKey, 'messageCount', 1);

      // Update memory cache
      if (this.rooms.has(roomId)) {
        const room = this.rooms.get(roomId);
        room.messageCount = (room.messageCount || 0) + 1;
        this.rooms.set(roomId, room);
      }
    } catch (error) {
      console.error('❌ Error incrementing message count:', error.message);
    }
  }

  async joinRoom(roomId, userId, username, password = null) {
    try {
      // Get room info
      const room = await this.getRoomInfo(roomId);
      if (!room) {
        return { success: false, error: 'Room does not exist' };
      }

      // Check password for private rooms
      if (room.isPrivate && room.password !== password) {
        return { success: false, error: 'Invalid room password' };
      }

      // Check room capacity
      const currentUsers = await redisManager.getRoomUsers(roomId);
      if (currentUsers.length >= room.maxUsers) {
        return { success: false, error: 'Room is full' };
      }

      // Check if user is already in room
      const isAlreadyInRoom = currentUsers.some(
        (user) => user.userId === userId
      );
      if (isAlreadyInRoom) {
        return { success: true, message: 'Already in room', room };
      }

      // Add user to room
      const success = await redisManager.addUserToRoom(
        roomId,
        userId,
        username
      );
      if (success) {
        console.log(`👥 User ${username} joined room ${roomId}`);
        return { success: true, room };
      }

      return { success: false, error: 'Failed to join room' };
    } catch (error) {
      console.error('❌ Error joining room:', error.message);
      return { success: false, error: 'Internal server error' };
    }
  }

  async leaveRoom(roomId, userId) {
    try {
      const success = await redisManager.removeUserFromRoom(roomId, userId);
      if (success) {
        console.log(`👋 User ${userId} left room ${roomId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error leaving room:', error.message);
      return false;
    }
  }

  async getRoomUsers(roomId) {
    try {
      return await redisManager.getRoomUsers(roomId);
    } catch (error) {
      console.error('❌ Error getting room users:', error.message);
      return [];
    }
  }

  async getAllRooms() {
    try {
      const keys = await redisManager.client.keys('room:*:info');
      const rooms = [];

      for (const key of keys) {
        const roomData = await redisManager.client.hGetAll(key);
        if (Object.keys(roomData).length > 0) {
          const room = {
            ...roomData,
            isPrivate: roomData.isPrivate === 'true',
            maxUsers: parseInt(roomData.maxUsers) || this.maxRoomUsers,
            messageCount: parseInt(roomData.messageCount) || 0,
          };

          // Get current user count
          const users = await this.getRoomUsers(room.id);
          room.currentUsers = users.length;

          rooms.push(room);
        }
      }

      // Sort by last activity
      rooms.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      return rooms;
    } catch (error) {
      console.error('❌ Error getting all rooms:', error.message);
      return [];
    }
  }

  async deleteRoom(roomId, userId) {
    try {
      // Get room info to check permissions
      const room = await this.getRoomInfo(roomId);
      if (!room) {
        return { success: false, error: 'Room does not exist' };
      }

      // Only allow deletion by room creator or admin
      if (room.createdBy !== userId && userId !== 'admin') {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Don't allow deletion of default rooms
      if (this.defaultRooms.includes(roomId)) {
        return { success: false, error: 'Cannot delete default rooms' };
      }

      // Delete room data
      const roomKey = `room:${roomId}:info`;
      const usersKey = `room:${roomId}:users`;
      const messagesKey = `chat:${roomId}:messages`;

      await Promise.all([
        redisManager.client.del(roomKey),
        redisManager.client.del(usersKey),
        redisManager.client.del(messagesKey),
      ]);

      // Remove from memory cache
      this.rooms.delete(roomId);

      console.log(`🗑️ Room deleted: ${roomId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting room:', error.message);
      return { success: false, error: 'Internal server error' };
    }
  }

  async searchMessages(roomId, query, limit = 20) {
    try {
      const messages = await this.getMessages(roomId, 500); // Get more messages for search

      const filteredMessages = messages.filter(
        (message) =>
          message.content.toLowerCase().includes(query.toLowerCase()) ||
          message.username.toLowerCase().includes(query.toLowerCase())
      );

      return filteredMessages.slice(0, limit);
    } catch (error) {
      console.error('❌ Error searching messages:', error.message);
      return [];
    }
  }

  async getRoomStats(roomId) {
    try {
      const room = await this.getRoomInfo(roomId);
      if (!room) {
        return null;
      }

      const users = await this.getRoomUsers(roomId);
      const messages = await redisManager.getMessages(roomId, 1); // Get latest message

      return {
        ...room,
        currentUsers: users.length,
        onlineUsers: users,
        latestMessage: messages[0] || null,
        stats: {
          totalMessages: room.messageCount || 0,
          activeUsers: users.length,
          createdDaysAgo: Math.floor(
            (Date.now() - new Date(room.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        },
      };
    } catch (error) {
      console.error('❌ Error getting room stats:', error.message);
      return null;
    }
  }

  // Clean up inactive rooms (can be called periodically)
  async cleanupInactiveRooms(daysInactive = 30) {
    try {
      const rooms = await this.getAllRooms();
      const cutoffDate = new Date(
        Date.now() - daysInactive * 24 * 60 * 60 * 1000
      );
      let cleanedCount = 0;

      for (const room of rooms) {
        const lastActivity = new Date(room.lastActivity);

        // Don't clean up default rooms or recently active rooms
        if (this.defaultRooms.includes(room.id) || lastActivity > cutoffDate) {
          continue;
        }

        // Only clean up rooms with no users
        if (room.currentUsers === 0) {
          const result = await this.deleteRoom(room.id, 'system');
          if (result.success) {
            cleanedCount++;
          }
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} inactive rooms`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error cleaning up inactive rooms:', error.message);
      return 0;
    }
  }
}

const chatService = new ChatService();

module.exports = chatService;
