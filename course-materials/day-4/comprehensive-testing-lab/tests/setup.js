require('dotenv').config({ path: '.env.test' });
const database = require('../src/database/connection');

// Global test setup
beforeAll(async () => {
  // Connect to test database
  await database.connect();

  // Run migrations
  await database.migrate();

  // Set longer timeout for database operations
  jest.setTimeout(30000);
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data (preserve structure)
  const tables = [
    'task_comments',
    'tasks',
    'projects',
    'team_members',
    'teams',
    'users',
  ];

  for (const table of tables) {
    await database.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
});

// Global test teardown
afterAll(async () => {
  await database.disconnect();
});

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: async (overrides = {}) => {
    const bcrypt = require('bcryptjs');
    const defaultUser = {
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
    };

    const userData = { ...defaultUser, ...overrides };
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const result = await database.query(
      `
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, role, created_at
    `,
      [
        userData.email,
        passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role,
      ]
    );

    return { ...result.rows[0], password: userData.password };
  },

  // Create test team
  createTestTeam: async (ownerId, overrides = {}) => {
    const defaultTeam = {
      name: 'Test Team',
      description: 'A test team',
    };

    const teamData = { ...defaultTeam, ...overrides };

    const result = await database.query(
      `
      INSERT INTO teams (name, description, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, owner_id, created_at
    `,
      [teamData.name, teamData.description, ownerId]
    );

    const team = result.rows[0];

    // Add owner as team member
    await database.query(
      `
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `,
      [team.id, ownerId]
    );

    return team;
  },

  // Create test project
  createTestProject: async (ownerId, teamId = null, overrides = {}) => {
    const defaultProject = {
      name: 'Test Project',
      description: 'A test project',
      status: 'active',
      priority: 'medium',
    };

    const projectData = { ...defaultProject, ...overrides };

    const result = await database.query(
      `
      INSERT INTO projects (name, description, owner_id, team_id, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, owner_id, team_id, status, priority, created_at
    `,
      [
        projectData.name,
        projectData.description,
        ownerId,
        teamId,
        projectData.status,
        projectData.priority,
      ]
    );

    return result.rows[0];
  },

  // Create test task
  createTestTask: async (
    projectId,
    createdById,
    assignedTo = null,
    overrides = {}
  ) => {
    const defaultTask = {
      title: 'Test Task',
      description: 'A test task',
      status: 'todo',
      priority: 'medium',
    };

    const taskData = { ...defaultTask, ...overrides };

    const result = await database.query(
      `
      INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, description, project_id, assigned_to, created_by, status, priority, created_at
    `,
      [
        taskData.title,
        taskData.description,
        projectId,
        assignedTo,
        createdBy,
        taskData.status,
        taskData.priority,
      ]
    );

    return result.rows[0];
  },

  // Generate JWT token for testing
  generateAuthToken: (user) => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  // Wait for a promise to resolve/reject
  waitFor: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Suppress console.log during tests unless explicitly enabled
if (!process.env.ENABLE_TEST_LOGS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error, // Keep error logs for debugging
  };
}
