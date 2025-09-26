# Redis Caching Lab

A comprehensive demonstration of Redis caching strategies for Node.js applications, focusing on performance optimization, cache management, and real-world caching patterns.

## 🎯 Learning Objectives

After completing this lab, you will understand:

- Multiple Redis caching strategies (cache-aside, write-through)
- Cache stampede prevention techniques
- Performance monitoring and benchmarking
- Cache warming and invalidation strategies
- TTL (Time To Live) management
- Fallback mechanisms for cache failures
- Production-ready caching patterns

## 🛠 Prerequisites

- Node.js 14+ installed
- Redis server installed and running
- Basic understanding of Express.js
- Familiarity with async/await patterns

## 🚀 Quick Start

### 1. Install Redis

**macOS (using Homebrew):**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Docker:**

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 2. Set Up the Project

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Verify Redis is running
npm run redis:ping
# Should return: PONG

# Start the development server
npm run dev
```

### 3. Test the Application

Visit `http://localhost:3000` for comprehensive API documentation, or try these endpoints:

```bash
# Get API documentation
curl http://localhost:3000

# Test caching with news endpoint
curl "http://localhost:3000/api/news?category=technology&limit=5"

# Check cache statistics
curl http://localhost:3000/api/cache/stats

# Clear cache
curl -X DELETE http://localhost:3000/api/cache/clear

# Warm up cache
curl -X POST http://localhost:3000/api/cache/warm
```

## 📊 Key Features Demonstrated

### 1. Caching Strategies

**Cache-Aside Pattern:**

- Check cache first
- On miss, fetch from source and cache result
- Implements automatic fallback on Redis failures

**Write-Through Pattern:**

- Write to cache and data source simultaneously
- Ensures consistency between cache and source

### 2. Performance Optimization

**Cache Stampede Prevention:**

- Prevents multiple simultaneous requests for the same data
- Uses Redis SETNX for atomic locking
- Implements exponential backoff for lock contention

**TTL Management:**

- Different expiration times based on data characteristics
- News: 5 minutes (frequently changing)
- User profiles: 10 minutes (moderate changes)
- Weather: 10 minutes (periodic updates)
- Products: 30 minutes (stable data)
- Reports: 1 hour (expensive to generate)

### 3. Cache Management

**Namespace Organization:**

```
news:technology:page-1
users:12345
weather:san-francisco
products:electronics:page-1
reports:monthly-sales
```

**Batch Operations:**

- Cache warming for popular content
- Bulk invalidation by namespace
- Efficient cache key management

### 4. Monitoring & Analytics

**Performance Metrics:**

- Request count and timing
- Cache hit/miss ratios
- Response time comparisons
- Memory usage tracking

**Real-time Statistics:**

- Cache operations per second
- Average response times
- Error rates and patterns
- Redis server health monitoring

## 🔧 API Endpoints

### Data Endpoints (Cached)

| Endpoint                 | Description       | Cache TTL  | Strategy    |
| ------------------------ | ----------------- | ---------- | ----------- |
| `GET /api/news`          | News articles     | 5 minutes  | Cache-aside |
| `GET /api/users/:id`     | User profiles     | 10 minutes | Cache-aside |
| `GET /api/weather/:city` | Weather data      | 10 minutes | Cache-aside |
| `GET /api/products`      | Product catalog   | 30 minutes | Cache-aside |
| `GET /api/reports/:type` | Generated reports | 1 hour     | Cache-aside |

### Cache Management

| Endpoint                      | Description        | Method |
| ----------------------------- | ------------------ | ------ |
| `/api/cache/stats`            | Cache statistics   | GET    |
| `/api/cache/clear`            | Clear all cache    | DELETE |
| `/api/cache/clear/:namespace` | Clear by namespace | DELETE |
| `/api/cache/warm`             | Warm popular data  | POST   |
| `/api/cache/keys/:namespace?` | List cache keys    | GET    |

### Performance Monitoring

| Endpoint                   | Description           | Method |
| -------------------------- | --------------------- | ------ |
| `/api/benchmark/:endpoint` | Benchmark performance | GET    |
| `/performance/stats`       | Application metrics   | GET    |
| `/performance/report`      | Detailed report       | GET    |
| `/health`                  | System health check   | GET    |

## 🎮 Hands-On Exercises

### Exercise 1: Basic Caching Behavior

1. **Make your first cached request:**

   ```bash
   curl "http://localhost:3000/api/news?category=technology&limit=3"
   ```

   Notice the response time in the logs.

2. **Make the same request again:**

   ```bash
   curl "http://localhost:3000/api/news?category=technology&limit=3"
   ```

   Notice the much faster response time and `X-Cache: HIT` header.

3. **Check cache statistics:**
   ```bash
   curl http://localhost:3000/api/cache/stats
   ```

### Exercise 2: Cache Performance Comparison

1. **Clear the cache:**

   ```bash
   curl -X DELETE http://localhost:3000/api/cache/clear
   ```

2. **Benchmark an endpoint:**

   ```bash
   curl "http://localhost:3000/api/benchmark/news?iterations=10"
   ```

3. **Compare cached vs uncached performance:**
   ```bash
   curl http://localhost:3000/performance/report
   ```

### Exercise 3: Cache Warming

1. **Warm up the cache:**

   ```bash
   curl -X POST http://localhost:3000/api/cache/warm
   ```

2. **Test multiple endpoints:**

   ```bash
   curl "http://localhost:3000/api/users/123"
   curl "http://localhost:3000/api/weather/san-francisco"
   curl "http://localhost:3000/api/products?category=electronics"
   ```

3. **Check hit ratios:**
   ```bash
   curl http://localhost:3000/api/cache/stats
   ```

### Exercise 4: Cache Invalidation

1. **List all cache keys:**

   ```bash
   curl http://localhost:3000/api/cache/keys
   ```

2. **Clear specific namespace:**

   ```bash
   curl -X DELETE http://localhost:3000/api/cache/clear/news
   ```

3. **Verify selective clearing:**
   ```bash
   curl http://localhost:3000/api/cache/keys
   ```

### Exercise 5: Load Testing

1. **Generate sustained load:**

   ```bash
   # Run multiple concurrent requests
   for i in {1..20}; do
     curl "http://localhost:3000/api/news?category=tech&page=$i" &
   done
   wait
   ```

2. **Monitor performance:**

   ```bash
   curl http://localhost:3000/performance/stats
   ```

3. **Test cache stampede prevention:**
   ```bash
   # Clear cache and make simultaneous requests
   curl -X DELETE http://localhost:3000/api/cache/clear
   for i in {1..10}; do
     curl "http://localhost:3000/api/reports/monthly-sales" &
   done
   wait
   ```

## 🔬 Code Deep Dive

### Cache Service Architecture

The `CacheService` class implements multiple caching patterns:

```javascript
class CacheService {
  // Cache-aside pattern with stampede prevention
  async get(key, fetchFunction, ttl, options = {}) {
    // 1. Check cache first
    // 2. On miss, acquire lock
    // 3. Fetch and cache data
    // 4. Handle concurrent requests
  }

  // Batch operations for efficiency
  async mget(keys) {
    // Retrieve multiple keys in single operation
  }

  async mset(keyValueMap, ttl) {
    // Set multiple keys atomically
  }
}
```

### Performance Monitoring

The application tracks detailed metrics:

```javascript
{
  summary: {
    totalRequests: 1250,
    cachedRequests: 892,
    uncachedRequests: 358,
    cacheHitRatio: 71.36,
    averageResponseTime: 45.2
  },
  responseTimeStats: {
    cached: { min: 1, max: 15, average: 8.3 },
    uncached: { min: 150, max: 800, average: 385.7 }
  },
  endpointStats: {
    "/api/news": { requests: 450, hitRatio: 78.2 },
    "/api/users": { requests: 320, hitRatio: 65.6 }
  }
}
```

### Redis Connection Management

Robust connection handling with automatic reconnection:

```javascript
class RedisConfig {
  async connect() {
    this.client = createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        // Exponential backoff with jitter
        return Math.min(options.attempt * 100, 3000);
      },
    });

    this.client.on('error', this.handleError.bind(this));
    this.client.on('connect', this.handleConnect.bind(this));
    this.client.on('reconnecting', this.handleReconnecting.bind(this));
  }
}
```

## 🚨 Common Issues & Solutions

### Redis Connection Errors

**Problem:** `ECONNREFUSED` errors
**Solution:**

```bash
# Check if Redis is running
redis-cli ping

# Start Redis service
brew services start redis  # macOS
sudo systemctl start redis # Linux
```

### Memory Management

**Problem:** Redis running out of memory
**Solution:**

```bash
# Check memory usage
redis-cli info memory

# Configure max memory
redis-cli config set maxmemory 100mb
redis-cli config set maxmemory-policy allkeys-lru
```

### Cache Stampede

**Problem:** Multiple requests for same expensive operation
**Solution:** The application implements automatic stampede prevention using Redis locks.

### Performance Degradation

**Problem:** Slow response times
**Solution:**

1. Check cache hit ratios: `GET /api/cache/stats`
2. Monitor Redis performance: `redis-cli --latency`
3. Analyze endpoint performance: `GET /performance/report`

## 📈 Performance Best Practices

### 1. TTL Strategy

- **Short TTL (1-5 minutes):** Frequently changing data (news, stock prices)
- **Medium TTL (10-30 minutes):** Semi-static data (user profiles, product info)
- **Long TTL (1+ hours):** Expensive computations (reports, analytics)

### 2. Cache Key Design

- Use hierarchical namespaces: `category:subcategory:identifier`
- Include version information: `users:v2:12345`
- Avoid special characters and spaces

### 3. Memory Optimization

- Use appropriate data structures (strings vs hashes vs sets)
- Implement cache eviction policies
- Monitor memory usage regularly

### 4. Error Handling

- Always implement fallback mechanisms
- Log cache failures for monitoring
- Use circuit breakers for external dependencies

## 🧪 Testing & Validation

### Unit Tests

```bash
npm test
```

### Benchmark Tests

```bash
npm run benchmark
```

### Redis Monitoring

```bash
# Monitor Redis commands
npm run redis:monitor

# Check Redis info
npm run redis:info

# Test connection
npm run redis:ping
```

## 🎓 Learning Challenges

### Challenge 1: Custom Cache Strategy

Implement a **write-behind** caching strategy for the user update endpoint.

### Challenge 2: Cache Hierarchy

Create a multi-level cache using both Redis and in-memory caching.

### Challenge 3: Cache Analytics

Extend the performance monitoring to include cache efficiency scoring.

### Challenge 4: Distributed Caching

Implement cache invalidation across multiple application instances.

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [Node.js Redis Client](https://github.com/redis/node-redis)
- [Caching Strategies and Patterns](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/Strategies.html)
- [Redis Best Practices](https://redis.io/docs/manual/config/)

## 🤝 Contributing

This lab is part of the Intermediate Node.js Development course. For improvements or suggestions:

1. Identify areas for enhancement
2. Test thoroughly with the provided examples
3. Document any new patterns or strategies
4. Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy Caching! 🚀**

Remember: Caching is not just about speed—it's about building resilient, scalable applications that gracefully handle load and provide consistent user experiences.
