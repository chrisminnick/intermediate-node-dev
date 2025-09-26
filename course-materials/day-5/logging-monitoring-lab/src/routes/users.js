const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const {
  asyncErrorHandler,
  ValidationError,
  NotFoundError,
} = require('../middleware/errorHandlers');

// In-memory user store (in production, this would be a database)
const users = new Map();

// Add some sample users
users.set('1', {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date('2024-01-01').toISOString(),
  lastLogin: new Date().toISOString(),
});

users.set('2', {
  id: '2',
  name: 'Jane Smith',
  email: 'jane@example.com',
  createdAt: new Date('2024-01-15').toISOString(),
  lastLogin: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
});

// Validation helper
const validateUser = (userData) => {
  const errors = [];

  if (
    !userData.name ||
    typeof userData.name !== 'string' ||
    userData.name.trim().length < 2
  ) {
    errors.push({
      field: 'name',
      message: 'Name must be at least 2 characters long',
      code: 'INVALID_NAME',
    });
  }

  if (!userData.email || typeof userData.email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email is required',
      code: 'MISSING_EMAIL',
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });
  }

  return errors;
};

// GET /api/users - List all users
router.get(
  '/',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const { page = 1, limit = 10, search } = req.query;

    logger.info('Users list requested', {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      correlationId: req.correlationId,
    });

    // Simulate database query delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

    let userList = Array.from(users.values());

    // Apply search filter if provided
    if (search) {
      userList = userList.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );

      logger.info('User search performed', {
        searchTerm: search,
        results: userList.length,
        correlationId: req.correlationId,
      });
    }

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = userList.slice(startIndex, endIndex);

    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation('select', 'SELECT * FROM users', duration);

    // Record metrics
    metrics.recordDatabaseQuery('users', 'select', duration, 'success');
    metrics.recordBusinessOperation('user_list', duration, 'success');

    const response = {
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: userList.length,
        totalPages: Math.ceil(userList.length / parseInt(limit)),
      },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    };

    logger.info('Users list response', {
      usersReturned: paginatedUsers.length,
      totalUsers: userList.length,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    res.json(response);
  })
);

// GET /api/users/:id - Get user by ID
router.get(
  '/:id',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;

    logger.info('User details requested', {
      userId: id,
      correlationId: req.correlationId,
    });

    // Simulate database query delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 30));

    const user = users.get(id);
    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation(
      'select',
      `SELECT * FROM users WHERE id = '${id}'`,
      duration
    );
    metrics.recordDatabaseQuery(
      'users',
      'select',
      duration,
      user ? 'success' : 'not_found'
    );

    if (!user) {
      logger.warn('User not found', {
        userId: id,
        correlationId: req.correlationId,
      });

      throw new NotFoundError(`User with ID ${id} not found`);
    }

    logger.info('User details response', {
      userId: id,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    metrics.recordBusinessOperation('user_get', duration, 'success');

    res.json({
      user,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// POST /api/users - Create new user
router.post(
  '/',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const userData = req.body;

    logger.info('User creation requested', {
      email: userData.email,
      correlationId: req.correlationId,
    });

    // Validate user data
    const validationErrors = validateUser(userData);
    if (validationErrors.length > 0) {
      logger.warn('User creation validation failed', {
        errors: validationErrors,
        correlationId: req.correlationId,
      });

      throw new ValidationError('User validation failed', validationErrors);
    }

    // Check for duplicate email
    const existingUser = Array.from(users.values()).find(
      (user) => user.email === userData.email
    );
    if (existingUser) {
      logger.warn('Duplicate email attempt', {
        email: userData.email,
        correlationId: req.correlationId,
      });

      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
        code: 'DUPLICATE_EMAIL',
        correlationId: req.correlationId,
      });
    }

    // Simulate database insert delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // Create new user
    const newUser = {
      id: uuidv4(),
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };

    users.set(newUser.id, newUser);

    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation(
      'insert',
      `INSERT INTO users (id, name, email)`,
      duration
    );

    // Record metrics
    metrics.recordDatabaseQuery('users', 'insert', duration, 'success');
    metrics.recordBusinessOperation('user_creation', duration, 'success');
    metrics.userRegistrations.inc({ source: 'api' });

    logger.logBusinessEvent('User Created', {
      userId: newUser.id,
      email: newUser.email,
      correlationId: req.correlationId,
    });

    logger.info('User created successfully', {
      userId: newUser.id,
      email: newUser.email,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// PUT /api/users/:id - Update user
router.put(
  '/:id',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    const userData = req.body;

    logger.info('User update requested', {
      userId: id,
      correlationId: req.correlationId,
    });

    // Validate user data
    const validationErrors = validateUser(userData);
    if (validationErrors.length > 0) {
      throw new ValidationError('User validation failed', validationErrors);
    }

    // Check if user exists
    const existingUser = users.get(id);
    if (!existingUser) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }

    // Check for duplicate email (excluding current user)
    const duplicateUser = Array.from(users.values()).find(
      (user) => user.email === userData.email && user.id !== id
    );
    if (duplicateUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Another user with this email already exists',
        code: 'DUPLICATE_EMAIL',
        correlationId: req.correlationId,
      });
    }

    // Simulate database update delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 80));

    // Update user
    const updatedUser = {
      ...existingUser,
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      updatedAt: new Date().toISOString(),
    };

    users.set(id, updatedUser);

    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation(
      'update',
      `UPDATE users SET name = ?, email = ? WHERE id = '${id}'`,
      duration
    );

    // Record metrics
    metrics.recordDatabaseQuery('users', 'update', duration, 'success');
    metrics.recordBusinessOperation('user_update', duration, 'success');

    logger.logBusinessEvent('User Updated', {
      userId: id,
      email: updatedUser.email,
      correlationId: req.correlationId,
    });

    logger.info('User updated successfully', {
      userId: id,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

// DELETE /api/users/:id - Delete user
router.delete(
  '/:id',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;

    logger.info('User deletion requested', {
      userId: id,
      correlationId: req.correlationId,
    });

    // Check if user exists
    const existingUser = users.get(id);
    if (!existingUser) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }

    // Simulate database delete delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 60));

    // Delete user
    users.delete(id);

    const duration = Date.now() - startTime;

    // Log database operation
    logger.logDatabaseOperation(
      'delete',
      `DELETE FROM users WHERE id = '${id}'`,
      duration
    );

    // Record metrics
    metrics.recordDatabaseQuery('users', 'delete', duration, 'success');
    metrics.recordBusinessOperation('user_deletion', duration, 'success');

    logger.logBusinessEvent('User Deleted', {
      userId: id,
      email: existingUser.email,
      correlationId: req.correlationId,
    });

    logger.info('User deleted successfully', {
      userId: id,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    res.status(204).send();
  })
);

// POST /api/users/:id/login - Simulate user login
router.post(
  '/:id/login',
  asyncErrorHandler(async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;

    logger.info('User login simulation requested', {
      userId: id,
      correlationId: req.correlationId,
    });

    // Check if user exists
    const user = users.get(id);
    if (!user) {
      metrics.userLogins.inc({ status: 'failure' });
      throw new NotFoundError(`User with ID ${id} not found`);
    }

    // Simulate authentication delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));

    // Update last login
    user.lastLogin = new Date().toISOString();
    users.set(id, user);

    const duration = Date.now() - startTime;

    // Record metrics
    metrics.userLogins.inc({ status: 'success' });
    metrics.recordBusinessOperation('user_login', duration, 'success');

    logger.logBusinessEvent('User Login', {
      userId: id,
      email: user.email,
      correlationId: req.correlationId,
    });

    logger.info('User login successful', {
      userId: id,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        lastLogin: user.lastLogin,
      },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  })
);

module.exports = router;
