# Day 4: Performance, Scalability & Testing

## Session 1: Performance Profiling & Optimization Techniques

**Duration**: 90 minutes  
**Objective**: Master application performance analysis and optimization strategies

### Learning Outcomes

- Profile Node.js applications to identify bottlenecks
- Optimize memory usage and prevent memory leaks
- Implement clustering and load balancing strategies
- Use PM2 for production process management
- Apply horizontal scaling patterns

### Lecture Content

#### 1. Performance Profiling Tools (30 minutes)

**Built-in Profiling:**

- `--inspect` flag with Chrome DevTools
- `--trace-events` for detailed performance traces
- `process.memoryUsage()` for memory monitoring
- `process.cpuUsage()` for CPU monitoring

**Performance Hooks API:**

```javascript
const { performance, PerformanceObserver } = require('perf_hooks');

// Mark and measure performance
performance.mark('operation-start');
// ... operation code ...
performance.mark('operation-end');
performance.measure('operation-duration', 'operation-start', 'operation-end');
```

**Third-party Tools:**

- **Clinic.js**: Complete performance diagnostic toolkit
- **0x**: Advanced flame graph profiler
- **AutoCannon**: HTTP load testing tool
- **Lighthouse CI**: Automated performance testing

#### 2. Memory Optimization (30 minutes)

**Memory Leak Patterns:**

- Unclosed event listeners
- Circular references
- Global variable accumulation
- Unclosed streams and connections
- Timer references not cleared

**Monitoring Strategies:**

```javascript
// Memory usage monitoring
function monitorMemory() {
  const usage = process.memoryUsage();
  console.log({
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB',
  });
}

setInterval(monitorMemory, 5000);
```

#### 3. Clustering and Load Balancing (30 minutes)

**Node.js Cluster Module:**

- Master-worker architecture
- Load distribution strategies
- Inter-process communication
- Graceful shutdown handling

**PM2 Features:**

- Process management and monitoring
- Built-in load balancer
- Zero-downtime deployments
- Log management and rotation
- Memory and CPU monitoring

### Code Examples

#### Advanced Performance Monitor

```javascript
const { performance, PerformanceObserver } = require('perf_hooks');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      memoryCheckInterval: 5000,
      cpuCheckInterval: 1000,
      alertThresholds: {
        memory: 80, // Percentage
        cpu: 90, // Percentage
        responseTime: 1000, // Milliseconds
      },
      ...options,
    };

    this.stats = {
      memory: { current: 0, peak: 0, average: 0, samples: [] },
      cpu: { current: 0, peak: 0, average: 0, samples: [] },
      requests: { total: 0, errors: 0, averageResponseTime: 0 },
      uptime: process.uptime(),
    };

    this.setupObservers();
    this.startMonitoring();
  }

  setupObservers() {
    // Performance observer for custom metrics
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          this.recordResponseTime(entry.duration);

          if (entry.duration > this.options.alertThresholds.responseTime) {
            this.emit('alert', {
              type: 'slow_response',
              value: entry.duration,
              threshold: this.options.alertThresholds.responseTime,
              operation: entry.name,
            });
          }
        }
      });
    });

    obs.observe({ entryTypes: ['measure', 'mark'] });
  }

  startMonitoring() {
    // Memory monitoring
    this.memoryInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.memoryCheckInterval);

    // CPU monitoring
    this.cpuInterval = setInterval(() => {
      this.checkCpuUsage();
    }, this.options.cpuCheckInterval);

    // Graceful shutdown
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());
  }

  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const rssInMB = usage.rss / 1024 / 1024;
    const heapUsedInMB = usage.heapUsed / 1024 / 1024;
    const heapTotalInMB = usage.heapTotal / 1024 / 1024;

    const memoryUsagePercent = (heapUsedInMB / heapTotalInMB) * 100;

    this.stats.memory.current = memoryUsagePercent;
    this.stats.memory.peak = Math.max(
      this.stats.memory.peak,
      memoryUsagePercent
    );

    // Keep sliding window of samples
    this.stats.memory.samples.push(memoryUsagePercent);
    if (this.stats.memory.samples.length > 100) {
      this.stats.memory.samples.shift();
    }

    this.stats.memory.average =
      this.stats.memory.samples.reduce((a, b) => a + b, 0) /
      this.stats.memory.samples.length;

    if (memoryUsagePercent > this.options.alertThresholds.memory) {
      this.emit('alert', {
        type: 'high_memory',
        value: memoryUsagePercent,
        threshold: this.options.alertThresholds.memory,
        details: {
          rss: rssInMB,
          heapUsed: heapUsedInMB,
          heapTotal: heapTotalInMB,
        },
      });
    }

    this.emit('memory_update', {
      percent: memoryUsagePercent,
      rss: rssInMB,
      heapUsed: heapUsedInMB,
      heapTotal: heapTotalInMB,
    });
  }

  checkCpuUsage() {
    const startUsage = process.cpuUsage();

    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const cpuPercent = ((endUsage.user + endUsage.system) / 1000000) * 100;

      this.stats.cpu.current = cpuPercent;
      this.stats.cpu.peak = Math.max(this.stats.cpu.peak, cpuPercent);

      this.stats.cpu.samples.push(cpuPercent);
      if (this.stats.cpu.samples.length > 100) {
        this.stats.cpu.samples.shift();
      }

      this.stats.cpu.average =
        this.stats.cpu.samples.reduce((a, b) => a + b, 0) /
        this.stats.cpu.samples.length;

      if (cpuPercent > this.options.alertThresholds.cpu) {
        this.emit('alert', {
          type: 'high_cpu',
          value: cpuPercent,
          threshold: this.options.alertThresholds.cpu,
        });
      }

      this.emit('cpu_update', { percent: cpuPercent });
    }, 100);
  }

  recordResponseTime(duration) {
    this.stats.requests.total++;

    // Calculate running average
    const currentAverage = this.stats.requests.averageResponseTime;
    const totalRequests = this.stats.requests.total;

    this.stats.requests.averageResponseTime =
      (currentAverage * (totalRequests - 1) + duration) / totalRequests;
  }

  recordError() {
    this.stats.requests.errors++;
  }

  // Express middleware for automatic monitoring
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const startMark = `request-start-${req.url}-${startTime}`;
      const endMark = `request-end-${req.url}-${startTime}`;

      performance.mark(startMark);

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args) => {
        performance.mark(endMark);
        performance.measure(`${req.method} ${req.url}`, startMark, endMark);

        if (res.statusCode >= 400) {
          this.recordError();
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  generateReport() {
    const stats = this.getStats();

    return {
      summary: {
        uptime: `${Math.floor(stats.uptime / 3600)}h ${Math.floor(
          (stats.uptime % 3600) / 60
        )}m`,
        totalRequests: stats.requests.total,
        errorRate:
          ((stats.requests.errors / stats.requests.total) * 100).toFixed(2) +
          '%',
        avgResponseTime: Math.round(stats.requests.averageResponseTime) + 'ms',
      },
      performance: {
        memory: {
          current: Math.round(stats.memory.current) + '%',
          peak: Math.round(stats.memory.peak) + '%',
          average: Math.round(stats.memory.average) + '%',
        },
        cpu: {
          current: Math.round(stats.cpu.current) + '%',
          peak: Math.round(stats.cpu.peak) + '%',
          average: Math.round(stats.cpu.average) + '%',
        },
      },
      recommendations: this.generateRecommendations(stats),
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.memory.average > 70) {
      recommendations.push(
        'High memory usage detected. Consider implementing memory optimization strategies.'
      );
    }

    if (stats.cpu.average > 80) {
      recommendations.push(
        'High CPU usage detected. Consider load balancing or optimizing CPU-intensive operations.'
      );
    }

    if (stats.requests.averageResponseTime > 500) {
      recommendations.push(
        'Slow response times detected. Consider caching, database optimization, or code profiling.'
      );
    }

    if (stats.requests.errors / stats.requests.total > 0.05) {
      recommendations.push(
        'High error rate detected. Review error logs and implement better error handling.'
      );
    }

    return recommendations;
  }

  stop() {
    clearInterval(this.memoryInterval);
    clearInterval(this.cpuInterval);
    console.log('Performance monitoring stopped');
  }
}

module.exports = PerformanceMonitor;
```

---

## Session 2: Testing Strategies & Test-Driven Development

**Duration**: 75 minutes  
**Objective**: Implement comprehensive testing strategies for Node.js applications

### Learning Outcomes

- Design effective testing strategies (unit, integration, e2e)
- Implement test-driven development (TDD) workflows
- Use advanced testing tools and techniques
- Create comprehensive test suites with good coverage
- Test asynchronous code and real-time features

### Lecture Content

#### 1. Testing Pyramid (25 minutes)

**Test Types:**

- **Unit Tests**: Individual functions/modules (70%)
- **Integration Tests**: Component interactions (20%)
- **End-to-End Tests**: Full user workflows (10%)

**Testing Frameworks:**

- **Jest**: Feature-rich testing framework
- **Mocha**: Flexible testing framework
- **Vitest**: Fast Vite-native testing
- **Supertest**: HTTP assertion library

#### 2. Test-Driven Development (25 minutes)

**TDD Cycle:**

1. **Red**: Write failing test
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests green

**Benefits:**

- Better code design
- Comprehensive test coverage
- Reduced debugging time
- Living documentation

#### 3. Advanced Testing Techniques (25 minutes)

**Mocking and Stubbing:**

- External API mocking
- Database mocking
- Time/date mocking
- File system mocking

**Testing Async Code:**

- Promise testing
- Callback testing
- Event emitter testing
- Stream testing

### Code Examples

#### Comprehensive Test Suite

```javascript
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('User Authentication API', () => {
  let mongoServer;
  let authToken;
  let testUser;

  // Setup test database
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean database before each test
    await User.deleteMany({});

    // Create test user
    testUser = {
      email: 'test@example.com',
      password: 'securePassword123',
      name: 'Test User',
    };
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should not register user with existing email', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(testUser).expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const invalidUser = { email: 'test@example.com' }; // Missing password and name

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContain('Password is required');
      expect(response.body.errors).toContain('Name is required');
    });

    it('should validate email format', async () => {
      const invalidUser = {
        ...testUser,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.errors).toContain('Invalid email format');
    });

    it('should validate password strength', async () => {
      const weakPasswordUser = {
        ...testUser,
        password: '123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.errors).toContain(
        'Password must be at least 8 characters'
      );
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register user before login tests
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.email).toBe(testUser.email);
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should not login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });
  });

  describe('Protected Routes', () => {
    beforeEach(async () => {
      // Register and login to get auth token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      authToken = registerResponse.body.token;
    });

    describe('GET /api/users/profile', () => {
      it('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(testUser.email);
      });

      it('should not access profile without token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body.error).toContain('No token provided');
      });

      it('should not access profile with invalid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.error).toContain('Invalid token');
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updatedData = {
          name: 'Updated Name',
          bio: 'Updated bio',
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updatedData)
          .expect(200);

        expect(response.body.user.name).toBe(updatedData.name);
        expect(response.body.user.bio).toBe(updatedData.bio);
      });

      it('should not update email through profile endpoint', async () => {
        const maliciousUpdate = {
          email: 'hacker@example.com',
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(maliciousUpdate)
          .expect(400);

        expect(response.body.error).toContain('Email cannot be updated');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginAttempt = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginAttempt)
          .expect(401);
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginAttempt)
        .expect(429);

      expect(response.body.error).toContain('Too many attempts');
    }, 10000); // Increase timeout for this test
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousUser = {
        email: 'test@example.com',
        password: 'securePassword123',
        name: '<script>alert("xss")</script>Malicious User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousUser)
        .expect(201);

      // Name should be sanitized
      expect(response.body.user.name).not.toContain('<script>');
      expect(response.body.user.name).toBe('Malicious User');
    });
  });
});

// Mock external services
jest.mock('../services/EmailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Performance test helpers
describe('Performance Tests', () => {
  it('should handle concurrent requests efficiently', async () => {
    // Register test user first
    await request(app).post('/api/auth/register').send(testUser);

    const startTime = Date.now();
    const concurrentRequests = 50;

    const requests = Array(concurrentRequests)
      .fill()
      .map(() =>
        request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: testUser.password,
        })
      );

    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // All requests should succeed
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });

    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds

    console.log(
      `${concurrentRequests} concurrent requests completed in ${duration}ms`
    );
  }, 30000);
});
```

### Discussion Topics

1. How do you balance test coverage with development speed?
2. What's the appropriate level of mocking in integration tests?
3. How do you test real-time features like WebSockets?
4. When should you write tests first vs after implementation?
5. How do you maintain test quality as the codebase grows?
