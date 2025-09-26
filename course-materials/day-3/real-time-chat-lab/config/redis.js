const redis = require('redis');
const { EventEmitter } = require('events');

class RedisManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    try {
      console.log('🔄 Connecting to Redis...');

      // Main client for regular operations
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB) || 0,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('❌ Redis server refused connection');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('❌ Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > this.maxReconnectAttempts) {
            console.error(
              `❌ Redis max reconnection attempts (${this.maxReconnectAttempts}) exceeded`
            );
            return new Error('Max reconnection attempts exceeded');
          }
          // Exponential backoff with jitter
          const delay =
            Math.min(options.attempt * 100, 3000) + Math.random() * 1000;
          console.log(
            `⏳ Redis reconnecting in ${Math.round(delay)}ms (attempt ${
              options.attempt
            })`
          );
          return delay;
        },
      });

      // Publisher client for Socket.IO adapter
      this.publisher = this.client.duplicate();

      // Subscriber client for Socket.IO adapter
      this.subscriber = this.client.duplicate();

      // Set up event handlers
      this.setupEventHandlers();

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Redis connected successfully');
      this.emit('connected');

      return this;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Main client events
    this.client.on('error', (error) => {
      console.error('❌ Redis client error:', error.message);
      this.isConnected = false;
      this.emit('error', error);
    });

    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      console.log(
        `🔄 Redis client reconnecting... (attempt ${this.reconnectAttempts})`
      );
      this.emit('reconnecting', this.reconnectAttempts);
    });

    this.client.on('end', () => {
      console.log('🔌 Redis client connection ended');
      this.isConnected = false;
      this.emit('disconnected');
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      console.error('❌ Redis publisher error:', error.message);
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      console.error('❌ Redis subscriber error:', error.message);
    });
  }

  async disconnect() {
    try {
      console.log('🔄 Disconnecting from Redis...');

      if (this.client && this.client.isOpen) {
        await this.client.quit();
      }
      if (this.publisher && this.publisher.isOpen) {
        await this.publisher.quit();
      }
      if (this.subscriber && this.subscriber.isOpen) {
        await this.subscriber.quit();
      }

      this.isConnected = false;
      console.log('✅ Redis disconnected successfully');
      this.emit('disconnected');
    } catch (error) {
      console.error('❌ Redis disconnection error:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) {
        return {
          status: 'unhealthy',
          connected: false,
          error: 'Not connected to Redis',
        };
      }

      const startTime = Date.now();
      const pong = await this.client.ping();
      const responseTime = Date.now() - startTime;

      const info = await this.client.info('server');
      const memory = await this.client.info('memory');

      return {
        status: 'healthy',
        connected: true,
        responseTime: `${responseTime}ms`,
        ping: pong,
        version: this.extractInfoValue(info, 'redis_version'),
        usedMemory: this.extractInfoValue(memory, 'used_memory_human'),
        connectedClients: this.extractInfoValue(info, 'connected_clients'),
        uptime: this.extractInfoValue(info, 'uptime_in_seconds'),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
      };
    }
  }

  extractInfoValue(infoString, key) {
    const match = infoString.match(new RegExp(`${key}:(.+)`));
    return match ? match[1].trim() : 'unknown';
  }

  // Chat-specific Redis operations
  async saveMessage(roomId, message) {
    try {
      const messageKey = `chat:${roomId}:messages`;
      const messageData = JSON.stringify({
        id: message.id,
        userId: message.userId,
        username: message.username,
        content: message.content,
        timestamp: message.timestamp,
        type: message.type || 'text',
      });

      // Add to sorted set with timestamp as score for chronological ordering
      await this.client.zAdd(messageKey, {
        score: message.timestamp,
        value: messageData,
      });

      // Keep only the most recent messages (configurable limit)
      const maxMessages = parseInt(process.env.MAX_CHAT_HISTORY) || 100;
      await this.client.zRemRangeByRank(messageKey, 0, -(maxMessages + 1));

      return true;
    } catch (error) {
      console.error('❌ Error saving message to Redis:', error.message);
      return false;
    }
  }

  async getMessages(roomId, limit = 50, offset = 0) {
    try {
      const messageKey = `chat:${roomId}:messages`;

      // Get messages in reverse chronological order (newest first)
      const messages = await this.client.zRevRange(
        messageKey,
        offset,
        offset + limit - 1
      );

      return messages.map((msg) => JSON.parse(msg)).reverse(); // Return in chronological order
    } catch (error) {
      console.error('❌ Error retrieving messages from Redis:', error.message);
      return [];
    }
  }

  async saveUserSession(userId, sessionData) {
    try {
      const sessionKey = `session:${userId}`;
      await this.client.hSet(sessionKey, sessionData);
      await this.client.expire(sessionKey, 24 * 60 * 60); // 24 hours
      return true;
    } catch (error) {
      console.error('❌ Error saving user session:', error.message);
      return false;
    }
  }

  async getUserSession(userId) {
    try {
      const sessionKey = `session:${userId}`;
      const session = await this.client.hGetAll(sessionKey);
      return Object.keys(session).length > 0 ? session : null;
    } catch (error) {
      console.error('❌ Error retrieving user session:', error.message);
      return null;
    }
  }

  async addUserToRoom(roomId, userId, username) {
    try {
      const roomKey = `room:${roomId}:users`;
      await this.client.sAdd(
        roomKey,
        JSON.stringify({ userId, username, joinedAt: Date.now() })
      );
      return true;
    } catch (error) {
      console.error('❌ Error adding user to room:', error.message);
      return false;
    }
  }

  async removeUserFromRoom(roomId, userId) {
    try {
      const roomKey = `room:${roomId}:users`;
      const members = await this.client.sMembers(roomKey);

      for (const member of members) {
        const userData = JSON.parse(member);
        if (userData.userId === userId) {
          await this.client.sRem(roomKey, member);
          break;
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Error removing user from room:', error.message);
      return false;
    }
  }

  async getRoomUsers(roomId) {
    try {
      const roomKey = `room:${roomId}:users`;
      const members = await this.client.sMembers(roomKey);
      return members.map((member) => JSON.parse(member));
    } catch (error) {
      console.error('❌ Error getting room users:', error.message);
      return [];
    }
  }

  async setUserOnline(userId, socketId) {
    try {
      const onlineKey = 'users:online';
      await this.client.hSet(
        onlineKey,
        userId,
        JSON.stringify({
          socketId,
          timestamp: Date.now(),
        })
      );
      return true;
    } catch (error) {
      console.error('❌ Error setting user online:', error.message);
      return false;
    }
  }

  async setUserOffline(userId) {
    try {
      const onlineKey = 'users:online';
      await this.client.hDel(onlineKey, userId);
      return true;
    } catch (error) {
      console.error('❌ Error setting user offline:', error.message);
      return false;
    }
  }

  async getOnlineUsers() {
    try {
      const onlineKey = 'users:online';
      const users = await this.client.hGetAll(onlineKey);

      const onlineUsers = {};
      for (const [userId, data] of Object.entries(users)) {
        onlineUsers[userId] = JSON.parse(data);
      }

      return onlineUsers;
    } catch (error) {
      console.error('❌ Error getting online users:', error.message);
      return {};
    }
  }

  // Rate limiting operations
  async checkRateLimit(userId, action, limit, windowMs) {
    try {
      const key = `ratelimit:${userId}:${action}`;
      const current = await this.client.incr(key);

      if (current === 1) {
        await this.client.expire(key, Math.ceil(windowMs / 1000));
      }

      return {
        allowed: current <= limit,
        count: current,
        limit,
        resetTime: windowMs,
      };
    } catch (error) {
      console.error('❌ Error checking rate limit:', error.message);
      return { allowed: true, count: 0, limit, resetTime: windowMs };
    }
  }

  // Get statistics
  async getStats() {
    try {
      const keys = await this.client.keys('*');
      const messageKeys = keys.filter((key) => key.includes(':messages'));
      const userKeys = keys.filter((key) => key.includes('session:'));
      const roomKeys = keys.filter(
        (key) => key.includes('room:') && key.includes(':users')
      );

      const totalMessages = await Promise.all(
        messageKeys.map((key) => this.client.zCard(key))
      );

      const totalRooms = roomKeys.length;
      const totalUsers = userKeys.length;
      const onlineUsers = Object.keys(await this.getOnlineUsers()).length;

      return {
        totalKeys: keys.length,
        totalMessages: totalMessages.reduce((sum, count) => sum + count, 0),
        totalRooms,
        totalUsers,
        onlineUsers,
        messageKeys: messageKeys.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error getting Redis stats:', error.message);
      return null;
    }
  }

  getClients() {
    return {
      client: this.client,
      publisher: this.publisher,
      subscriber: this.subscriber,
    };
  }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;
