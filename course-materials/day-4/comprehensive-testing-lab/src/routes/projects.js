const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const database = require('../database/connection');

const router = express.Router();

/**
 * @route GET /api/projects
 * @desc Get all projects for the authenticated user
 * @access Private
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['active', 'completed', 'archived'])
      .withMessage('Invalid status'),
    query('search')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Search term too long'),
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
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, search } = req.query;
    const userId = req.user.id;

    let query = `
    SELECT 
      p.id, p.name, p.description, p.status, p.priority,
      p.start_date, p.end_date, p.budget,
      p.created_at, p.updated_at,
      u.first_name || ' ' || u.last_name as owner_name,
      t.name as team_name,
      COUNT(tasks.id) as task_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN tasks ON p.id = tasks.project_id
    WHERE (p.owner_id = $1 OR p.team_id IN (
      SELECT team_id FROM team_members WHERE user_id = $1
    ))
  `;

    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
    GROUP BY p.id, u.first_name, u.last_name, t.name
    ORDER BY p.updated_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
    params.push(limit, offset);

    const result = await database.query(query, params);

    // Get total count for pagination
    let countQuery = `
    SELECT COUNT(DISTINCT p.id)
    FROM projects p
    WHERE (p.owner_id = $1 OR p.team_id IN (
      SELECT team_id FROM team_members WHERE user_id = $1
    ))
  `;
    const countParams = [userId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND p.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (p.name ILIKE $${countParamIndex} OR p.description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await database.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      projects: result.rows,
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
 * @route GET /api/projects/:id
 * @desc Get a specific project by ID
 * @access Private
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(projectId)) {
      throw new AppError('Invalid project ID', 400);
    }

    const result = await database.query(
      `
    SELECT 
      p.id, p.name, p.description, p.status, p.priority,
      p.start_date, p.end_date, p.budget,
      p.created_at, p.updated_at,
      u.first_name || ' ' || u.last_name as owner_name,
      u.id as owner_id,
      t.name as team_name,
      t.id as team_id
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = $1 AND (
      p.owner_id = $2 OR p.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = $2
      )
    )
  `,
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const project = result.rows[0];

    // Get project tasks
    const tasksResult = await database.query(
      `
    SELECT 
      t.id, t.title, t.status, t.priority, t.due_date,
      u.first_name || ' ' || u.last_name as assigned_to_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.project_id = $1
    ORDER BY t.created_at DESC
  `,
      [projectId]
    );

    project.tasks = tasksResult.rows;

    res.json({ project });
  })
);

/**
 * @route POST /api/projects
 * @desc Create a new project
 * @access Private
 */
router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage(
        'Project name is required and must be less than 255 characters'
      ),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('teamId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Team ID must be a positive integer'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be low, medium, high, or critical'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('budget')
      .optional()
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Budget must be a valid decimal number'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const {
      name,
      description,
      teamId,
      priority = 'medium',
      startDate,
      endDate,
      budget,
    } = req.body;
    const userId = req.user.id;

    // Validate team membership if teamId is provided
    if (teamId) {
      const teamCheck = await database.query(
        'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );

      if (teamCheck.rows.length === 0) {
        throw new AppError('You are not a member of the specified team', 403);
      }
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new AppError('Start date cannot be after end date', 400);
    }

    const result = await database.query(
      `
    INSERT INTO projects (name, description, owner_id, team_id, priority, start_date, end_date, budget)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, name, description, status, priority, start_date, end_date, budget, created_at, updated_at
  `,
      [name, description, userId, teamId, priority, startDate, endDate, budget]
    );

    const project = result.rows[0];

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  })
);

/**
 * @route PUT /api/projects/:id
 * @desc Update a project
 * @access Private
 */
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be less than 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('status')
      .optional()
      .isIn(['active', 'completed', 'archived'])
      .withMessage('Status must be active, completed, or archived'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be low, medium, high, or critical'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const projectId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(projectId)) {
      throw new AppError('Invalid project ID', 400);
    }

    // Check if project exists and user has permission
    const existingProject = await database.query(
      'SELECT id, owner_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (existingProject.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const project = existingProject.rows[0];

    // Only project owner can update
    if (project.owner_id !== userId) {
      throw new AppError('You can only update projects you own', 403);
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name',
      'description',
      'status',
      'priority',
      'startDate',
      'endDate',
      'budget',
    ];
    const dbFields = {
      startDate: 'start_date',
      endDate: 'end_date',
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const dbField = dbFields[field] || field;
        updateFields.push(`${dbField} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId);

    const query = `
    UPDATE projects 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, description, status, priority, start_date, end_date, budget, updated_at
  `;

    const result = await database.query(query, values);

    res.json({
      message: 'Project updated successfully',
      project: result.rows[0],
    });
  })
);

/**
 * @route DELETE /api/projects/:id
 * @desc Delete a project
 * @access Private
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(projectId)) {
      throw new AppError('Invalid project ID', 400);
    }

    // Check if project exists and user has permission
    const result = await database.query(
      'SELECT id, owner_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Project not found', 404);
    }

    const project = result.rows[0];

    // Only project owner can delete
    if (project.owner_id !== userId && req.user.role !== 'admin') {
      throw new AppError('You can only delete projects you own', 403);
    }

    await database.query('DELETE FROM projects WHERE id = $1', [projectId]);

    res.json({
      message: 'Project deleted successfully',
    });
  })
);

module.exports = router;
