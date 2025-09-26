const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const Application = require('../../src/app');

describe('Auth Routes', () => {
  let app;
  let appInstance;

  beforeAll(async () => {
    appInstance = new Application();
    app = await appInstance.initialize();
  });

  afterAll(async () => {
    await appInstance.shutdown();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty(
        'message',
        'User registered successfully'
      );
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'user',
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Please provide a valid email',
          }),
        ])
      );
    });

    it('should not register user with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('Password must'),
          }),
        ])
      );
    });

    it('should not register user with duplicate email', async () => {
      const user = await global.testUtils.createTestUser();

      const userData = {
        email: user.email,
        password: 'SecurePass123!',
        firstName: 'Another',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Email already registered');
    });

    it('should hash password before storing', async () => {
      const userData = {
        email: 'hashtest@example.com',
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test',
      };

      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Verify password is hashed in database
      const database = require('../../src/database/connection');
      const result = await database.query(
        'SELECT password_hash FROM users WHERE email = $1',
        [userData.email]
      );

      expect(result.rows[0].password_hash).not.toBe(userData.password);
      expect(result.rows[0].password_hash).toMatch(/^\$2[ayb]\$/);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser({
        email: 'login@example.com',
        password: 'LoginPass123!',
      });
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should not login inactive user', async () => {
      // Deactivate user
      const database = require('../../src/database/connection');
      await database.query('UPDATE users SET is_active = false WHERE id = $1', [
        testUser.id,
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Account is deactivated');
    });

    it('should update last_login on successful login', async () => {
      const beforeLogin = new Date();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      // Check that last_login was updated
      const database = require('../../src/database/connection');
      const result = await database.query(
        'SELECT last_login FROM users WHERE id = $1',
        [testUser.id]
      );

      const lastLogin = new Date(result.rows[0].last_login);
      expect(lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const { token } = response.body;
      const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

      // Verify token can be decoded
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser;
    let validToken;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser();
      validToken = global.testUtils.generateAuthToken(testUser);
    });

    it('should refresh valid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Token refreshed successfully'
      );
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).not.toBe(validToken);
    });

    it('should not refresh without token', async () => {
      const response = await request(app).post('/api/auth/refresh').expect(401);

      expect(response.body).toHaveProperty('error', 'No token provided');
    });

    it('should not refresh invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should not refresh token for inactive user', async () => {
      // Deactivate user
      const database = require('../../src/database/connection');
      await database.query('UPDATE users SET is_active = false WHERE id = $1', [
        testUser.id,
      ]);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser();
    });

    it('should accept forgot password request for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('password reset link');
    });

    it('should return success for non-existent user (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('password reset link');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });
});
