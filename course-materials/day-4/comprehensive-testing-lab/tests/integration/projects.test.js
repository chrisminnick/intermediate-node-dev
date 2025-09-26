const request = require('supertest');
const Application = require('../../src/app');

describe('Projects Integration Tests', () => {
  let app;
  let appInstance;
  let testUser;
  let authToken;
  let testTeam;

  beforeAll(async () => {
    appInstance = new Application();
    app = await appInstance.initialize();
  });

  afterAll(async () => {
    await appInstance.shutdown();
  });

  beforeEach(async () => {
    // Create test user and team
    testUser = await global.testUtils.createTestUser({
      email: 'projectowner@example.com',
    });
    authToken = global.testUtils.generateAuthToken(testUser);
    testTeam = await global.testUtils.createTestTeam(testUser.id);
  });

  describe('POST /api/projects', () => {
    it('should create a project successfully', async () => {
      const projectData = {
        name: 'Integration Test Project',
        description: 'A project created during integration testing',
        priority: 'high',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        budget: 50000.0,
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body).toHaveProperty(
        'message',
        'Project created successfully'
      );
      expect(response.body.project).toMatchObject({
        name: projectData.name,
        description: projectData.description,
        priority: projectData.priority,
        status: 'active', // default value
      });
    });

    it('should create project with team assignment', async () => {
      const projectData = {
        name: 'Team Project',
        teamId: testTeam.id,
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.project.name).toBe(projectData.name);
    });

    it('should not create project with invalid team', async () => {
      const projectData = {
        name: 'Invalid Team Project',
        teamId: 99999, // Non-existent team
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(403);

      expect(response.body).toHaveProperty(
        'error',
        'You are not a member of the specified team'
      );
    });
  });

  describe('GET /api/projects', () => {
    let testProjects;

    beforeEach(async () => {
      // Create multiple test projects
      testProjects = [];
      for (let i = 1; i <= 3; i++) {
        testProjects.push(
          await global.testUtils.createTestProject(testUser.id, null, {
            name: `Test Project ${i}`,
            status: i === 3 ? 'completed' : 'active',
          })
        );
      }
    });

    it('should get user projects with pagination', async () => {
      const response = await request(app)
        .get('/api/projects?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
      });
    });

    it('should filter projects by status', async () => {
      const response = await request(app)
        .get('/api/projects?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].status).toBe('completed');
    });

    it('should search projects by name', async () => {
      const response = await request(app)
        .get('/api/projects?search=Project 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toContain('Project 1');
    });
  });

  describe('Project CRUD Operations', () => {
    let testProject;

    beforeEach(async () => {
      testProject = await global.testUtils.createTestProject(testUser.id);
    });

    it('should get project details with tasks', async () => {
      // Create a task for the project
      await global.testUtils.createTestTask(
        testProject.id,
        testUser.id,
        testUser.id
      );

      const response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.project).toMatchObject({
        id: testProject.id,
        name: testProject.name,
      });
      expect(response.body.project.tasks).toHaveLength(1);
    });

    it('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project Name',
        status: 'completed',
        priority: 'critical',
      };

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.project).toMatchObject(updateData);
    });

    it('should not update project without permission', async () => {
      const anotherUser = await global.testUtils.createTestUser({
        email: 'another@example.com',
      });
      const anotherToken = global.testUtils.generateAuthToken(anotherUser);

      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);

      expect(response.body).toHaveProperty(
        'error',
        'You can only update projects you own'
      );
    });

    it('should delete project successfully', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Project deleted successfully'
      );

      // Verify project is deleted
      await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Team Project Access', () => {
    let teamProject;
    let teamMember;
    let memberToken;

    beforeEach(async () => {
      // Create team member
      teamMember = await global.testUtils.createTestUser({
        email: 'teammember@example.com',
      });
      memberToken = global.testUtils.generateAuthToken(teamMember);

      // Add member to team
      const database = require('../../src/database/connection');
      await database.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
        [testTeam.id, teamMember.id, 'member']
      );

      // Create team project
      teamProject = await global.testUtils.createTestProject(
        testUser.id,
        testTeam.id,
        { name: 'Team Project' }
      );
    });

    it('should allow team members to view team projects', async () => {
      const response = await request(app)
        .get(`/api/projects/${teamProject.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.project.name).toBe('Team Project');
    });

    it('should show team projects in member project list', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('Team Project');
    });

    it('should not allow non-team members to access team projects', async () => {
      const outsider = await global.testUtils.createTestUser({
        email: 'outsider@example.com',
      });
      const outsiderToken = global.testUtils.generateAuthToken(outsider);

      const response = await request(app)
        .get(`/api/projects/${teamProject.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
    });
  });

  describe('Project Validation and Error Handling', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Empty body
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should handle non-existent project ID', async () => {
      const response = await request(app)
        .get('/api/projects/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should validate date ranges', async () => {
      const projectData = {
        name: 'Invalid Date Project',
        startDate: '2024-12-31',
        endDate: '2024-01-01', // End before start
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(400);

      expect(response.body).toHaveProperty(
        'error',
        'Start date cannot be after end date'
      );
    });
  });

  describe('Unauthorized Access', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/projects').expect(401);

      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });
});
