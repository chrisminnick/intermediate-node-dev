const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const database = require('../database/connection');

const router = express.Router();

/**
 * @route GET /api/tasks
 * @desc Get tasks with filtering and pagination
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
      .isIn(['todo', 'in_progress', 'review', 'done'])
      .withMessage('Invalid status'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority'),
    query('projectId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Project ID must be a positive integer'),
    query('assignedTo')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Assigned to must be a positive integer'),
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
    const { status, priority, projectId, assignedTo, search } = req.query;
    const userId = req.user.id;

    let query = `
    SELECT 
      t.id, t.title, t.description, t.status, t.priority,
      t.due_date, t.estimated_hours, t.actual_hours, t.tags,
      t.created_at, t.updated_at,
      p.name as project_name,
      p.id as project_id,
      creator.first_name || ' ' || creator.last_name as created_by_name,
      assignee.first_name || ' ' || assignee.last_name as assigned_to_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE (
      t.assigned_to = $1 OR 
      t.created_by = $1 OR 
      p.owner_id = $1 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
    )
  `;

    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND t.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (assignedTo) {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
    ORDER BY 
      CASE t.priority 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      t.due_date ASC NULLS LAST,
      t.updated_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
    params.push(limit, offset);

    const result = await database.query(query, params);

    // Get total count for pagination
    let countQuery = `
    SELECT COUNT(t.id)
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE (
      t.assigned_to = $1 OR 
      t.created_by = $1 OR 
      p.owner_id = $1 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
    )
  `;
    const countParams = [userId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND t.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (priority) {
      countQuery += ` AND t.priority = $${countParamIndex}`;
      countParams.push(priority);
      countParamIndex++;
    }

    if (projectId) {
      countQuery += ` AND t.project_id = $${countParamIndex}`;
      countParams.push(projectId);
      countParamIndex++;
    }

    if (assignedTo) {
      countQuery += ` AND t.assigned_to = $${countParamIndex}`;
      countParams.push(assignedTo);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (t.title ILIKE $${countParamIndex} OR t.description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await database.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      tasks: result.rows,
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
 * @route GET /api/tasks/:id
 * @desc Get a specific task with comments
 * @access Private
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(taskId)) {
      throw new AppError('Invalid task ID', 400);
    }

    // Get task details
    const taskResult = await database.query(
      `
    SELECT 
      t.id, t.title, t.description, t.status, t.priority,
      t.due_date, t.estimated_hours, t.actual_hours, t.tags,
      t.created_at, t.updated_at,
      p.name as project_name, p.id as project_id,
      creator.first_name || ' ' || creator.last_name as created_by_name,
      creator.id as created_by_id,
      assignee.first_name || ' ' || assignee.last_name as assigned_to_name,
      assignee.id as assigned_to_id
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE t.id = $1 AND (
      t.assigned_to = $2 OR 
      t.created_by = $2 OR 
      p.owner_id = $2 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
    )
  `,
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      throw new AppError('Task not found', 404);
    }

    const task = taskResult.rows[0];

    // Get task comments
    const commentsResult = await database.query(
      `
    SELECT 
      tc.id, tc.content, tc.created_at, tc.updated_at,
      u.first_name || ' ' || u.last_name as author_name,
      u.id as author_id
    FROM task_comments tc
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = $1
    ORDER BY tc.created_at ASC
  `,
      [taskId]
    );

    task.comments = commentsResult.rows;

    res.json({ task });
  })
);

/**
 * @route POST /api/tasks
 * @desc Create a new task
 * @access Private
 */
router.post(
  '/',
  [
    body('title')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage(
        'Task title is required and must be less than 255 characters'
      ),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('projectId')
      .isInt({ min: 1 })
      .withMessage('Project ID is required and must be a positive integer'),
    body('assignedTo')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Assigned to must be a positive integer'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be low, medium, high, or critical'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('estimatedHours')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Estimated hours must be a positive integer'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
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
      title,
      description,
      projectId,
      assignedTo,
      priority = 'medium',
      dueDate,
      estimatedHours,
      tags = [],
    } = req.body;
    const userId = req.user.id;

    // Verify project exists and user has access
    const projectCheck = await database.query(
      `
    SELECT p.id 
    FROM projects p
    WHERE p.id = $1 AND (
      p.owner_id = $2 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
    )
  `,
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      throw new AppError('Project not found or access denied', 404);
    }

    // Verify assigned user exists and has project access (if specified)
    if (assignedTo) {
      const assigneeCheck = await database.query(
        `
      SELECT u.id 
      FROM users u
      WHERE u.id = $1 AND u.is_active = true AND (
        $1 = $2 OR -- Can assign to self
        EXISTS (
          SELECT 1 FROM projects p 
          WHERE p.id = $3 AND (
            p.owner_id = $2 OR 
            p.team_id IN (
              SELECT tm1.team_id FROM team_members tm1 
              WHERE tm1.user_id = $2
              AND EXISTS (
                SELECT 1 FROM team_members tm2 
                WHERE tm2.team_id = tm1.team_id AND tm2.user_id = $1
              )
            )
          )
        )
      )
    `,
        [assignedTo, userId, projectId]
      );

      if (assigneeCheck.rows.length === 0) {
        throw new AppError('Cannot assign task to specified user', 400);
      }
    }

    const result = await database.query(
      `
    INSERT INTO tasks (
      title, description, project_id, assigned_to, created_by,
      priority, due_date, estimated_hours, tags
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, title, description, status, priority, due_date, 
              estimated_hours, tags, created_at, updated_at
  `,
      [
        title,
        description,
        projectId,
        assignedTo,
        userId,
        priority,
        dueDate,
        estimatedHours,
        tags,
      ]
    );

    const task = result.rows[0];

    res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  })
);

/**
 * @route PUT /api/tasks/:id
 * @desc Update a task
 * @access Private
 */
router.put(
  '/:id',
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Task title must be less than 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('status')
      .optional()
      .isIn(['todo', 'in_progress', 'review', 'done'])
      .withMessage('Status must be todo, in_progress, review, or done'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be low, medium, high, or critical'),
    body('actualHours')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Actual hours must be a non-negative integer'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(taskId)) {
      throw new AppError('Invalid task ID', 400);
    }

    // Check if task exists and user has permission
    const existingTask = await database.query(
      `
    SELECT t.id, t.created_by, t.assigned_to, p.owner_id as project_owner
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1 AND (
      t.assigned_to = $2 OR 
      t.created_by = $2 OR 
      p.owner_id = $2 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
    )
  `,
      [taskId, userId]
    );

    if (existingTask.rows.length === 0) {
      throw new AppError('Task not found or access denied', 404);
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'dueDate',
      'estimatedHours',
      'actualHours',
      'tags',
    ];
    const dbFields = {
      dueDate: 'due_date',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
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
    values.push(taskId);

    const query = `
    UPDATE tasks 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, title, description, status, priority, due_date, 
              estimated_hours, actual_hours, tags, updated_at
  `;

    const result = await database.query(query, values);

    res.json({
      message: 'Task updated successfully',
      task: result.rows[0],
    });
  })
);

/**
 * @route POST /api/tasks/:id/comments
 * @desc Add a comment to a task
 * @access Private
 */
router.post(
  '/:id/comments',
  [
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage(
        'Comment content is required and must be less than 1000 characters'
      ),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const taskId = parseInt(req.params.id);
    const { content } = req.body;
    const userId = req.user.id;

    if (isNaN(taskId)) {
      throw new AppError('Invalid task ID', 400);
    }

    // Verify task exists and user has access
    const taskCheck = await database.query(
      `
    SELECT t.id 
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1 AND (
      t.assigned_to = $2 OR 
      t.created_by = $2 OR 
      p.owner_id = $2 OR 
      p.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
    )
  `,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      throw new AppError('Task not found or access denied', 404);
    }

    const result = await database.query(
      `
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, content, created_at
  `,
      [taskId, userId, content]
    );

    const comment = result.rows[0];

    // Get user info for response
    const userResult = await database.query(
      "SELECT first_name || ' ' || last_name as author_name FROM users WHERE id = $1",
      [userId]
    );

    comment.author_name = userResult.rows[0].author_name;
    comment.author_id = userId;

    res.status(201).json({
      message: 'Comment added successfully',
      comment,
    });
  })
);

/**
 * @route DELETE /api/tasks/:id
 * @desc Delete a task
 * @access Private
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(taskId)) {
      throw new AppError('Invalid task ID', 400);
    }

    // Check if task exists and user has permission to delete
    const result = await database.query(
      `
    SELECT t.id, t.created_by, p.owner_id 
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1
  `,
      [taskId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Task not found', 404);
    }

    const task = result.rows[0];

    // Only task creator, project owner, or admin can delete
    if (
      task.created_by !== userId &&
      task.owner_id !== userId &&
      req.user.role !== 'admin'
    ) {
      throw new AppError(
        'You can only delete tasks you created or own the project',
        403
      );
    }

    await database.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    res.json({
      message: 'Task deleted successfully',
    });
  })
);

module.exports = router;
