const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const database = require('../database/connection');

const router = express.Router();

/**
 * @route GET /api/teams
 * @desc Get teams user is a member of
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
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
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
    const userId = req.user.id;

    const result = await database.query(
      `
    SELECT 
      t.id, t.name, t.description, t.is_active, t.created_at,
      u.first_name || ' ' || u.last_name as owner_name,
      tm.role as user_role,
      COUNT(DISTINCT tm2.user_id) as member_count,
      COUNT(DISTINCT p.id) as project_count
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    LEFT JOIN users u ON t.owner_id = u.id
    LEFT JOIN team_members tm2 ON t.id = tm2.team_id
    LEFT JOIN projects p ON t.id = p.team_id
    WHERE tm.user_id = $1 AND t.is_active = true
    GROUP BY t.id, u.first_name, u.last_name, tm.role
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await database.query(
      `
    SELECT COUNT(DISTINCT t.id)
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = $1 AND t.is_active = true
  `,
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      teams: result.rows,
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
 * @route GET /api/teams/:id
 * @desc Get team details with members and projects
 * @access Private
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const teamId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(teamId)) {
      throw new AppError('Invalid team ID', 400);
    }

    // Check if user is a member of the team
    const memberCheck = await database.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      throw new AppError('Team not found or access denied', 404);
    }

    const userRole = memberCheck.rows[0].role;

    // Get team details
    const teamResult = await database.query(
      `
    SELECT 
      t.id, t.name, t.description, t.is_active, t.created_at, t.updated_at,
      u.first_name || ' ' || u.last_name as owner_name,
      u.id as owner_id
    FROM teams t
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.id = $1
  `,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      throw new AppError('Team not found', 404);
    }

    const team = teamResult.rows[0];
    team.user_role = userRole;

    // Get team members
    const membersResult = await database.query(
      `
    SELECT 
      u.id, u.first_name, u.last_name, u.email, u.avatar_url,
      tm.role, tm.joined_at
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = $1 AND u.is_active = true
    ORDER BY 
      CASE tm.role 
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
      END,
      tm.joined_at ASC
  `,
      [teamId]
    );

    team.members = membersResult.rows;

    // Get team projects
    const projectsResult = await database.query(
      `
    SELECT 
      p.id, p.name, p.description, p.status, p.priority,
      p.start_date, p.end_date, p.created_at,
      COUNT(t.id) as task_count
    FROM projects p
    LEFT JOIN tasks t ON p.id = t.project_id
    WHERE p.team_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `,
      [teamId]
    );

    team.projects = projectsResult.rows;

    res.json({ team });
  })
);

/**
 * @route POST /api/teams
 * @desc Create a new team
 * @access Private
 */
router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage(
        'Team name is required and must be less than 100 characters'
      ),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { name, description } = req.body;
    const userId = req.user.id;

    // Use transaction to create team and add owner as member
    const result = await database.transaction(async (client) => {
      // Create team
      const teamResult = await client.query(
        `
      INSERT INTO teams (name, description, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, created_at
    `,
        [name, description, userId]
      );

      const team = teamResult.rows[0];
      const teamId = team.id;

      // Add owner as team member
      await client.query(
        `
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `,
        [teamId, userId]
      );

      return team;
    });

    res.status(201).json({
      message: 'Team created successfully',
      team: result,
    });
  })
);

/**
 * @route POST /api/teams/:id/members
 * @desc Add member to team
 * @access Private (Team Owner/Admin)
 */
router.post(
  '/:id/members',
  [
    body('userId')
      .isInt({ min: 1 })
      .withMessage('User ID is required and must be a positive integer'),
    body('role')
      .optional()
      .isIn(['member', 'admin'])
      .withMessage('Role must be member or admin'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const teamId = parseInt(req.params.id);
    const { userId: newMemberId, role = 'member' } = req.body;
    const currentUserId = req.user.id;

    if (isNaN(teamId)) {
      throw new AppError('Invalid team ID', 400);
    }

    // Check if current user has permission to add members
    const permissionCheck = await database.query(
      `
    SELECT tm.role 
    FROM team_members tm
    WHERE tm.team_id = $1 AND tm.user_id = $2 
    AND tm.role IN ('owner', 'admin')
  `,
      [teamId, currentUserId]
    );

    if (permissionCheck.rows.length === 0) {
      throw new AppError(
        'You do not have permission to add members to this team',
        403
      );
    }

    // Check if user exists and is active
    const userCheck = await database.query(
      'SELECT id, first_name, last_name, email FROM users WHERE id = $1 AND is_active = true',
      [newMemberId]
    );

    if (userCheck.rows.length === 0) {
      throw new AppError('User not found or inactive', 404);
    }

    const newMember = userCheck.rows[0];

    // Check if user is already a member
    const existingMember = await database.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, newMemberId]
    );

    if (existingMember.rows.length > 0) {
      throw new AppError('User is already a member of this team', 409);
    }

    // Add member to team
    await database.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [teamId, newMemberId, role]
    );

    res.status(201).json({
      message: 'Member added successfully',
      member: {
        id: newMember.id,
        first_name: newMember.first_name,
        last_name: newMember.last_name,
        email: newMember.email,
        role,
        joined_at: new Date().toISOString(),
      },
    });
  })
);

/**
 * @route PUT /api/teams/:id/members/:userId
 * @desc Update team member role
 * @access Private (Team Owner/Admin)
 */
router.put(
  '/:id/members/:userId',
  [
    body('role')
      .isIn(['member', 'admin'])
      .withMessage('Role must be member or admin'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const teamId = parseInt(req.params.id);
    const memberId = parseInt(req.params.userId);
    const { role } = req.body;
    const currentUserId = req.user.id;

    if (isNaN(teamId) || isNaN(memberId)) {
      throw new AppError('Invalid team ID or user ID', 400);
    }

    // Check if current user has permission
    const permissionCheck = await database.query(
      `
    SELECT tm.role 
    FROM team_members tm
    WHERE tm.team_id = $1 AND tm.user_id = $2 
    AND tm.role IN ('owner', 'admin')
  `,
      [teamId, currentUserId]
    );

    if (permissionCheck.rows.length === 0) {
      throw new AppError(
        'You do not have permission to update member roles',
        403
      );
    }

    // Check if member exists
    const memberCheck = await database.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, memberId]
    );

    if (memberCheck.rows.length === 0) {
      throw new AppError('Member not found in team', 404);
    }

    const currentRole = memberCheck.rows[0].role;

    // Cannot change owner role
    if (currentRole === 'owner') {
      throw new AppError('Cannot change team owner role', 400);
    }

    // Update member role
    await database.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [role, teamId, memberId]
    );

    res.json({
      message: 'Member role updated successfully',
    });
  })
);

/**
 * @route DELETE /api/teams/:id/members/:userId
 * @desc Remove member from team
 * @access Private (Team Owner/Admin or Self)
 */
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const teamId = parseInt(req.params.id);
    const memberId = parseInt(req.params.userId);
    const currentUserId = req.user.id;

    if (isNaN(teamId) || isNaN(memberId)) {
      throw new AppError('Invalid team ID or user ID', 400);
    }

    // Check if member exists
    const memberCheck = await database.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, memberId]
    );

    if (memberCheck.rows.length === 0) {
      throw new AppError('Member not found in team', 404);
    }

    const memberRole = memberCheck.rows[0].role;

    // Cannot remove team owner
    if (memberRole === 'owner') {
      throw new AppError('Cannot remove team owner', 400);
    }

    // Check permissions (owner/admin can remove others, anyone can remove themselves)
    if (memberId !== currentUserId) {
      const permissionCheck = await database.query(
        `
      SELECT tm.role 
      FROM team_members tm
      WHERE tm.team_id = $1 AND tm.user_id = $2 
      AND tm.role IN ('owner', 'admin')
    `,
        [teamId, currentUserId]
      );

      if (permissionCheck.rows.length === 0) {
        throw new AppError(
          'You do not have permission to remove this member',
          403
        );
      }
    }

    // Remove member from team
    await database.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, memberId]
    );

    res.json({
      message: 'Member removed successfully',
    });
  })
);

/**
 * @route PUT /api/teams/:id
 * @desc Update team details
 * @access Private (Team Owner/Admin)
 */
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Team name must be less than 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const teamId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(teamId)) {
      throw new AppError('Invalid team ID', 400);
    }

    // Check permissions
    const permissionCheck = await database.query(
      `
    SELECT tm.role 
    FROM team_members tm
    WHERE tm.team_id = $1 AND tm.user_id = $2 
    AND tm.role IN ('owner', 'admin')
  `,
      [teamId, currentUserId]
    );

    if (permissionCheck.rows.length === 0) {
      throw new AppError('You do not have permission to update this team', 403);
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (req.body.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      values.push(req.body.name);
      paramIndex++;
    }

    if (req.body.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(req.body.description);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(teamId);

    const query = `
    UPDATE teams 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, description, updated_at
  `;

    const result = await database.query(query, values);

    res.json({
      message: 'Team updated successfully',
      team: result.rows[0],
    });
  })
);

module.exports = router;
