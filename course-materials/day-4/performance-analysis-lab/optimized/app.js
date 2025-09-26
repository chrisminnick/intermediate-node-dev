const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const NodeCache = require('node-cache');
const { Worker } = require('worker_threads');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cluster = require('cluster');
const os = require('os');

// This is the OPTIMIZED version with performance improvements
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced middleware setup
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Reasonable limit

// Improved rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Reasonable limit
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Specialized rate limiters
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests',
});

const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 reports per 5 minutes
  message: 'Too many report requests',
});

// Optimized logging setup
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    if (duration > 1000) {
      // Log slow requests
      logger.warn(
        `Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`
      );
    }
  });

  next();
});

// OPTIMIZATION #1: In-memory caching with TTL and size limits
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
  maxKeys: 1000, // Limit cache size
  checkperiod: 60, // Check for expired keys every minute
});

// OPTIMIZATION #2: Pre-computed indexes for faster lookups
let products = [];
let users = [];
let orders = [];
let productIndex = new Map(); // id -> product
let productCategoryIndex = new Map(); // category -> [products]
let productSearchIndex = new Map(); // search terms -> [product ids]
let userIndex = new Map(); // id -> user
let ordersByUser = new Map(); // userId -> [orders]
let ordersByProduct = new Map(); // productId -> [orders]

// OPTIMIZATION #3: Async data loading
async function loadData() {
  try {
    const [productsData, usersData, ordersData] = await Promise.all([
      fs
        .readFile(path.join(__dirname, '../data/products.json'), 'utf8')
        .catch(() => '[]'),
      fs
        .readFile(path.join(__dirname, '../data/users.json'), 'utf8')
        .catch(() => '[]'),
      fs
        .readFile(path.join(__dirname, '../data/orders.json'), 'utf8')
        .catch(() => '[]'),
    ]);

    products = JSON.parse(productsData);
    users = JSON.parse(usersData);
    orders = JSON.parse(ordersData);

    // Build indexes
    await buildIndexes();

    logger.info(
      `Loaded ${products.length} products, ${users.length} users, ${orders.length} orders`
    );
  } catch (error) {
    logger.error('Error loading data:', error);
    products = [];
    users = [];
    orders = [];
  }
}

// OPTIMIZATION #4: Build indexes for O(1) lookups
async function buildIndexes() {
  logger.info('Building indexes...');

  // Product indexes
  productIndex.clear();
  productCategoryIndex.clear();
  productSearchIndex.clear();

  for (const product of products) {
    productIndex.set(product.id, product);

    // Category index
    if (!productCategoryIndex.has(product.category)) {
      productCategoryIndex.set(product.category, []);
    }
    productCategoryIndex.get(product.category).push(product);

    // Search index (simple keyword indexing)
    const searchTerms = [
      ...product.name.toLowerCase().split(/\s+/),
      ...product.description.toLowerCase().split(/\s+/),
      product.category.toLowerCase(),
      product.brand.toLowerCase(),
    ];

    for (const term of searchTerms) {
      if (term.length > 2) {
        // Ignore very short terms
        if (!productSearchIndex.has(term)) {
          productSearchIndex.set(term, new Set());
        }
        productSearchIndex.get(term).add(product.id);
      }
    }
  }

  // User index
  userIndex.clear();
  for (const user of users) {
    userIndex.set(user.id, user);
  }

  // Order indexes
  ordersByUser.clear();
  ordersByProduct.clear();

  for (const order of orders) {
    // Orders by user
    if (!ordersByUser.has(order.userId)) {
      ordersByUser.set(order.userId, []);
    }
    ordersByUser.get(order.userId).push(order);

    // Orders by product
    for (const item of order.items) {
      if (!ordersByProduct.has(item.productId)) {
        ordersByProduct.set(item.productId, []);
      }
      ordersByProduct.get(item.productId).push({ order, item });
    }
  }

  logger.info('Indexes built successfully');
}

// OPTIMIZATION #5: Efficient search with indexing
function searchProducts(query, limit = 50) {
  const cacheKey = `search:${query}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);
  const matchingProductIds = new Set();

  // Use search index for fast lookups
  for (const term of queryTerms) {
    const productIds = productSearchIndex.get(term);
    if (productIds) {
      if (matchingProductIds.size === 0) {
        // First term - add all matches
        productIds.forEach((id) => matchingProductIds.add(id));
      } else {
        // Subsequent terms - intersection (AND logic)
        const intersection = new Set();
        for (const id of matchingProductIds) {
          if (productIds.has(id)) {
            intersection.add(id);
          }
        }
        matchingProductIds.clear();
        intersection.forEach((id) => matchingProductIds.add(id));
      }
    }
  }

  // Convert to products and add calculated fields
  const results = Array.from(matchingProductIds)
    .slice(0, limit)
    .map((id) => {
      const product = productIndex.get(id);
      return {
        ...product,
        discountedPrice: getDiscountedPrice(product),
        rating: getProductRating(product.id),
        // Don't include related products in search results to improve performance
      };
    });

  cache.set(cacheKey, results);
  return results;
}

// OPTIMIZATION #6: Memoized calculations
const discountCache = new Map();
function getDiscountedPrice(product) {
  if (discountCache.has(product.id)) {
    return discountCache.get(product.id);
  }

  const discountedPrice = product.price * 0.9; // Simple 10% discount
  discountCache.set(product.id, discountedPrice);
  return discountedPrice;
}

// OPTIMIZATION #7: Cached rating calculations
const ratingCache = new Map();
function getProductRating(productId) {
  if (ratingCache.has(productId)) {
    return ratingCache.get(productId);
  }

  const productOrders = ordersByProduct.get(productId) || [];
  let totalRating = 0;
  let ratingCount = 0;

  for (const { item } of productOrders) {
    if (item.rating) {
      totalRating += item.rating;
      ratingCount++;
    }
  }

  const rating = ratingCount > 0 ? totalRating / ratingCount : 0;
  ratingCache.set(productId, rating);
  return rating;
}

// OPTIMIZATION #8: Efficient related products using category index
function getRelatedProducts(productId, limit = 5) {
  const cacheKey = `related:${productId}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const product = productIndex.get(productId);
  if (!product) return [];

  const categoryProducts = productCategoryIndex.get(product.category) || [];
  const related = categoryProducts
    .filter((p) => p.id !== productId)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      discountedPrice: getDiscountedPrice(p),
      rating: getProductRating(p.id),
    }));

  cache.set(cacheKey, related);
  return related;
}

// OPTIMIZATION #9: Worker thread for CPU-intensive operations
function createReportWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'report-worker.js'), {
      workerData: data,
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// OPTIMIZATION #10: Async report generation with caching
async function generateSalesReport(startDate, endDate) {
  const cacheKey = `report:${startDate}:${endDate}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const report = await createReportWorker({
      orders,
      products,
      startDate,
      endDate,
    });

    // Cache report for 10 minutes
    cache.set(cacheKey, report, 600);
    return report;
  } catch (error) {
    logger.error('Error generating report with worker:', error);
    // Fallback to synchronous generation (simplified)
    return generateSimpleReport(startDate, endDate);
  }
}

function generateSimpleReport(startDate, endDate) {
  const report = {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    processedWith: 'fallback',
  };

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  for (const order of orders) {
    const orderTime = new Date(order.createdAt).getTime();
    if (orderTime >= startMs && orderTime <= endMs) {
      report.totalSales += order.total;
      report.totalOrders++;
    }
  }

  report.averageOrderValue =
    report.totalOrders > 0 ? report.totalSales / report.totalOrders : 0;
  return report;
}

// API Routes with optimizations

// Health check endpoint
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats(),
    },
    indexes: {
      products: productIndex.size,
      categories: productCategoryIndex.size,
      searchTerms: productSearchIndex.size,
    },
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

// OPTIMIZATION #11: Paginated products endpoint
app.get('/api/products', async (req, res) => {
  const start = process.hrtime.bigint();

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    const cacheKey = `products:${page}:${limit}`;
    let result = cache.get(cacheKey);

    if (!result) {
      const paginatedProducts = products
        .slice(offset, offset + limit)
        .map((product) => ({
          ...product,
          discountedPrice: getDiscountedPrice(product),
          rating: getProductRating(product.id),
          // Skip related products in list view for performance
        }));

      result = {
        products: paginatedProducts,
        pagination: {
          page,
          limit,
          total: products.length,
          pages: Math.ceil(products.length / limit),
        },
      };

      cache.set(cacheKey, result, 300); // Cache for 5 minutes
    }

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.json({
      ...result,
      processingTime: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    logger.error('Error in products endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optimized search endpoint
app.get('/api/search', searchLimiter, async (req, res) => {
  const start = process.hrtime.bigint();
  const { q: query, limit = 20 } = req.query;

  if (!query || query.trim().length < 2) {
    return res
      .status(400)
      .json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const results = searchProducts(query.trim(), Math.min(parseInt(limit), 50));

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.json({
      query,
      results,
      total: results.length,
      processingTime: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    logger.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optimized product detail endpoint
app.get('/api/products/:id', async (req, res) => {
  const start = process.hrtime.bigint();
  const { id } = req.params;

  try {
    const cacheKey = `product:${id}`;
    let productDetails = cache.get(cacheKey);

    if (!productDetails) {
      const product = productIndex.get(id);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      productDetails = {
        ...product,
        discountedPrice: getDiscountedPrice(product),
        rating: getProductRating(product.id),
        relatedProducts: getRelatedProducts(product.id),
      };

      cache.set(cacheKey, productDetails, 600); // Cache for 10 minutes
    }

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.json({
      product: productDetails,
      processingTime: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    logger.error('Error in product detail endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optimized sales report endpoint
app.get('/api/reports/sales', reportLimiter, async (req, res) => {
  const start = process.hrtime.bigint();
  const { startDate, endDate } = req.query;

  // Default to last 30 days if no dates provided
  const start_date =
    startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end_date = endDate || new Date().toISOString();

  try {
    const report = await generateSalesReport(start_date, end_date);

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.json({
      report,
      dateRange: { startDate: start_date, endDate: end_date },
      processingTime: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    logger.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optimized product creation with async file operations
app.post('/api/products', async (req, res) => {
  const start = process.hrtime.bigint();

  try {
    const newProduct = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
    };

    // Add to in-memory collections
    products.push(newProduct);
    productIndex.set(newProduct.id, newProduct);

    // Add to category index
    if (!productCategoryIndex.has(newProduct.category)) {
      productCategoryIndex.set(newProduct.category, []);
    }
    productCategoryIndex.get(newProduct.category).push(newProduct);

    // Async file write (non-blocking)
    setImmediate(async () => {
      try {
        await fs.writeFile(
          path.join(__dirname, '../data/products.json'),
          JSON.stringify(products, null, 2)
        );
      } catch (error) {
        logger.error('Error writing products file:', error);
      }
    });

    // Clear related caches
    cache.flushAll();

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.status(201).json({
      product: newProduct,
      processingTime: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CPU intensive endpoint with worker thread
app.get('/api/cpu-intensive', async (req, res) => {
  const start = process.hrtime.bigint();

  try {
    // Use worker thread for CPU intensive work
    const worker = new Worker(path.join(__dirname, 'cpu-worker.js'));

    const result = await new Promise((resolve, reject) => {
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.postMessage({ iterations: 1000000 });
    });

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;

    res.json({
      result: result.value,
      processingTime: Math.round(duration * 100) / 100,
      processedBy: 'worker-thread',
      message: 'CPU intensive operation completed in worker thread',
    });
  } catch (error) {
    logger.error('Error in CPU intensive endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  res.json({
    cache: cache.getStats(),
    keys: cache.keys().length,
    indexes: {
      products: productIndex.size,
      users: userIndex.size,
      categories: productCategoryIndex.size,
      searchTerms: productSearchIndex.size,
      ordersByUser: ordersByUser.size,
      ordersByProduct: ordersByProduct.size,
    },
  });
});

// Clear cache endpoint
app.delete('/api/cache', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function startServer() {
  try {
    await loadData();

    const server = app.listen(PORT, () => {
      logger.info(`Optimized server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Products API: http://localhost:${PORT}/api/products`);
      console.log(`Search API: http://localhost:${PORT}/api/search?q=laptop`);
      console.log(`Reports API: http://localhost:${PORT}/api/reports/sales`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// OPTIMIZATION #12: Clustering for multi-core utilization
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;

  logger.info(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  startServer();
}

module.exports = app;
