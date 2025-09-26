const { createClient } = require('redis');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
  }

  async connect() {
    try {
      // Create Redis client with configuration
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error('❌ Max Redis reconnection attempts reached');
              return false;
            }
            const delay = Math.min(
              this.retryDelay * Math.pow(2, retries),
              30000
            );
            console.log(
              `🔄 Redis reconnecting in ${delay}ms (attempt ${retries + 1})`
            );
            return delay;
          },
        },
        // Optional: Add authentication if needed
        password: process.env.REDIS_PASSWORD,
        database: process.env.REDIS_DB || 0,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();

      this.isConnected = true;
      this.connectionAttempts = 0;

      console.log('✅ Redis connected successfully');

      // Test the connection
      await this.client.ping();
      console.log('🏓 Redis ping successful');

      return this.client;
    } catch (error) {
      this.connectionAttempts++;
      console.error(
        `❌ Redis connection error (attempt ${this.connectionAttempts}):`,
        error.message
      );

      if (this.connectionAttempts < this.maxRetries) {
        console.log(`🔄 Retrying Redis connection in ${this.retryDelay}ms...`);
        setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay *= 2; // Exponential backoff
      } else {
        console.error('💥 Redis connection failed after maximum retries');
        throw error;
      }
    }
  }

  setupEventListeners() {
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('⚡ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis client error:', error.message);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('🔚 Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
    });
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        console.log('✅ Redis disconnected gracefully');
      } catch (error) {
        console.error('❌ Error disconnecting Redis:', error.message);
        // Force disconnect if graceful quit fails
        await this.client.disconnect();
      }
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected. Call connect() first.');
    }
    return this.client;
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.client || !this.isConnected) {
        return { status: 'disconnected', error: 'Redis client not connected' };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info('server');
      const memory = await this.client.info('memory');

      return {
        status: 'connected',
        latency: `${latency}ms`,
        version: this.extractInfoValue(info, 'redis_version'),
        uptime: this.extractInfoValue(info, 'uptime_in_seconds'),
        memory_used: this.extractInfoValue(memory, 'used_memory_human'),
        memory_peak: this.extractInfoValue(memory, 'used_memory_peak_human'),
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  // Utility method to extract values from Redis INFO command
  extractInfoValue(info, key) {
    const line = info.split('\n').find((line) => line.startsWith(key + ':'));
    return line ? line.split(':')[1].trim() : 'unknown';
  }

  // Get Redis statistics
  async getStats() {
    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.info('keyspace');

      return {
        total_connections_received: this.extractInfoValue(
          info,
          'total_connections_received'
        ),
        total_commands_processed: this.extractInfoValue(
          info,
          'total_commands_processed'
        ),
        keyspace_hits: this.extractInfoValue(info, 'keyspace_hits'),
        keyspace_misses: this.extractInfoValue(info, 'keyspace_misses'),
        expired_keys: this.extractInfoValue(info, 'expired_keys'),
        evicted_keys: this.extractInfoValue(info, 'evicted_keys'),
        keyspace_info: keyspace,
      };
    } catch (error) {
      throw new Error(`Failed to get Redis stats: ${error.message}`);
    }
  }

  // Calculate cache hit ratio
  async getCacheHitRatio() {
    try {
      const stats = await this.getStats();
      const hits = parseInt(stats.keyspace_hits) || 0;
      const misses = parseInt(stats.keyspace_misses) || 0;
      const total = hits + misses;

      if (total === 0) return 0;

      return {
        hits,
        misses,
        total,
        hitRatio: ((hits / total) * 100).toFixed(2) + '%',
      };
    } catch (error) {
      throw new Error(`Failed to calculate hit ratio: ${error.message}`);
    }
  }
}

// Create singleton instance
const redisConfig = new RedisConfig();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing Redis connection...');
  await redisConfig.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing Redis connection...');
  await redisConfig.disconnect();
  process.exit(0);
});

module.exports = redisConfig;
