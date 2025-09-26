const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// This is the UNOPTIMIZED version with intentional performance issues
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware setup
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' })); // Overly large limit

// Rate limiting (too permissive)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Too high - allows abuse
  message: 'Too many requests from this IP',
});
app.use('/api/', limiter);

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Express Winston middleware
app.use(
  expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
  })
);

// PERFORMANCE ISSUE #1: Synchronous file operations blocking the event loop
let products = [];
let users = [];
let orders = [];

// Load data synchronously (BAD - blocks event loop)
function loadData() {
  try {
    const productsData = fs.readFileSync(
      path.join(__dirname, 'data/products.json'),
      'utf8'
    );
    products = JSON.parse(productsData);

    const usersData = fs.readFileSync(
      path.join(__dirname, 'data/users.json'),
      'utf8'
    );
    users = JSON.parse(usersData);

    const ordersData = fs.readFileSync(
      path.join(__dirname, 'data/orders.json'),
      'utf8'
    );
    orders = JSON.parse(ordersData);

    console.log(
      `Loaded ${products.length} products, ${users.length} users, ${orders.length} orders`
    );
  } catch (error) {
    console.error('Error loading data:', error);
    // Create empty arrays if files don't exist
    products = [];
    users = [];
    orders = [];
  }
}

// PERFORMANCE ISSUE #2: Inefficient search algorithm (O(n) linear search)
function searchProducts(query) {
  const results = [];
  const lowercaseQuery = query.toLowerCase();

  // Linear search through all products (INEFFICIENT)
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Inefficient string operations
    if (
      product.name.toLowerCase().includes(lowercaseQuery) ||
      product.description.toLowerCase().includes(lowercaseQuery) ||
      product.category.toLowerCase().includes(lowercaseQuery)
    ) {
      // PERFORMANCE ISSUE #3: Unnecessary deep cloning on every match
      const clonedProduct = JSON.parse(JSON.stringify(product));

      // PERFORMANCE ISSUE #4: Expensive calculation for each product
      clonedProduct.discountedPrice = calculateDiscount(product);
      clonedProduct.rating = calculateAverageRating(product.id);
      clonedProduct.relatedProducts = findRelatedProducts(product.id);

      results.push(clonedProduct);
    }
  }

  return results;
}

// PERFORMANCE ISSUE #5: Expensive calculation without memoization
function calculateDiscount(product) {
  let discount = 0;

  // Simulate expensive calculation
  for (let i = 0; i < 10000; i++) {
    discount += Math.sin(i) * Math.cos(i);
  }

  return product.price - product.price * 0.1;
}

// PERFORMANCE ISSUE #6: Database-like operations without indexing
function calculateAverageRating(productId) {
  let totalRating = 0;
  let ratingCount = 0;

  // Linear search through all orders (INEFFICIENT)
  for (const order of orders) {
    for (const item of order.items) {
      if (item.productId === productId && item.rating) {
        totalRating += item.rating;
        ratingCount++;
      }
    }
  }

  return ratingCount > 0 ? totalRating / ratingCount : 0;
}

// PERFORMANCE ISSUE #7: N+1 query problem simulation
function findRelatedProducts(productId) {
  const relatedProducts = [];
  const currentProduct = products.find((p) => p.id === productId);

  if (!currentProduct) return [];

  // For each product, search through all products again (N+1 problem)
  for (const product of products) {
    if (
      product.id !== productId &&
      product.category === currentProduct.category
    ) {
      // Another expensive operation for each related product
      const productWithDetails = {
        ...product,
        discountedPrice: calculateDiscount(product),
        rating: calculateAverageRating(product.id),
      };
      relatedProducts.push(productWithDetails);
    }
  }

  return relatedProducts.slice(0, 5); // Limit to 5 related products
}

// PERFORMANCE ISSUE #8: Memory leak - growing cache without cleanup
const searchCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function getCachedSearch(query) {
  if (searchCache.has(query)) {
    cacheHits++;
    return searchCache.get(query);
  }

  cacheMisses++;
  const results = searchProducts(query);

  // MEMORY LEAK: Cache grows indefinitely
  searchCache.set(query, results);

  return results;
}

// PERFORMANCE ISSUE #9: Synchronous report generation
function generateSalesReport(startDate, endDate) {
  const report = {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topProducts: [],
    salesByCategory: {},
    dailySales: {},
  };

  // Process all orders (could be millions)
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);

    if (orderDate >= new Date(startDate) && orderDate <= new Date(endDate)) {
      report.totalSales += order.total;
      report.totalOrders++;

      // Expensive operations for each order
      const dayKey = orderDate.toISOString().split('T')[0];
      if (!report.dailySales[dayKey]) {
        report.dailySales[dayKey] = 0;
      }
      report.dailySales[dayKey] += order.total;

      // Process each item in the order
      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          if (!report.salesByCategory[product.category]) {
            report.salesByCategory[product.category] = 0;
          }
          report.salesByCategory[product.category] +=
            item.quantity * item.price;
        }
      }
    }
  }

  report.averageOrderValue =
    report.totalOrders > 0 ? report.totalSales / report.totalOrders : 0;

  // Find top products (inefficient sorting)
  const productSales = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const currentSales = productSales.get(item.productId) || 0;
      productSales.set(
        item.productId,
        currentSales + item.quantity * item.price
      );
    }
  }

  // Convert to array and sort (expensive operation)
  const sortedProducts = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([productId, sales]) => {
      const product = products.find((p) => p.id === productId);
      return {
        product: product ? product.name : 'Unknown',
        sales,
      };
    });

  report.topProducts = sortedProducts;

  return report;
}

// API Routes

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
      size: searchCache.size,
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: cacheHits / (cacheHits + cacheMisses) || 0,
    },
    timestamp: new Date().toISOString(),
  });
});

// Get all products (potentially huge response)
app.get('/api/products', (req, res) => {
  const start = Date.now();

  try {
    // PERFORMANCE ISSUE #10: Return all products without pagination
    const allProducts = products.map((product) => ({
      ...product,
      discountedPrice: calculateDiscount(product), // Expensive calculation for each
      rating: calculateAverageRating(product.id), // Even more expensive
      relatedProducts: findRelatedProducts(product.id), // Extremely expensive
    }));

    const duration = Date.now() - start;
    logger.info(`Products endpoint took ${duration}ms`);

    res.json({
      products: allProducts,
      total: allProducts.length,
      processingTime: duration,
    });
  } catch (error) {
    logger.error('Error in products endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search products
app.get('/api/search', (req, res) => {
  const start = Date.now();
  const { q: query, limit = 50 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Use inefficient caching
    const results = getCachedSearch(query);

    const duration = Date.now() - start;
    logger.info(
      `Search for "${query}" took ${duration}ms, found ${results.length} results`
    );

    res.json({
      query,
      results: results.slice(0, parseInt(limit)),
      total: results.length,
      processingTime: duration,
      cached: searchCache.has(query),
    });
  } catch (error) {
    logger.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const start = Date.now();
  const { id } = req.params;

  try {
    // Linear search for product (inefficient)
    const product = products.find((p) => p.id === id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Add expensive calculations
    const productWithDetails = {
      ...product,
      discountedPrice: calculateDiscount(product),
      rating: calculateAverageRating(product.id),
      relatedProducts: findRelatedProducts(product.id),
      reviews: getProductReviews(product.id), // Another expensive operation
    };

    const duration = Date.now() - start;
    logger.info(`Product ${id} endpoint took ${duration}ms`);

    res.json({
      product: productWithDetails,
      processingTime: duration,
    });
  } catch (error) {
    logger.error('Error in product detail endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PERFORMANCE ISSUE #11: Another expensive operation
function getProductReviews(productId) {
  const reviews = [];

  for (const order of orders) {
    for (const item of order.items) {
      if (item.productId === productId && item.review) {
        reviews.push({
          userId: order.userId,
          rating: item.rating,
          comment: item.review,
          date: order.createdAt,
        });
      }
    }
  }

  return reviews;
}

// Sales report endpoint
app.get('/api/reports/sales', (req, res) => {
  const start = Date.now();
  const { startDate, endDate } = req.query;

  // Default to last 30 days if no dates provided
  const start_date =
    startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end_date = endDate || new Date().toISOString();

  try {
    // Generate report synchronously (blocks event loop)
    const report = generateSalesReport(start_date, end_date);

    const duration = Date.now() - start;
    logger.info(`Sales report generation took ${duration}ms`);

    res.json({
      report,
      dateRange: { startDate: start_date, endDate: end_date },
      processingTime: duration,
    });
  } catch (error) {
    logger.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new product (with validation issues)
app.post('/api/products', (req, res) => {
  const start = Date.now();

  try {
    const newProduct = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
    };

    // PERFORMANCE ISSUE #12: Synchronous file write
    products.push(newProduct);
    fs.writeFileSync(
      path.join(__dirname, 'data/products.json'),
      JSON.stringify(products, null, 2)
    );

    const duration = Date.now() - start;
    logger.info(`Product creation took ${duration}ms`);

    res.status(201).json({
      product: newProduct,
      processingTime: duration,
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Memory leak endpoint for testing
app.get('/api/memory-leak', (req, res) => {
  // PERFORMANCE ISSUE #13: Intentional memory leak for testing
  const largeArray = new Array(100000).fill('Memory leak data');
  global.memoryLeakArray = global.memoryLeakArray || [];
  global.memoryLeakArray.push(largeArray);

  res.json({
    message: 'Memory leak created',
    totalLeaks: global.memoryLeakArray.length,
    memoryUsage: process.memoryUsage(),
  });
});

// CPU intensive endpoint for testing
app.get('/api/cpu-intensive', (req, res) => {
  const start = Date.now();

  // PERFORMANCE ISSUE #14: CPU intensive synchronous operation
  let result = 0;
  for (let i = 0; i < 10000000; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
  }

  const duration = Date.now() - start;

  res.json({
    result,
    processingTime: duration,
    message: 'CPU intensive operation completed',
  });
});

// Error handling middleware
app.use(
  expressWinston.errorLogger({
    winstonInstance: logger,
  })
);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Load data and start server
loadData();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Products API: http://localhost:${PORT}/api/products`);
  console.log(`Search API: http://localhost:${PORT}/api/search?q=laptop`);
  console.log(`Reports API: http://localhost:${PORT}/api/reports/sales`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
