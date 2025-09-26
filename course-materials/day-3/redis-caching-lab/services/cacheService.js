const redisConfig = require('../config/redis');

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
    this.keyPrefix = process.env.CACHE_PREFIX || 'cache:';
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  /**
   * Generate cache key with prefix and namespace
   * @param {string} key - Base key
   * @param {string} namespace - Optional namespace
   * @returns {string} Formatted cache key
   */
  formatKey(key, namespace = 'default') {
    return `${this.keyPrefix}${namespace}:${key}`;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {string} namespace - Optional namespace
   * @returns {Promise<any>} Cached value or null
   */
  async get(key, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      const start = Date.now();
      const result = await client.get(formattedKey);
      const duration = Date.now() - start;

      if (result !== null) {
        this.stats.hits++;
        console.log(`🎯 Cache HIT: ${formattedKey} (${duration}ms)`);

        try {
          return JSON.parse(result);
        } catch (parseError) {
          // Return as string if not valid JSON
          return result;
        }
      } else {
        this.stats.misses++;
        console.log(`❌ Cache MISS: ${formattedKey} (${duration}ms)`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Cache GET error for key ${key}:`, error.message);
      this.stats.misses++;
      return null; // Fail gracefully
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = this.defaultTTL, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      // Serialize value
      const serializedValue =
        typeof value === 'string' ? value : JSON.stringify(value);

      const start = Date.now();
      await client.setEx(formattedKey, ttl, serializedValue);
      const duration = Date.now() - start;

      this.stats.sets++;
      console.log(
        `💾 Cache SET: ${formattedKey} (TTL: ${ttl}s, ${duration}ms)`
      );

      return true;
    } catch (error) {
      console.error(`❌ Cache SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Success status
   */
  async delete(key, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      const result = await client.del(formattedKey);

      if (result > 0) {
        this.stats.deletes++;
        console.log(`🗑️  Cache DELETE: ${formattedKey}`);
        return true;
      } else {
        console.log(`⚠️  Cache DELETE: ${formattedKey} (key not found)`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Cache DELETE error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      const result = await client.exists(formattedKey);
      return result === 1;
    } catch (error) {
      console.error(`❌ Cache EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get TTL for a key
   * @param {string} key - Cache key
   * @param {string} namespace - Optional namespace
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async getTTL(key, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      return await client.ttl(formattedKey);
    } catch (error) {
      console.error(`❌ Cache TTL error for key ${key}:`, error.message);
      return -2;
    }
  }

  /**
   * Set expiration for existing key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKey = this.formatKey(key, namespace);

      const result = await client.expire(formattedKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`❌ Cache EXPIRE error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all keys in a namespace
   * @param {string} namespace - Namespace to clear
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearNamespace(namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const pattern = this.formatKey('*', namespace);

      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        const result = await client.del(keys);
        console.log(`🧹 Cleared ${result} keys from namespace: ${namespace}`);
        return result;
      } else {
        console.log(`🧹 No keys found in namespace: ${namespace}`);
        return 0;
      }
    } catch (error) {
      console.error(
        `❌ Cache CLEAR NAMESPACE error for ${namespace}:`,
        error.message
      );
      return 0;
    }
  }

  /**
   * Clear all cache keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearAll() {
    try {
      const client = redisConfig.getClient();
      const pattern = `${this.keyPrefix}*`;

      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        const result = await client.del(keys);
        console.log(`🧹 Cleared ALL cache: ${result} keys deleted`);
        this.resetStats();
        return result;
      } else {
        console.log('🧹 No cache keys found to clear');
        return 0;
      }
    } catch (error) {
      console.error('❌ Cache CLEAR ALL error:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRatio =
      total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      total,
      hitRatio: `${hitRatio}%`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    console.log('📊 Cache statistics reset');
  }

  /**
   * Cache with automatic refresh (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data on cache miss
   * @param {number} ttl - Time to live in seconds
   * @param {string} namespace - Optional namespace
   * @returns {Promise<any>} Cached or fresh data
   */
  async getOrSet(
    key,
    fetchFunction,
    ttl = this.defaultTTL,
    namespace = 'default'
  ) {
    try {
      // Try to get from cache first
      let data = await this.get(key, namespace);

      if (data !== null) {
        return data;
      }

      // Cache miss - fetch fresh data
      console.log(`🔄 Fetching fresh data for key: ${key}`);
      const start = Date.now();
      data = await fetchFunction();
      const fetchDuration = Date.now() - start;

      console.log(`📊 Data fetched in ${fetchDuration}ms`);

      // Store in cache for next time
      await this.set(key, data, ttl, namespace);

      return data;
    } catch (error) {
      console.error(`❌ Cache GET_OR_SET error for key ${key}:`, error.message);

      // Try to fetch directly without caching on error
      try {
        return await fetchFunction();
      } catch (fetchError) {
        console.error(
          `❌ Fetch function failed for key ${key}:`,
          fetchError.message
        );
        throw fetchError;
      }
    }
  }

  /**
   * Batch get multiple keys
   * @param {Array<string>} keys - Array of cache keys
   * @param {string} namespace - Optional namespace
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async mget(keys, namespace = 'default') {
    try {
      const client = redisConfig.getClient();
      const formattedKeys = keys.map((key) => this.formatKey(key, namespace));

      const results = await client.mGet(formattedKeys);
      const data = {};

      keys.forEach((key, index) => {
        const result = results[index];
        if (result !== null) {
          try {
            data[key] = JSON.parse(result);
          } catch {
            data[key] = result;
          }
          this.stats.hits++;
        } else {
          data[key] = null;
          this.stats.misses++;
        }
      });

      return data;
    } catch (error) {
      console.error('❌ Cache MGET error:', error.message);
      return {};
    }
  }

  /**
   * Batch set multiple keys
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - Time to live in seconds
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Success status
   */
  async mset(keyValuePairs, ttl = this.defaultTTL, namespace = 'default') {
    try {
      const client = redisConfig.getClient();

      // Use pipeline for batch operations
      const pipeline = client.multi();

      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const formattedKey = this.formatKey(key, namespace);
        const serializedValue =
          typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setEx(formattedKey, ttl, serializedValue);
      });

      await pipeline.exec();
      this.stats.sets += Object.keys(keyValuePairs).length;

      console.log(
        `💾 Cache MSET: ${Object.keys(keyValuePairs).length} keys set`
      );
      return true;
    } catch (error) {
      console.error('❌ Cache MSET error:', error.message);
      return false;
    }
  }

  /**
   * Cache warming - preload cache with data
   * @param {Object} warmupData - Data to warm up the cache
   * @param {number} ttl - Time to live in seconds
   * @param {string} namespace - Optional namespace
   * @returns {Promise<boolean>} Success status
   */
  async warmup(warmupData, ttl = this.defaultTTL, namespace = 'default') {
    console.log(
      `🔥 Warming up cache with ${Object.keys(warmupData).length} keys...`
    );
    return await this.mset(warmupData, ttl, namespace);
  }
}

module.exports = new CacheService();
