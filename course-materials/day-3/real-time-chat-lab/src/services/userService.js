const redisManager = require('../config/redis');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class UserService {
  constructor() {
    this.onlineUsers = new Map(); // Socket ID -> User mapping
    this.userSockets = new Map(); // User ID -> Socket ID mapping
  }

  async createUser(userData) {
    try {
      const userId = uuidv4();
      const now = new Date().toISOString();

      const user = {
        id: userId,
        username: userData.username,
        email: userData.email || null,
        role: userData.role || 'user',
        avatar: userData.avatar || this.generateAvatarUrl(userData.username),
        isGuest: userData.isGuest || false,
        createdAt: now,
        lastLogin: now,
        isActive: true,
        preferences: {
          theme: 'light',
          notifications: true,
          soundEnabled: true,
        },
      };

      // Hash password if provided
      if (userData.password) {
        user.passwordHash = await bcrypt.hash(userData.password, 10);
      }

      // Save to Redis
      const userKey = `user:${userId}`;
      await redisManager.client.hSet(userKey, user);

      // Create initial session
      await redisManager.saveUserSession(userId, {
        ...user,
        lastActivity: Date.now(),
      });

      console.log(`👤 User created: ${user.username} (${userId})`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error creating user:', error.message);
      return { success: false, error: 'Failed to create user' };
    }
  }

  async authenticateUser(username, password) {
    try {
      // Find user by username
      const user = await this.findUserByUsername(username);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check password for non-guest users
      if (!user.isGuest && user.passwordHash) {
        const isValidPassword = await bcrypt.compare(
          password,
          user.passwordHash
        );
        if (!isValidPassword) {
          return { success: false, error: 'Invalid password' };
        }
      }

      // Update last login
      await this.updateLastLogin(user.id);

      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error authenticating user:', error.message);
      return { success: false, error: 'Authentication failed' };
    }
  }

  async findUserByUsername(username) {
    try {
      // Get all user keys
      const userKeys = await redisManager.client.keys('user:*');

      for (const key of userKeys) {
        const userData = await redisManager.client.hGetAll(key);
        if (userData.username === username) {
          return {
            ...userData,
            isGuest: userData.isGuest === 'true',
            isActive: userData.isActive === 'true',
            preferences: userData.preferences
              ? JSON.parse(userData.preferences)
              : {},
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error finding user by username:', error.message);
      return null;
    }
  }

  async findUserById(userId) {
    try {
      const userKey = `user:${userId}`;
      const userData = await redisManager.client.hGetAll(userKey);

      if (Object.keys(userData).length === 0) {
        return null;
      }

      return {
        ...userData,
        isGuest: userData.isGuest === 'true',
        isActive: userData.isActive === 'true',
        preferences: userData.preferences
          ? JSON.parse(userData.preferences)
          : {},
      };
    } catch (error) {
      console.error('❌ Error finding user by ID:', error.message);
      return null;
    }
  }

  async updateUser(userId, updates) {
    try {
      const userKey = `user:${userId}`;
      const currentUser = await this.findUserById(userId);

      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      // Prepare updates
      const allowedUpdates = ['username', 'email', 'avatar', 'preferences'];
      const filteredUpdates = {};

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          if (key === 'preferences') {
            filteredUpdates[key] = JSON.stringify(value);
          } else {
            filteredUpdates[key] = value;
          }
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return { success: false, error: 'No valid updates provided' };
      }

      // Check username uniqueness if updating username
      if (
        filteredUpdates.username &&
        filteredUpdates.username !== currentUser.username
      ) {
        const existingUser = await this.findUserByUsername(
          filteredUpdates.username
        );
        if (existingUser) {
          return { success: false, error: 'Username already taken' };
        }
      }

      // Update user data
      await redisManager.client.hSet(userKey, filteredUpdates);

      // Update session
      const updatedUser = await this.findUserById(userId);
      await redisManager.saveUserSession(userId, {
        ...updatedUser,
        lastActivity: Date.now(),
      });

      console.log(`📝 User updated: ${userId}`);
      return { success: true, user: this.sanitizeUser(updatedUser) };
    } catch (error) {
      console.error('❌ Error updating user:', error.message);
      return { success: false, error: 'Failed to update user' };
    }
  }

  async updateLastLogin(userId) {
    try {
      const userKey = `user:${userId}`;
      const now = new Date().toISOString();
      await redisManager.client.hSet(userKey, 'lastLogin', now);
    } catch (error) {
      console.error('❌ Error updating last login:', error.message);
    }
  }

  async setUserOnline(userId, socketId, userData = {}) {
    try {
      // Update Redis
      await redisManager.setUserOnline(userId, socketId);

      // Update local maps
      this.onlineUsers.set(socketId, { userId, ...userData });
      this.userSockets.set(userId, socketId);

      console.log(
        `🟢 User online: ${userData.username || userId} (${socketId})`
      );
      return true;
    } catch (error) {
      console.error('❌ Error setting user online:', error.message);
      return false;
    }
  }

  async setUserOffline(userId, socketId) {
    try {
      // Update Redis
      await redisManager.setUserOffline(userId);

      // Update local maps
      this.onlineUsers.delete(socketId);
      this.userSockets.delete(userId);

      console.log(`🔴 User offline: ${userId} (${socketId})`);
      return true;
    } catch (error) {
      console.error('❌ Error setting user offline:', error.message);
      return false;
    }
  }

  async getOnlineUsers() {
    try {
      const redisOnlineUsers = await redisManager.getOnlineUsers();
      const onlineUsersList = [];

      for (const [userId, data] of Object.entries(redisOnlineUsers)) {
        const userData = JSON.parse(data);
        const user = await this.findUserById(userId);

        if (user) {
          onlineUsersList.push({
            ...this.sanitizeUser(user),
            socketId: userData.socketId,
            onlineSince: userData.timestamp,
          });
        }
      }

      return onlineUsersList;
    } catch (error) {
      console.error('❌ Error getting online users:', error.message);
      return [];
    }
  }

  async getUserStats(userId) {
    try {
      const user = await this.findUserById(userId);
      if (!user) {
        return null;
      }

      // Get user's message count across all rooms
      const messageKeys = await redisManager.client.keys('chat:*:messages');
      let totalMessages = 0;

      for (const key of messageKeys) {
        const messages = await redisManager.client.zRange(key, 0, -1);
        const userMessages = messages.filter((msg) => {
          const parsed = JSON.parse(msg);
          return parsed.userId === userId;
        });
        totalMessages += userMessages.length;
      }

      // Get rooms user is in
      const roomKeys = await redisManager.client.keys('room:*:users');
      const activeRooms = [];

      for (const key of roomKeys) {
        const members = await redisManager.client.sMembers(key);
        const isInRoom = members.some((member) => {
          const userData = JSON.parse(member);
          return userData.userId === userId;
        });

        if (isInRoom) {
          const roomId = key.split(':')[1];
          activeRooms.push(roomId);
        }
      }

      return {
        user: this.sanitizeUser(user),
        stats: {
          totalMessages,
          activeRooms: activeRooms.length,
          memberSince: user.createdAt,
          lastActive: user.lastLogin,
          daysSinceJoined: Math.floor(
            (Date.now() - new Date(user.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        },
      };
    } catch (error) {
      console.error('❌ Error getting user stats:', error.message);
      return null;
    }
  }

  async getAllUsers(includeGuests = false) {
    try {
      const userKeys = await redisManager.client.keys('user:*');
      const users = [];

      for (const key of userKeys) {
        const userData = await redisManager.client.hGetAll(key);
        const user = {
          ...userData,
          isGuest: userData.isGuest === 'true',
          isActive: userData.isActive === 'true',
          preferences: userData.preferences
            ? JSON.parse(userData.preferences)
            : {},
        };

        if (includeGuests || !user.isGuest) {
          users.push(this.sanitizeUser(user));
        }
      }

      // Sort by creation date
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return users;
    } catch (error) {
      console.error('❌ Error getting all users:', error.message);
      return [];
    }
  }

  async deactivateUser(userId) {
    try {
      const userKey = `user:${userId}`;
      await redisManager.client.hSet(userKey, 'isActive', 'false');

      // Remove from online users
      await this.setUserOffline(userId, this.userSockets.get(userId));

      console.log(`🚫 User deactivated: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deactivating user:', error.message);
      return { success: false, error: 'Failed to deactivate user' };
    }
  }

  async promoteUser(userId, newRole) {
    try {
      const allowedRoles = ['user', 'moderator', 'admin'];
      if (!allowedRoles.includes(newRole)) {
        return { success: false, error: 'Invalid role' };
      }

      const userKey = `user:${userId}`;
      await redisManager.client.hSet(userKey, 'role', newRole);

      // Update session
      const user = await this.findUserById(userId);
      await redisManager.saveUserSession(userId, {
        ...user,
        lastActivity: Date.now(),
      });

      console.log(`⬆️ User promoted: ${userId} to ${newRole}`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error promoting user:', error.message);
      return { success: false, error: 'Failed to promote user' };
    }
  }

  generateAvatarUrl(username) {
    // Generate a simple avatar URL using a service like Gravatar or UI Avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      username
    )}&background=random&color=fff&size=128`;
  }

  sanitizeUser(user) {
    // Remove sensitive information before sending to client
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return sanitized;
  }

  getUserBySocketId(socketId) {
    return this.onlineUsers.get(socketId);
  }

  getSocketIdByUserId(userId) {
    return this.userSockets.get(userId);
  }

  // Clean up guest users periodically
  async cleanupGuestUsers(hoursOld = 24) {
    try {
      const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
      const userKeys = await redisManager.client.keys('user:*');
      let cleanedCount = 0;

      for (const key of userKeys) {
        const userData = await redisManager.client.hGetAll(key);

        if (userData.isGuest === 'true') {
          const lastActivity = await redisManager.getUserSession(userData.id);

          if (
            !lastActivity ||
            parseInt(lastActivity.lastActivity) < cutoffTime
          ) {
            // Delete guest user and session
            await redisManager.client.del(key);
            await redisManager.client.del(`session:${userData.id}`);
            cleanedCount++;
          }
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} old guest users`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error cleaning up guest users:', error.message);
      return 0;
    }
  }
}

const userService = new UserService();

module.exports = userService;
