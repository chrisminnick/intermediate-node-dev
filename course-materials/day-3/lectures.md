# Day 3: State Management, Caching & Real-Time Communication

## Session 1: Caching Strategies with Redis & Session Management

**Duration**: 90 minutes  
**Objective**: Implement distributed caching and session management for scalable applications

### Learning Outcomes

- Design effective caching strategies for different use cases
- Implement Redis for caching, session storage, and pub/sub
- Handle cache invalidation and consistency
- Manage sessions in distributed environments
- Optimize application performance with strategic caching

### Lecture Content

#### 1. Caching Fundamentals (30 minutes)

**Cache Patterns:**

- **Cache-Aside (Lazy Loading)**: Application manages cache
- **Write-Through**: Write to cache and database simultaneously
- **Write-Behind (Write-Back)**: Write to cache first, database later
- **Refresh-Ahead**: Proactively refresh cache before expiration

**Cache Levels:**

```
Browser Cache → CDN → Reverse Proxy → Application Cache → Database Cache
```

**Redis Data Structures:**

- Strings: Simple key-value pairs
- Hashes: Objects with multiple fields
- Lists: Ordered collections
- Sets: Unordered unique collections
- Sorted Sets: Ordered sets with scores
- Streams: Log-like data structure

#### 2. Distributed Session Management (30 minutes)

**Session Storage Options:**

- Memory (single instance only)
- Database (slower but persistent)
- Redis (fast and scalable)
- JWT (stateless but limited)

**Session Clustering Strategies:**

- Sticky sessions (session affinity)
- Session replication
- Centralized session store
- Hybrid approaches

#### 3. Performance Optimization (30 minutes)

**Cache Key Design:**

- Hierarchical naming conventions
- Version-aware keys
- User-specific vs global caching
- Time-based invalidation strategies

**Monitoring and Metrics:**

- Cache hit/miss ratios
- Response time improvements
- Memory usage patterns
- Eviction policies

### Code Examples

#### Redis Cache Manager

```javascript
const Redis = require('ioredis');
const { promisify } = require('util');

class CacheManager {
  constructor(redisConfig = {}) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      ...redisConfig,
    });

    this.defaultTTL = 3600; // 1 hour
    this.keyPrefix = process.env.CACHE_PREFIX || 'app:';
  }

  // Cache-aside pattern implementation
  async get(key, fetchFunction, ttl = this.defaultTTL) {
    const cacheKey = this.buildKey(key);

    try {
      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Cache miss - fetch from source
      const data = await fetchFunction();

      // Store in cache with TTL
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));

      return data;
    } catch (error) {
      console.error('Cache error:', error);
      // Fallback to direct fetch on cache errors
      return await fetchFunction();
    }
  }

  // Write-through pattern
  async set(key, data, ttl = this.defaultTTL) {
    const cacheKey = this.buildKey(key);

    try {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Hash operations for object caching
  async hset(key, field, value, ttl = this.defaultTTL) {
    const cacheKey = this.buildKey(key);

    try {
      await this.redis.hset(cacheKey, field, JSON.stringify(value));
      await this.redis.expire(cacheKey, ttl);
      return true;
    } catch (error) {
      console.error('Cache hset error:', error);
      return false;
    }
  }

  async hget(key, field) {
    const cacheKey = this.buildKey(key);

    try {
      const value = await this.redis.hget(cacheKey, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache hget error:', error);
      return null;
    }
  }

  // List operations for activity feeds
  async lpush(key, ...values) {
    const cacheKey = this.buildKey(key);

    try {
      const serializedValues = values.map((v) => JSON.stringify(v));
      await this.redis.lpush(cacheKey, ...serializedValues);
      return true;
    } catch (error) {
      console.error('Cache lpush error:', error);
      return false;
    }
  }

  async lrange(key, start = 0, stop = -1) {
    const cacheKey = this.buildKey(key);

    try {
      const values = await this.redis.lrange(cacheKey, start, stop);
      return values.map((v) => JSON.parse(v));
    } catch (error) {
      console.error('Cache lrange error:', error);
      return [];
    }
  }

  // Cache invalidation patterns
  async invalidate(pattern) {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  // Distributed locking
  async acquireLock(lockKey, ttl = 30, retries = 3) {
    const key = this.buildKey(`lock:${lockKey}`);
    const value = `${Date.now()}-${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.redis.set(key, value, 'EX', ttl, 'NX');
        if (result === 'OK') {
          return { acquired: true, lockValue: value };
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      } catch (error) {
        console.error('Lock acquisition error:', error);
      }
    }

    return { acquired: false };
  }

  async releaseLock(lockKey, lockValue) {
    const key = this.buildKey(`lock:${lockKey}`);

    // Lua script to ensure we only release our own lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(script, 1, key, lockValue);
      return result === 1;
    } catch (error) {
      console.error('Lock release error:', error);
      return false;
    }
  }

  buildKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const stats = {};

      info.split('\r\n').forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return stats;
    } catch (error) {
      console.error('Stats error:', error);
      return {};
    }
  }
}

module.exports = CacheManager;
```

---

## Session 2: WebSockets & Real-Time Communication Patterns

**Duration**: 75 minutes  
**Objective**: Build real-time applications with WebSockets and event-driven architecture

### Learning Outcomes

- Implement WebSocket servers with Socket.io
- Design scalable real-time communication patterns
- Handle connection management and error recovery
- Build real-time features (notifications, live updates, collaboration)
- Scale WebSocket applications across multiple servers

### Lecture Content

#### 1. WebSocket Fundamentals (25 minutes)

**WebSocket vs HTTP:**

- Persistent bidirectional communication
- Lower latency and overhead
- Real-time data streaming capabilities
- Protocol upgrade from HTTP

**Socket.io Features:**

- Automatic fallback to long-polling
- Room and namespace management
- Built-in reconnection handling
- Binary data support
- Middleware support

#### 2. Real-Time Architecture Patterns (25 minutes)

**Event-Driven Patterns:**

- Publisher-Subscriber (Pub/Sub)
- Observer pattern for client updates
- Event sourcing for state management
- Command Query Responsibility Segregation (CQRS)

**Scaling Considerations:**

- Horizontal scaling with Redis adapter
- Load balancing sticky sessions
- Message queue integration
- Database change streams

#### 3. Use Cases & Implementation (25 minutes)

**Common Real-Time Features:**

- Live chat and messaging
- Real-time notifications
- Collaborative editing
- Live dashboards and monitoring
- Gaming and interactive applications

### Code Examples

#### Socket.io Server Implementation

```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('socket.io-redis');
const jwt = require('jsonwebtoken');

class RealtimeServer {
  constructor(port = 3000) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.port = port;
    this.connectedUsers = new Map();

    this.setupRedisAdapter();
    this.setupAuthentication();
    this.setupEventHandlers();
  }

  setupRedisAdapter() {
    // Enable scaling across multiple server instances
    if (process.env.REDIS_HOST) {
      this.io.adapter(
        redis({
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
        })
      );
    }
  }

  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.sub;
        socket.userEmail = decoded.email;
        socket.userName = decoded.name;

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userName} connected (${socket.id})`);

      // Store user connection info
      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        name: socket.userName,
        email: socket.userEmail,
        connectedAt: new Date(),
      });

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Notify other users about the connection
      socket.broadcast.emit('user:online', {
        userId: socket.userId,
        name: socket.userName,
      });

      this.setupSocketEventHandlers(socket);
    });
  }

  setupSocketEventHandlers(socket) {
    // Chat message handling
    socket.on('chat:send', async (data) => {
      try {
        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: data.content,
          sender: {
            id: socket.userId,
            name: socket.userName,
            email: socket.userEmail,
          },
          timestamp: new Date(),
          roomId: data.roomId,
        };

        // Save message to database (implement your storage logic)
        await this.saveMessage(message);

        // Send to room members
        this.io.to(`room:${data.roomId}`).emit('chat:message', message);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Room management
    socket.on('room:join', async (roomId) => {
      try {
        // Verify user has access to room
        const hasAccess = await this.verifyRoomAccess(socket.userId, roomId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to room' });
          return;
        }

        socket.join(`room:${roomId}`);

        // Notify room members
        socket.to(`room:${roomId}`).emit('room:user_joined', {
          userId: socket.userId,
          name: socket.userName,
          roomId,
        });

        // Send room history
        const messages = await this.getRoomMessages(roomId);
        socket.emit('room:history', { roomId, messages });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('room:leave', (roomId) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user_left', {
        userId: socket.userId,
        name: socket.userName,
        roomId,
      });
    });

    // Live document collaboration
    socket.on('document:edit', (data) => {
      // Broadcast edit operations to other collaborators
      socket.to(`document:${data.documentId}`).emit('document:operation', {
        operation: data.operation,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date(),
      });
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      socket.to(`room:${data.roomId}`).emit('typing:user_start', {
        userId: socket.userId,
        userName: socket.userName,
        roomId: data.roomId,
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`room:${data.roomId}`).emit('typing:user_stop', {
        userId: socket.userId,
        roomId: data.roomId,
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.userName} disconnected: ${reason}`);

      this.connectedUsers.delete(socket.userId);

      // Notify others about disconnection
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        name: socket.userName,
        reason,
      });
    });

    // Custom business logic events
    socket.on('notification:read', async (notificationId) => {
      try {
        await this.markNotificationAsRead(socket.userId, notificationId);
        socket.emit('notification:updated', { id: notificationId, read: true });
      } catch (error) {
        socket.emit('error', { message: 'Failed to update notification' });
      }
    });
  }

  // Business logic methods (implement based on your needs)
  async saveMessage(message) {
    // Implement message persistence
    console.log('Saving message:', message);
  }

  async verifyRoomAccess(userId, roomId) {
    // Implement room access verification
    return true; // Placeholder
  }

  async getRoomMessages(roomId, limit = 50) {
    // Implement message retrieval
    return []; // Placeholder
  }

  async markNotificationAsRead(userId, notificationId) {
    // Implement notification update
    console.log(
      `Marking notification ${notificationId} as read for user ${userId}`
    );
  }

  // Utility methods
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  sendToRoom(roomId, event, data) {
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  async getServerStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      rooms: await this.io.of('/').adapter.allRooms(),
      uptime: process.uptime(),
    };
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Real-time server running on port ${this.port}`);
    });
  }
}

module.exports = RealtimeServer;
```

### Discussion Points

1. When should you use WebSockets vs Server-Sent Events vs Long Polling?
2. How do you handle connection drops and reconnection logic?
3. What are the security considerations for real-time applications?
4. How do you scale WebSocket applications horizontally?
5. What are the performance implications of different real-time patterns?
