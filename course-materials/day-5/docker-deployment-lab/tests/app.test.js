const request = require('supertest');
const app = require('../app');

describe('Docker Deployment Lab API', () => {
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toMatchObject({
        message: 'Welcome to Docker Deployment Lab!',
        environment: expect.any(String),
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'OK',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        requestId: expect.any(String),
        checks: {
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            unit: 'MB',
          },
          cpu: {
            load: expect.any(Object),
          },
        },
      });
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/ready').expect(200);

      expect(response.body).toMatchObject({
        status: 'Ready',
        timestamp: expect.any(String),
        services: expect.any(Object),
        requestId: expect.any(String),
      });
    });
  });

  describe('GET /live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/live').expect(200);

      expect(response.body).toMatchObject({
        status: 'Alive',
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('GET /api/info', () => {
    it('should return application information', async () => {
      const response = await request(app).get('/api/info').expect(200);

      expect(response.body).toMatchObject({
        application: 'Docker Deployment Lab',
        node_version: expect.any(String),
        platform: expect.any(String),
        arch: expect.any(String),
        environment: expect.any(String),
        port: expect.any(Number),
        requestId: expect.any(String),
      });
    });
  });

  describe('GET /api/users', () => {
    it('should return users list', async () => {
      const response = await request(app).get('/api/users').expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        count: expect.any(Number),
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
      });
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User created successfully',
        data: {
          id: expect.any(Number),
          name: userData.name,
          email: userData.email,
          role: userData.role,
          created_at: expect.any(String),
        },
        requestId: expect.any(String),
      });
    });

    it('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Name and email are required',
        requestId: expect.any(String),
      });
    });

    it('should use default role when not provided', async () => {
      const userData = {
        name: 'Default Role User',
        email: 'default@example.com',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body.data.role).toBe('user');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      // Make multiple requests quickly
      const requests = Array(10)
        .fill()
        .map(() => request(app).get('/api/info'));

      const responses = await Promise.all(requests);

      // All requests should succeed initially
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    }, 10000);
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Route not found',
        path: '/non-existent-route',
        method: 'GET',
        requestId: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should include request ID in all responses', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.requestId).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Security headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '0',
      });
    });
  });
});
