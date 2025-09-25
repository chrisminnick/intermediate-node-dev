# Lab 1: Redis Caching Implementation

## Objective
Implement Redis caching in a Node.js application to improve performance and reduce database load.

## Instructions

### Part 1: Project Setup
1. Create a Node.js project and install dependencies:
   - `express` for the API
   - `redis` for caching
2. Set up a basic Express server and connect to a Redis instance.

### Part 2: API Endpoint with Caching
1. Create an API endpoint (e.g., `/api/data`) that fetches data from a simulated database or external API.
2. Before fetching, check Redis for a cached value:
   - If found, return the cached value.
   - If not found, fetch the data, store it in Redis, and return it.
3. Set an expiration time for cached data (e.g., 60 seconds).

### Part 3: Cache Invalidation (Optional)
- Add an endpoint to manually clear or update the cache.
- Implement automatic cache invalidation when data changes.

## Deliverables
- Express server code with Redis caching
- Example API endpoint using cache
- Brief explanation of caching benefits

## Resources
- [Redis npm package](https://www.npmjs.com/package/redis)
- [Express.js Documentation](https://expressjs.com/)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/caching/)

---

**Tip:** Focus on integrating Redis for caching and measuring performance improvements. Add cache invalidation if time allows.
