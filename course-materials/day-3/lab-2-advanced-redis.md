# Lab 2: Advanced Redis Usage

## Objective

Learn how to use Redis for pub/sub messaging and implement rate limiting in a Node.js application.

## Instructions

### Part 1: Redis Pub/Sub

1. Create a simple Node.js script that uses the `redis` npm package.
2. Implement a publisher that sends messages to a channel called `notifications`.
3. Implement a subscriber that listens for messages on the `notifications` channel and logs them to the console.
4. Run both scripts and demonstrate message delivery.

### Part 2: Rate Limiting with Redis

1. Build a simple Express.js API endpoint (e.g., `/api/data`).
2. Use Redis to track requests per IP address and limit each IP to 5 requests per minute.
3. If the limit is exceeded, respond with HTTP 429 (Too Many Requests).
4. Test your endpoint using a tool like Postman or curl.

## Deliverables

- Publisher and subscriber scripts for Redis pub/sub.
- Express.js API with Redis-based rate limiting.
- Brief explanation of how Redis is used in each part.

## Resources

- [Redis npm package](https://www.npmjs.com/package/redis)
- [Express.js documentation](https://expressjs.com/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Rate Limiting with Redis](https://redis.io/docs/manual/patterns/rate-limiting/)

## Bonus

- Implement a dashboard that shows real-time messages received via pub/sub.
- Make the rate limit configurable via environment variables.
