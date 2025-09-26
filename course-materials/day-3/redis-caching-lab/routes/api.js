const express = require('express');
const dataService = require('../services/dataService');
const cacheService = require('../services/cacheService');
const redisConfig = require('../config/redis');
const {
  cacheMiddleware,
  performanceMiddleware,
  cacheStampedeProtection,
} = require('../middleware/cache');

const router = express.Router();

// Apply performance monitoring to all routes
router.use(performanceMiddleware());

// News endpoints
router.get(
  '/news',
  cacheMiddleware.news,
  cacheStampedeProtection(),
  async (req, res) => {
    try {
      const { category = 'general', limit = 10 } = req.query;

      const articles = await dataService.fetchNewsArticles(
        category,
        parseInt(limit)
      );

      // Resolve cache stampede protection if it exists
      if (req.cacheStampede) {
        req.cacheStampede.resolve(articles);
      }

      res.json({
        success: true,
        ...articles,
        cached: false,
        responseTime: Date.now() - req.startTime,
      });
    } catch (error) {
      // Reject cache stampede protection if it exists
      if (req.cacheStampede) {
        req.cacheStampede.reject(error);
      }

      console.error('News fetch error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch news articles',
        message: error.message,
      });
    }
  }
);

// User profile endpoints
router.get('/users/:userId', cacheMiddleware.userProfile, async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await dataService.fetchUserProfile(userId);

    res.json({
      success: true,
      user: profile,
      cached: false,
      responseTime: Date.now() - req.startTime,
    });
  } catch (error) {
    console.error('User profile fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error.message,
    });
  }
});

// Weather endpoints
router.get('/weather/:city', cacheMiddleware.weather, async (req, res) => {
  try {
    const { city } = req.params;

    const weather = await dataService.fetchWeatherData(city);

    res.json({
      success: true,
      weather: weather,
      cached: false,
      responseTime: Date.now() - req.startTime,
    });
  } catch (error) {
    console.error('Weather fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data',
      message: error.message,
    });
  }
});

// Product catalog endpoints
router.get('/products', cacheMiddleware.products, async (req, res) => {
  try {
    const options = {
      category: req.query.category,
      priceRange: req.query.priceRange,
      sortBy: req.query.sortBy,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };

    const catalog = await dataService.fetchProductCatalog(options);

    res.json({
      success: true,
      ...catalog,
      cached: false,
      responseTime: Date.now() - req.startTime,
    });
  } catch (error) {
    console.error('Product catalog fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product catalog',
      message: error.message,
    });
  }
});

// Reports endpoints (heavy computation)
router.get(
  '/reports/:reportType',
  cacheMiddleware.reports,
  async (req, res) => {
    try {
      const { reportType } = req.params;

      const report = await dataService.generateReport(reportType);

      res.json({
        success: true,
        report: report,
        cached: false,
        responseTime: Date.now() - req.startTime,
      });
    } catch (error) {
      console.error('Report generation error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        message: error.message,
      });
    }
  }
);

// Cache management endpoints

/**
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const appStats = cacheService.getStats();
    const redisHealth = await redisConfig.healthCheck();
    const redisStats = await redisConfig.getStats();
    const hitRatio = await redisConfig.getCacheHitRatio();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      application: appStats,
      redis: {
        health: redisHealth,
        stats: redisStats,
        hitRatio: hitRatio,
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      message: error.message,
    });
  }
});

/**
 * Clear all cache
 */
router.delete('/cache/clear', async (req, res) => {
  try {
    const cleared = await cacheService.clearAll();

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      keysCleared: cleared,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache clear error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message,
    });
  }
});

/**
 * Clear cache by namespace
 */
router.delete('/cache/clear/:namespace', async (req, res) => {
  try {
    const { namespace } = req.params;
    const cleared = await cacheService.clearNamespace(namespace);

    res.json({
      success: true,
      message: `Cache namespace '${namespace}' cleared successfully`,
      keysCleared: cleared,
      namespace: namespace,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache namespace clear error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache namespace',
      message: error.message,
    });
  }
});

/**
 * Warm up cache with popular data
 */
router.post('/cache/warm', async (req, res) => {
  try {
    console.log('🔥 Starting cache warmup...');

    // Warm up popular news categories
    const newsPromises = ['general', 'technology', 'business'].map(
      async (category) => {
        const articles = await dataService.fetchNewsArticles(category, 10);
        await cacheService.set(
          `articles:${category}:10`,
          articles,
          300,
          'news'
        );
        return { category, status: 'warmed' };
      }
    );

    // Warm up sample user profiles
    const userPromises = ['user1', 'user2', 'user3'].map(async (userId) => {
      const profile = await dataService.fetchUserProfile(userId);
      await cacheService.set(`profile:${userId}`, profile, 600, 'users');
      return { userId, status: 'warmed' };
    });

    // Warm up popular cities weather
    const weatherPromises = ['london', 'newyork', 'tokyo'].map(async (city) => {
      const weather = await dataService.fetchWeatherData(city);
      await cacheService.set(`current:${city}`, weather, 600, 'weather');
      return { city, status: 'warmed' };
    });

    const [newsResults, userResults, weatherResults] = await Promise.all([
      Promise.allSettled(newsPromises),
      Promise.allSettled(userPromises),
      Promise.allSettled(weatherPromises),
    ]);

    const results = {
      news: newsResults.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason.message }
      ),
      users: userResults.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason.message }
      ),
      weather: weatherResults.map((r) =>
        r.status === 'fulfilled' ? r.value : { error: r.reason.message }
      ),
    };

    console.log('✅ Cache warmup completed');

    res.json({
      success: true,
      message: 'Cache warmup completed',
      results: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache warmup error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Cache warmup failed',
      message: error.message,
    });
  }
});

/**
 * Get cache key information
 */
router.get('/cache/keys/:namespace?', async (req, res) => {
  try {
    const { namespace } = req.params;
    const client = redisConfig.getClient();

    const pattern = namespace ? `cache:${namespace}:*` : 'cache:*';

    const keys = await client.keys(pattern);

    // Get TTL for each key
    const keyInfo = await Promise.all(
      keys.map(async (key) => {
        const ttl = await client.ttl(key);
        const type = await client.type(key);
        return {
          key: key.replace(/^cache:/, ''),
          ttl: ttl,
          type: type,
          expiresAt:
            ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
        };
      })
    );

    res.json({
      success: true,
      namespace: namespace || 'all',
      keyCount: keys.length,
      keys: keyInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache keys error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache keys',
      message: error.message,
    });
  }
});

/**
 * Manual cache invalidation for specific key
 */
router.delete('/cache/invalidate/:namespace/:key', async (req, res) => {
  try {
    const { namespace, key } = req.params;

    const deleted = await cacheService.delete(key, namespace);

    res.json({
      success: true,
      message: deleted ? 'Cache key invalidated' : 'Cache key not found',
      key: key,
      namespace: namespace,
      deleted: deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache invalidation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache key',
      message: error.message,
    });
  }
});

/**
 * Benchmark endpoint - compare cached vs uncached performance
 */
router.get('/benchmark/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const iterations = parseInt(req.query.iterations) || 10;

    let benchmarkFunction;

    switch (endpoint) {
      case 'news':
        benchmarkFunction = () => dataService.fetchNewsArticles('general', 10);
        break;
      case 'weather':
        benchmarkFunction = () => dataService.fetchWeatherData('london');
        break;
      case 'users':
        benchmarkFunction = () => dataService.fetchUserProfile('user1');
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid benchmark endpoint',
          validEndpoints: ['news', 'weather', 'users'],
        });
    }

    const times = [];

    // Run benchmark iterations
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await benchmarkFunction();
      const duration = Date.now() - start;
      times.push(duration);
    }

    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    res.json({
      success: true,
      endpoint: endpoint,
      iterations: iterations,
      results: {
        times: times,
        average: Math.round(average),
        min: min,
        max: max,
        total: times.reduce((a, b) => a + b, 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Benchmark error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Benchmark failed',
      message: error.message,
    });
  }
});

module.exports = router;
