# Day 5: Deployment, DevOps & Production Monitoring

## Session 1: Deployment Strategies & Containerization

**Duration**: 90 minutes  
**Objective**: Deploy Node.js applications to production with Docker and cloud platforms

### Learning Outcomes

- Containerize Node.js applications with Docker
- Implement CI/CD pipelines for automated deployment
- Deploy to major cloud platforms (AWS, Azure, GCP)
- Configure production environment variables and secrets
- Implement zero-downtime deployment strategies

### Lecture Content

#### 1. Containerization with Docker (35 minutes)

**Docker Benefits for Node.js:**

- Consistent runtime environments
- Simplified deployment process
- Scalability and orchestration
- Resource isolation and efficiency

**Multi-stage Docker Builds:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]
```

**Docker Compose for Development:**

- Multi-service orchestration
- Database and cache services
- Development vs production configurations

#### 2. CI/CD Pipeline Implementation (30 minutes)

**Pipeline Stages:**

1. **Source**: Code commit triggers
2. **Build**: Install dependencies, run tests
3. **Test**: Unit, integration, and security tests
4. **Package**: Create Docker images
5. **Deploy**: Deploy to staging/production
6. **Monitor**: Health checks and notifications

**GitHub Actions Example:**

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

#### 3. Cloud Platform Deployment (25 minutes)

**Deployment Options:**

- **AWS**: ECS, Elastic Beanstalk, Lambda
- **Azure**: App Service, Container Instances, Functions
- **GCP**: Cloud Run, App Engine, Cloud Functions
- **Heroku**: Simple platform-as-a-service
- **DigitalOcean**: App Platform, Kubernetes

**Infrastructure as Code:**

- Terraform for resource provisioning
- CloudFormation for AWS resources
- Kubernetes manifests for container orchestration

### Code Examples

#### Production Dockerfile

```dockerfile
# Multi-stage build for Node.js application
FROM node:18-alpine AS base

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
WORKDIR /app
RUN chown nodejs:nodejs /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM base AS production

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json

# Security: Use non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Docker Compose for Full Stack

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=mongodb://mongo:27017/myapp
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6.0
    ports:
      - '27017:27017'
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
      - MONGO_INITDB_DATABASE=myapp
    volumes:
      - mongo_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

#### Complete CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Generate test coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run security audit
        run: npm audit --audit-level high

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    outputs:
      image: ${{ steps.image.outputs.image }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Output image
        id: image
        run: echo "image=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}" >> $GITHUB_OUTPUT

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    environment: staging
    steps:
      - name: Deploy to staging
        uses: azure/webapps-deploy@v2
        with:
          app-name: myapp-staging
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE_STAGING }}
          images: ${{ needs.build.outputs.image }}

      - name: Run smoke tests
        run: |
          curl -f https://myapp-staging.azurewebsites.net/health || exit 1
          # Add more smoke tests here

  deploy-production:
    runs-on: ubuntu-latest
    needs: [build, deploy-staging]
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        uses: azure/webapps-deploy@v2
        with:
          app-name: myapp-production
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE_PRODUCTION }}
          images: ${{ needs.build.outputs.image }}

      - name: Run production smoke tests
        run: |
          curl -f https://myapp.com/health || exit 1
          # Add more comprehensive tests

      - name: Notify team
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Session 2: Production Monitoring & Observability

**Duration**: 75 minutes  
**Objective**: Implement comprehensive monitoring and logging for production applications

### Learning Outcomes

- Configure structured logging with Winston/Pino
- Implement health checks and metrics collection
- Set up error tracking and alerting
- Design observability strategies for distributed systems
- Use APM tools for performance monitoring

### Lecture Content

#### 1. Logging Strategies (25 minutes)

**Structured Logging:**

- JSON format for machine readability
- Consistent log levels and formatting
- Correlation IDs for request tracing
- Log aggregation and analysis

**Log Levels:**

- **ERROR**: Application errors requiring attention
- **WARN**: Potentially harmful situations
- **INFO**: General application flow
- **DEBUG**: Detailed information for debugging

#### 2. Metrics and Health Checks (25 minutes)

**Key Metrics:**

- **RED Method**: Rate, Errors, Duration
- **USE Method**: Utilization, Saturation, Errors
- **Application metrics**: Business-specific KPIs
- **Infrastructure metrics**: CPU, memory, disk, network

**Health Check Types:**

- **Liveness**: Is the application running?
- **Readiness**: Can the application serve traffic?
- **Dependencies**: Are external services available?

#### 3. Error Tracking and Alerting (25 minutes)

**Error Tracking Tools:**

- Sentry for error monitoring
- Rollbar for error reporting
- Bugsnag for crash reporting
- Custom error tracking solutions

**Alerting Strategies:**

- Threshold-based alerts
- Anomaly detection
- Alert fatigue prevention
- Escalation policies

### Code Examples

#### Production Logging Setup

```javascript
const winston = require('winston');
const { createLogger, format, transports } = winston;

class Logger {
  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
        format.printf((info) => {
          const { timestamp, level, message, ...meta } = info;
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta,
            service: process.env.SERVICE_NAME || 'api',
            version: process.env.APP_VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid,
            hostname: require('os').hostname(),
          });
        })
      ),
      defaultMeta: {
        correlationId: this.generateCorrelationId(),
      },
      transports: [
        new transports.Console({
          format:
            process.env.NODE_ENV === 'development'
              ? format.combine(format.colorize(), format.simple())
              : format.json(),
        }),
      ],
    });

    // Add file transport for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true,
        })
      );

      this.logger.add(
        new transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760,
          maxFiles: 5,
          tailable: true,
        })
      );
    }

    this.setupErrorHandling();
  }

  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setupErrorHandling() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', { error: error.stack });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', {
        reason: reason.stack || reason,
        promise: promise.toString(),
      });
    });
  }

  // Express middleware for request logging
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      const correlationId =
        req.headers['x-correlation-id'] || this.generateCorrelationId();

      // Add correlation ID to request
      req.correlationId = correlationId;
      res.setHeader('x-correlation-id', correlationId);

      // Log request
      this.logger.info('Request started', {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        correlationId,
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - start;

        this.logger.info('Request completed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          correlationId,
        });

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Structured logging methods
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Business logic logging
  logUserAction(userId, action, details = {}) {
    this.logger.info('User action', {
      userId,
      action,
      ...details,
      category: 'user_action',
    });
  }

  logPerformance(operation, duration, details = {}) {
    this.logger.info('Performance metric', {
      operation,
      duration,
      ...details,
      category: 'performance',
    });
  }

  logSecurity(event, details = {}) {
    this.logger.warn('Security event', {
      event,
      ...details,
      category: 'security',
    });
  }
}

module.exports = new Logger();
```

#### Health Check Implementation

```javascript
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');

class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.redis = new Redis(process.env.REDIS_URL);
    this.setupDefaultChecks();
  }

  setupDefaultChecks() {
    // Database connectivity check
    this.addCheck('database', async () => {
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }

      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        response_time: `${duration}ms`,
        connection_state: mongoose.connection.readyState,
      };
    });

    // Redis connectivity check
    this.addCheck('redis', async () => {
      const start = Date.now();
      const result = await this.redis.ping();
      const duration = Date.now() - start;

      if (result !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      return {
        status: 'healthy',
        response_time: `${duration}ms`,
      };
    });

    // Memory check
    this.addCheck('memory', async () => {
      const usage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const status = memoryUsagePercent > 90 ? 'unhealthy' : 'healthy';

      return {
        status,
        heap_used: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heap_total: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        system_memory_usage: `${memoryUsagePercent.toFixed(2)}%`,
      };
    });

    // Disk space check
    this.addCheck('disk_space', async () => {
      const fs = require('fs').promises;
      const stats = await fs.statfs('.');
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      const status = usagePercent > 85 ? 'unhealthy' : 'healthy';

      return {
        status,
        total: `${Math.round(total / 1024 / 1024 / 1024)}GB`,
        free: `${Math.round(free / 1024 / 1024 / 1024)}GB`,
        usage_percent: `${usagePercent.toFixed(2)}%`,
      };
    });
  }

  addCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  async runCheck(name) {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check '${name}' not found`);
    }

    try {
      const result = await Promise.race([
        checkFunction(),
        this.timeout(5000), // 5 second timeout
      ]);

      return {
        name,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async runAllChecks() {
    const checks = Array.from(this.checks.keys());
    const results = await Promise.allSettled(
      checks.map((name) => this.runCheck(name))
    );

    const healthChecks = {};
    let overallStatus = 'healthy';

    results.forEach((result, index) => {
      const checkName = checks[index];

      if (result.status === 'fulfilled') {
        healthChecks[checkName] = result.value;
        if (result.value.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        }
      } else {
        healthChecks[checkName] = {
          name: checkName,
          status: 'unhealthy',
          error: result.reason.message,
          timestamp: new Date().toISOString(),
        };
        overallStatus = 'unhealthy';
      }
    });

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: healthChecks,
    };
  }

  timeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  // Express routes
  setupRoutes(app) {
    app.get('/health', async (req, res) => {
      try {
        const health = await this.runAllChecks();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    app.get('/health/live', (req, res) => {
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
      });
    });

    app.get('/health/ready', async (req, res) => {
      try {
        const criticalChecks = ['database', 'redis'];
        const checks = await Promise.all(
          criticalChecks.map((name) => this.runCheck(name))
        );

        const allHealthy = checks.every((check) => check.status === 'healthy');
        const statusCode = allHealthy ? 200 : 503;

        res.status(statusCode).json({
          status: allHealthy ? 'ready' : 'not_ready',
          checks: checks.reduce((acc, check) => {
            acc[check.name] = check;
            return acc;
          }, {}),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}

module.exports = HealthCheckService;
```

### Discussion Topics

1. How do you balance detailed logging with performance?
2. What metrics are most important for your application type?
3. How do you prevent alert fatigue while maintaining coverage?
4. What's the difference between monitoring and observability?
5. How do you implement distributed tracing across services?

This completes the comprehensive 5-day course structure with detailed lectures and practical labs for each day. The course progressively builds from advanced async patterns to production deployment and monitoring, giving students hands-on experience with real-world Node.js development challenges.
