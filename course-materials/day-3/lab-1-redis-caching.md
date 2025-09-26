# Lab 1: Redis Caching Implementation

## Learning Objectives

By the end of this lab, you will be able to:

- Understand the benefits and use cases of Redis caching
- Implement Redis as a caching layer in Node.js applications
- Apply different caching strategies (cache-aside, write-through, write-behind)
- Handle cache invalidation and TTL (Time To Live) policies
- Measure and analyze performance improvements from caching
- Implement cache warming and cache stampede prevention

## Prerequisites

- Node.js (v14 or higher)
- Redis server (v6.0 or higher)
- Basic understanding of Express.js and REST APIs
- Knowledge of async/await patterns

## Scenario

You'll build a news aggregation API that simulates fetching articles from multiple external sources. Without caching, each request would require expensive API calls or database queries. With Redis caching, you'll dramatically improve response times and reduce external API usage.

## Instructions

### Part 1: Project Setup and Redis Configuration

1. **Create a new Node.js project:**

   ```bash
   mkdir redis-caching-lab
   cd redis-caching-lab
   npm init -y
   ```

2. **Install required dependencies:**

   ```bash
   npm install express redis dotenv cors
   npm install --save-dev nodemon
   ```

3. **Install and start Redis server:**

   - **macOS**: `brew install redis && brew services start redis`
   - **Ubuntu**: `sudo apt install redis-server && sudo systemctl start redis`
   - **Windows**: Download from Redis website or use Docker
   - **Docker**: `docker run -d -p 6379:6379 redis:7-alpine`

4. **Create the project structure:**

   ```
   redis-caching-lab/
   ├── config/
   │   └── redis.js
   ├── services/
   │   ├── cacheService.js
   │   └── dataService.js
   ├── middleware/
   │   └── cache.js
   ├── routes/
   │   └── api.js
   ├── utils/
   │   └── performance.js
   ├── server.js
   ├── .env
   └── package.json
   ```

5. **Set up Redis connection with proper error handling and reconnection logic**

### Part 2: Cache Service Implementation

1. **Create a comprehensive cache service:**

   - Implement get, set, delete operations with error handling
   - Support different data types (strings, objects, arrays)
   - Handle serialization/deserialization automatically
   - Implement cache key namespacing and patterns

2. **Add TTL (Time To Live) strategies:**
   - Fixed expiration times for static data
   - Sliding expiration for frequently accessed data
   - Different TTL values based on data importance

### Part 3: Data Service with Simulated External APIs

1. **Create realistic data sources:**

   - News articles from multiple sources
   - User profiles with heavy computation
   - Product catalogs with complex filtering
   - Weather data with location-based queries

2. **Simulate realistic delays:**
   - Add artificial delays to represent network latency
   - Implement random failures to test error handling
   - Create data that changes over time

### Part 4: Caching Strategies Implementation

1. **Cache-Aside Pattern (Lazy Loading):**

   - Check cache first, fetch from source if miss
   - Store result in cache after fetching
   - Most common and flexible pattern

2. **Write-Through Pattern:**

   - Write to cache and database simultaneously
   - Ensures cache consistency
   - Higher write latency but better read performance

3. **Write-Behind Pattern (Optional):**
   - Write to cache immediately, database asynchronously
   - Best performance but potential data loss risk
   - Implement with queue system

### Part 5: Advanced Caching Features

1. **Cache warming:**

   - Pre-populate cache with frequently accessed data
   - Background jobs to refresh cache before expiration
   - Implement cache warming strategies

2. **Cache stampede prevention:**
   - Use Redis locks to prevent multiple simultaneous requests
   - Implement exponential backoff for retries
   - Handle thundering herd scenarios

### Part 6: Cache Invalidation Strategies

1. **Manual cache invalidation:**

   - Admin endpoints to clear specific cache keys
   - Bulk cache clearing by patterns
   - Cache statistics and monitoring endpoints

2. **Automatic invalidation:**

   - Time-based expiration (TTL)
   - Event-driven invalidation on data changes
   - Cache tagging for grouped invalidation

3. **Cache versioning:**
   - Implement cache versioning for gradual rollouts
   - Handle cache format changes gracefully
   - Version-aware cache keys

### Part 7: Performance Monitoring and Analytics

1. **Cache metrics:**

   - Hit/miss ratios
   - Response time improvements
   - Cache memory usage
   - Key distribution analysis

2. **Performance comparison:**
   - Benchmark cached vs uncached endpoints
   - Load testing with different cache configurations
   - Memory usage optimization

### Part 8: Error Handling and Resilience

1. **Fallback strategies:**

   - Graceful degradation when Redis is unavailable
   - Circuit breaker pattern for Redis connections
   - Backup caching mechanisms

2. **Data consistency:**
   - Handle cache and database synchronization
   - Implement eventual consistency patterns
   - Deal with stale data scenarios

## Key Concepts to Understand

### Cache Patterns

- **Cache-Aside (Lazy Loading)**: Application manages cache, loads data on demand
- **Write-Through**: Write to cache and database simultaneously
- **Write-Behind**: Write to cache first, database later asynchronously
- **Refresh-Ahead**: Proactively refresh cache before expiration

### Redis Data Types for Caching

- **Strings**: Simple key-value pairs for basic caching
- **Hashes**: Store objects with multiple fields
- **Lists**: Cache ordered data like recent items
- **Sets**: Cache unique collections
- **Sorted Sets**: Cache ranked/scored data

### Performance Considerations

- **Memory usage**: Monitor Redis memory consumption
- **Network latency**: Consider Redis location and connection pooling
- **Serialization overhead**: JSON vs binary serialization
- **Cache size limits**: Implement eviction policies

## Deliverables

### Required Submissions

1. **Complete working application** with Redis caching implementation
2. **Performance benchmarks** showing improvement with caching
3. **Multiple caching strategies** implemented (cache-aside, write-through)
4. **Cache invalidation system** with manual and automatic clearing
5. **Error handling** for Redis connection failures
6. **Documentation** explaining:
   - Caching strategy decisions
   - Performance improvements achieved
   - Cache key naming conventions
   - TTL strategies used

### Bonus Points

- Cache warming implementation
- Cache stampede prevention
- Advanced Redis features (pub/sub, Lua scripts)
- Load testing with cache performance analysis
- Cache monitoring dashboard

## Testing Your Implementation

### Performance Testing Commands

```bash
# Test without cache (first request)
time curl http://localhost:3000/api/news

# Test with cache (subsequent requests)
time curl http://localhost:3000/api/news

# Load testing with curl
for i in {1..100}; do
  curl http://localhost:3000/api/news &
done
wait

# Clear cache and test again
curl -X DELETE http://localhost:3000/api/cache/news
time curl http://localhost:3000/api/news
```

### Verification Scenarios

1. **Cache hit scenario**: Multiple requests should return cached data quickly
2. **Cache miss scenario**: First request should be slower, subsequent fast
3. **Cache expiration**: Wait for TTL expiry, verify fresh data fetch
4. **Redis failure**: Stop Redis, verify application still works (degraded)
5. **Memory usage**: Monitor Redis memory with different cache sizes

## Example API Endpoints to Test

```bash
# Get news articles (cached)
GET /api/news

# Get user profile (cached with different TTL)
GET /api/users/:id

# Get weather data (location-based caching)
GET /api/weather/:city

# Cache management endpoints
GET /api/cache/stats
DELETE /api/cache/clear
POST /api/cache/warm
```

## Resources

### Documentation

- [Redis Node.js Client](https://github.com/redis/node-redis)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/caching/)
- [Express.js Documentation](https://expressjs.com/)
- [Redis Data Types](https://redis.io/docs/data-types/)

### Advanced Topics

- [Redis Persistence](https://redis.io/docs/manual/persistence/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Redis Lua Scripts](https://redis.io/docs/manual/programmability/lua-scripting/)
- [Redis Cluster](https://redis.io/docs/manual/scaling/)

### Performance and Monitoring

- [Redis Memory Optimization](https://redis.io/docs/manual/memory-optimization/)
- [Redis Monitoring](https://redis.io/docs/manual/admin/)
- [Cache Performance Patterns](https://redis.io/docs/manual/patterns/)

---

**Important Notes:**

- Redis should be treated as a cache, not primary storage
- Always implement fallback mechanisms for cache failures
- Monitor cache hit ratios and adjust TTL values accordingly
- Consider data consistency requirements when choosing cache patterns
- Use Redis pipelines for bulk operations to reduce network roundtrips
