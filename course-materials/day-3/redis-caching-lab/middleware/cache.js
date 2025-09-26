const cacheService = require('../services/cacheService');

/**
 * Generic caching middleware factory
 * @param {Object} options - Caching options
 * @param {number} options.ttl - Time to live in seconds
 * @param {string} options.namespace - Cache namespace
 * @param {Function} options.keyGenerator - Function to generate cache key
 * @param {boolean} options.skipCache - Skip cache for certain conditions
 * @returns {Function} Express middleware function
 */
const createCacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    namespace = 'api',
    keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
    skipCache = () => false,
  } = options;

  return async (req, res, next) => {
    // Skip caching if specified
    if (skipCache(req)) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);

      // Store cache info in request for later use
      req.cache = {
        key: cacheKey,
        namespace: namespace,
        ttl: ttl,
      };

      // Try to get cached response
      const cachedResponse = await cacheService.get(cacheKey, namespace);

      if (cachedResponse) {
        // Cache hit - return cached response
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-TTL', await cacheService.getTTL(cacheKey, namespace));

        return res.json(cachedResponse);
      }

      // Cache miss - continue to route handler
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache the response asynchronously (don't wait)
          cacheService.set(cacheKey, data, ttl, namespace).catch((error) => {
            console.error('Failed to cache response:', error.message);
          });
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error.message);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Route-specific caching middleware
 */
const cacheMiddleware = {
  /**
   * News articles caching
   */
  news: createCacheMiddleware({
    ttl: 300, // 5 minutes
    namespace: 'news',
    keyGenerator: (req) => {
      const { category = 'general', limit = 10 } = req.query;
      return `articles:${category}:${limit}`;
    },
  }),

  /**
   * User profile caching
   */
  userProfile: createCacheMiddleware({
    ttl: 600, // 10 minutes
    namespace: 'users',
    keyGenerator: (req) => `profile:${req.params.userId}`,
    skipCache: (req) => {
      // Skip cache for authenticated requests that might contain sensitive data
      return req.headers.authorization !== undefined;
    },
  }),

  /**
   * Weather data caching
   */
  weather: createCacheMiddleware({
    ttl: 600, // 10 minutes (weather changes slowly)
    namespace: 'weather',
    keyGenerator: (req) => `current:${req.params.city.toLowerCase()}`,
  }),

  /**
   * Product catalog caching
   */
  products: createCacheMiddleware({
    ttl: 1800, // 30 minutes (product data changes less frequently)
    namespace: 'products',
    keyGenerator: (req) => {
      const { category, priceRange, sortBy, page, limit } = req.query;
      return `catalog:${category || 'all'}:${priceRange || 'any'}:${
        sortBy || 'name'
      }:${page || 1}:${limit || 20}`;
    },
  }),

  /**
   * Heavy computation results caching
   */
  reports: createCacheMiddleware({
    ttl: 3600, // 1 hour (reports are expensive to generate)
    namespace: 'reports',
    keyGenerator: (req) =>
      `${req.params.reportType}:${new Date().toDateString()}`, // Daily reports
  }),

  /**
   * Short-term caching for frequently changing data
   */
  shortTerm: createCacheMiddleware({
    ttl: 60, // 1 minute
    namespace: 'short',
    keyGenerator: (req) => `${req.method}:${req.originalUrl}`,
  }),

  /**
   * Long-term caching for static data
   */
  longTerm: createCacheMiddleware({
    ttl: 86400, // 24 hours
    namespace: 'static',
    keyGenerator: (req) => `${req.method}:${req.originalUrl}`,
  }),
};

/**
 * Cache warming middleware - preload cache with data
 */
const cacheWarmingMiddleware = (warmupFunction, options = {}) => {
  const { ttl = 300, namespace = 'warmed' } = options;

  return async (req, res, next) => {
    try {
      const cacheKey = `warmed:${req.originalUrl}`;

      // Check if cache needs warming (doesn't exist or expires soon)
      const ttlRemaining = await cacheService.getTTL(cacheKey, namespace);

      if (ttlRemaining < 60) {
        // Less than 1 minute remaining
        console.log('🔥 Cache warming triggered for:', cacheKey);

        // Warm cache in background
        warmupFunction(req)
          .then((data) => {
            return cacheService.set(cacheKey, data, ttl, namespace);
          })
          .catch((error) => {
            console.error('Cache warming failed:', error.message);
          });
      }

      next();
    } catch (error) {
      console.error('Cache warming middleware error:', error.message);
      next();
    }
  };
};

/**
 * Cache stampede prevention middleware
 */
const cacheStampedeProtection = (lockTTL = 10) => {
  const pendingRequests = new Map();

  return async (req, res, next) => {
    const lockKey = `lock:${req.cache?.key || req.originalUrl}`;

    try {
      // Check if there's already a pending request for this key
      if (pendingRequests.has(lockKey)) {
        console.log('🔒 Waiting for pending request:', lockKey);

        // Wait for the pending request to complete
        await pendingRequests.get(lockKey);

        // Try to get from cache again (should be available now)
        const cachedData = await cacheService.get(
          req.cache?.key || req.originalUrl,
          req.cache?.namespace || 'default'
        );

        if (cachedData) {
          res.set('X-Cache', 'HIT-AFTER-WAIT');
          return res.json(cachedData);
        }
      }

      // Set lock and create promise for other requests to wait on
      const lockPromise = new Promise((resolve, reject) => {
        // Store resolver in request for route handler to call
        req.cacheStampede = { resolve, reject };
      });

      pendingRequests.set(lockKey, lockPromise);

      // Clean up after lock TTL
      setTimeout(() => {
        pendingRequests.delete(lockKey);
      }, lockTTL * 1000);

      next();
    } catch (error) {
      console.error('Cache stampede protection error:', error.message);
      next();
    }
  };
};

/**
 * Performance monitoring middleware
 */
const performanceMiddleware = () => {
  return (req, res, next) => {
    const start = Date.now();

    // Store start time
    req.startTime = start;

    // Override end method to log performance
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;
      const cacheStatus = res.get('X-Cache') || 'NONE';

      console.log(
        `⚡ ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - Cache: ${cacheStatus}`
      );

      // Add performance headers
      res.set('X-Response-Time', `${duration}ms`);
      res.set('X-Request-ID', req.id || 'unknown');

      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Conditional caching based on request conditions
 */
const conditionalCache = (condition, cacheOptions) => {
  const cacheMiddlewareInstance = createCacheMiddleware(cacheOptions);

  return (req, res, next) => {
    if (condition(req)) {
      return cacheMiddlewareInstance(req, res, next);
    }
    next();
  };
};

module.exports = {
  createCacheMiddleware,
  cacheMiddleware,
  cacheWarmingMiddleware,
  cacheStampedeProtection,
  performanceMiddleware,
  conditionalCache,
};
