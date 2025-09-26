const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const database = require('../database/connection');

const router = express.Router();

/**
 * @route GET /api/users/profile
 * @desc Get current user profile
 * @access Private
 */
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await database.query(
      `
    SELECT 
      id, email, first_name, last_name, role, avatar_url,
      is_active, last_login, created_at, updated_at
    FROM users 
    WHERE id = $1
  `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    // Get user's team memberships
    const teamsResult = await database.query(
      `
    SELECT t.id, t.name, tm.role as team_role
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = $1 AND t.is_active = true
  `,
      [userId]
    );

    user.teams = teamsResult.rows;

    res.json({ user });
  })
);

/**
 * @route PUT /api/users/profile
 * @desc Update current user profile
 * @access Private
 */
router.put(
  '/profile',
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('Avatar URL must be a valid URL'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const userId = req.user.id;
    const { firstName, lastName, avatarUrl } = req.body;

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`);
      values.push(firstName);
      paramIndex++;
    }

    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`);
      values.push(lastName);
      paramIndex++;
    }

    if (avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex}`);
      values.push(avatarUrl);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
    UPDATE users 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, first_name, last_name, avatar_url, updated_at
  `;

    const result = await database.query(query, values);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  })
);

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Private (Admin)
 */
router.get(
  '/',
  requireRole('admin'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Search term too long'),
    query('role')
      .optional()
      .isIn(['user', 'admin', 'manager'])
      .withMessage('Invalid role'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, role, isActive } = req.query;

    let query = `
    SELECT 
      id, email, first_name, last_name, role, is_active,
      last_login, created_at, updated_at
    FROM users
    WHERE 1=1
  `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    query += `
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
    params.push(limit, offset);

    const result = await database.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (first_name ILIKE $${countParamIndex} OR last_name ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (role) {
      countQuery += ` AND role = $${countParamIndex}`;
      countParams.push(role);
      countParamIndex++;
    }

    if (isActive !== undefined) {
      countQuery += ` AND is_active = $${countParamIndex}`;
      countParams.push(isActive === 'true');
    }

    const countResult = await database.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  })
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    if (isNaN(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    // Users can only view their own profile unless they're admin
    if (userId !== requestingUserId && requestingUserRole !== 'admin') {
      throw new AppError('Access denied', 403);
    }

    const result = await database.query(
      `
    SELECT 
      id, email, first_name, last_name, role, avatar_url,
      is_active, last_login, created_at, updated_at
    FROM users 
    WHERE id = $1
  `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    // Get user statistics
    const statsResult = await database.query(
      `
    SELECT 
      COUNT(DISTINCT p.id) as projects_owned,
      COUNT(DISTINCT t.id) as tasks_assigned,
      COUNT(DISTINCT tc.id) as comments_made
    FROM users u
    LEFT JOIN projects p ON u.id = p.owner_id
    LEFT JOIN tasks t ON u.id = t.assigned_to
    LEFT JOIN task_comments tc ON u.id = tc.user_id
    WHERE u.id = $1
    GROUP BY u.id
  `,
      [userId]
    );

    if (statsResult.rows.length > 0) {
      user.stats = statsResult.rows[0];
    } else {
      user.stats = { projects_owned: 0, tasks_assigned: 0, comments_made: 0 };
    }

    res.json({ user });
  })
);

/**
 * @route PUT /api/users/:id
 * @desc Update user (admin only)
 * @access Private (Admin)
 */
router.put(
  '/:id',
  requireRole('admin'),
  [
    body('role')
      .optional()
      .isIn(['user', 'admin', 'manager'])
      .withMessage('Role must be user, admin, or manager'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const userId = parseInt(req.params.id);
    const { role, isActive } = req.body;

    if (isNaN(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    // Check if user exists
    const existingUser = await database.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
    UPDATE users 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, first_name, last_name, role, is_active, updated_at
  `;

    const result = await database.query(query, values);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0],
    });
  })
);

/**
 * @route GET /api/users/search
 * @desc Search users for assignment purposes
 * @access Private
 */
router.get(
  '/search',
  [
    query('q')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Search query must be between 2 and 100 characters'),
    query('projectId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Project ID must be a positive integer'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { q: searchQuery, projectId } = req.query;
    const userId = req.user.id;

    let query = `
    SELECT DISTINCT
      u.id, u.email, u.first_name, u.last_name, u.avatar_url
    FROM users u
    WHERE u.is_active = true
    AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1)
  `;

    const params = [`%${searchQuery}%`];
    let paramIndex = 2;

    // If projectId is specified, only return users who have access to the project
    if (projectId) {
      query += `
    AND (
      u.id = $${paramIndex} OR -- Current user
      EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = $${paramIndex + 1}
        AND (
          p.owner_id = $${paramIndex} OR
          p.team_id IN (
            SELECT tm1.team_id FROM team_members tm1 
            WHERE tm1.user_id = $${paramIndex}
            AND EXISTS (
              SELECT 1 FROM team_members tm2 
              WHERE tm2.team_id = tm1.team_id AND tm2.user_id = u.id
            )
          )
        )
      )
    )`;
      params.push(userId, projectId);
    }

    query += ' ORDER BY u.first_name, u.last_name LIMIT 20';

    const result = await database.query(query, params);

    res.json({
      users: result.rows,
    });
  })
);

module.exports = router;
