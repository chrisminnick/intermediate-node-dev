const request = require('supertest');
const app = require('../app');

describe('Logging & Monitoring Lab API', () => {
  describe('Health Checks', () => {
    test('GET /health should return application status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'UP',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        version: '1.0.0',
        correlationId: expect.any(String),
      });
    });

    test('GET /health/ready should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(READY|NOT_READY)$/),
        timestamp: expect.any(String),
        dependencies: expect.any(Array),
        responseTime: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    test('GET /health/detailed should return detailed health information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect((res) => {
          expect([200, 207, 503]).toContain(res.status);
        });

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(UP|DEGRADED|DOWN)$/),
        timestamp: expect.any(String),
        application: expect.objectContaining({
          name: 'logging-monitoring-lab',
          version: '1.0.0',
          environment: expect.any(String),
          uptime: expect.any(String),
          pid: expect.any(Number),
          nodeVersion: expect.any(String),
        }),
        system: expect.objectContaining({
          platform: expect.any(String),
          architecture: expect.any(String),
          memory: expect.any(Object),
          cpu: expect.any(Object),
        }),
        dependencies: expect.any(Array),
        correlationId: expect.any(String),
      });
    });

    test('GET /health/live should return liveness status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toMatchObject({
        status: 'ALIVE',
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });
  });

  describe('Metrics Endpoint', () => {
    test('GET /metrics should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('API Routes', () => {
    test('GET / should return welcome message', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining(
          'Welcome to the Logging & Monitoring Lab'
        ),
        version: '1.0.0',
        environment: expect.any(String),
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        endpoints: expect.any(Object),
      });
    });

    test('GET /api/info should return API information', async () => {
      const response = await request(app).get('/api/info').expect(200);

      expect(response.body).toMatchObject({
        name: expect.stringContaining('Logging & Monitoring Lab API'),
        version: '1.0.0',
        description: expect.any(String),
        environment: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(String),
        correlationId: expect.any(String),
        endpoints: expect.any(Array),
      });
    });

    test('GET /api/status should return application status', async () => {
      const response = await request(app).get('/api/status').expect(200);

      expect(response.body).toMatchObject({
        status: 'operational',
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        application: expect.objectContaining({
          uptime: expect.any(Number),
          environment: expect.any(String),
          nodeVersion: expect.any(String),
          pid: expect.any(Number),
        }),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
        }),
      });
    });

    test('GET /api/performance should return performance metrics', async () => {
      const response = await request(app).get('/api/performance').expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        responseTime: expect.stringMatching(/^\d+ms$/),
        memory: expect.any(Object),
        cpu: expect.any(Object),
        uptime: expect.stringMatching(/^\d+s$/),
        eventLoop: expect.any(Object),
      });
    });
  });

  describe('Business Event Logging', () => {
    test('POST /api/events should log business events', async () => {
      const eventData = {
        event: 'test_event',
        data: {
          userId: '123',
          action: 'test_action',
        },
      };

      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Event logged successfully',
        event: 'test_event',
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    test('POST /api/events should require event name', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Event name is required',
        correlationId: expect.any(String),
      });
    });
  });

  describe('Load Simulation', () => {
    test('POST /api/simulate/load should simulate load', async () => {
      const loadData = {
        requests: 5,
        delay: 50,
      };

      const response = await request(app)
        .post('/api/simulate/load')
        .send(loadData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Load simulation completed',
        requests: 5,
        delay: 50,
        totalTime: expect.stringMatching(/^\d+ms$/),
        averageTime: expect.stringMatching(/^\d+ms$/),
        results: expect.any(Array),
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });
  });

  describe('Error Simulation', () => {
    test('POST /api/simulate/error should simulate validation error', async () => {
      const response = await request(app)
        .post('/api/simulate/error')
        .send({ type: 'validation', message: 'Test validation error' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: 'Test validation error',
        code: 'VALIDATION_ERROR',
        correlationId: expect.any(String),
      });
    });

    test('POST /api/simulate/error should simulate unauthorized error', async () => {
      const response = await request(app)
        .post('/api/simulate/error')
        .send({ type: 'unauthorized' })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED_ERROR',
        correlationId: expect.any(String),
      });
    });

    test('POST /api/simulate/error should simulate server error', async () => {
      const response = await request(app)
        .post('/api/simulate/error')
        .send({ type: 'server', message: 'Test server error' })
        .expect(500);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        statusCode: 500,
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        path: '/api/simulate/error',
      });
    });
  });

  describe('User Management', () => {
    test('GET /api/users should return user list', async () => {
      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toMatchObject({
        users: expect.any(Array),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    test('GET /api/users/:id should return user details', async () => {
      const response = await request(app).get('/api/users/1').expect(200);

      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: '1',
          name: expect.any(String),
          email: expect.any(String),
          createdAt: expect.any(String),
        }),
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    test('GET /api/users/:id should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/users/999').expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        path: '/api/users/999',
      });
    });

    test('POST /api/users should create new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User created successfully',
        user: expect.objectContaining({
          id: expect.any(String),
          name: 'Test User',
          email: 'test@example.com',
          createdAt: expect.any(String),
        }),
        timestamp: expect.any(String),
        correlationId: expect.any(String),
      });
    });

    test('POST /api/users should validate user data', async () => {
      const userData = {
        name: '',
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        statusCode: 400,
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: expect.any(String),
            code: 'INVALID_NAME',
          }),
          expect.objectContaining({
            field: 'email',
            message: expect.any(String),
            code: 'INVALID_EMAIL',
          }),
        ]),
      });
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app).get('/nonexistent').expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Cannot GET /nonexistent',
        statusCode: 404,
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        path: '/nonexistent',
      });
    });
  });

  describe('Correlation ID', () => {
    test('Should generate correlation ID for requests', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.correlationId).toBeDefined();
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body.correlationId).toBe(
        response.headers['x-correlation-id']
      );
    });

    test('Should use provided correlation ID', async () => {
      const correlationId = 'test-correlation-id';

      const response = await request(app)
        .get('/')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.body.correlationId).toBe(correlationId);
      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-download-options']).toBe('noopen');
    });
  });
});

describe('Performance Tests', () => {
  test('Health check should respond quickly', async () => {
    const startTime = Date.now();

    await request(app).get('/health').expect(200);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(100); // Should respond within 100ms
  });

  test('Metrics endpoint should handle load', async () => {
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(request(app).get('/metrics').expect(200));
    }

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
  });
});
