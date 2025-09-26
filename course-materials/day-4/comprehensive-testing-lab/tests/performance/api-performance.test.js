const autocannon = require('autocannon');
const Application = require('../../src/app');

describe('Performance Tests', () => {
  let app;
  let appInstance;
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Start test server
    appInstance = new Application();
    app = await appInstance.initialize();
    server = app.listen(3001);

    // Create test user
    testUser = await global.testUtils.createTestUser();
    authToken = global.testUtils.generateAuthToken(testUser);

    // Create test data
    await setupTestData();
  }, 30000);

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await appInstance.shutdown();
  });

  async function setupTestData() {
    // Create test projects and tasks for performance testing
    const projects = [];
    for (let i = 0; i < 10; i++) {
      const project = await global.testUtils.createTestProject(
        testUser.id,
        null,
        {
          name: `Performance Test Project ${i}`,
        }
      );
      projects.push(project);

      // Create tasks for each project
      for (let j = 0; j < 20; j++) {
        await global.testUtils.createTestTask(
          project.id,
          testUser.id,
          testUser.id,
          {
            title: `Task ${j} for Project ${i}`,
          }
        );
      }
    }
  }

  describe('API Performance', () => {
    it('should handle auth requests efficiently', async () => {
      const result = await autocannon({
        url: 'http://localhost:3001/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
        connections: 10,
        duration: 10, // 10 seconds
      });

      expect(result.non2xx).toBe(0); // No failed requests
      expect(result.requests.average).toBeGreaterThan(50); // At least 50 req/sec
      expect(result.latency.p99).toBeLessThan(1000); // 99th percentile < 1s
    });

    it('should handle project list requests efficiently', async () => {
      const result = await autocannon({
        url: 'http://localhost:3001/api/projects',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        connections: 20,
        pipelining: 1,
        duration: 10,
      });

      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(100);
      expect(result.latency.p95).toBeLessThan(500); // 95th percentile < 500ms
    });

    it('should handle task queries with pagination efficiently', async () => {
      const result = await autocannon({
        url: 'http://localhost:3001/api/tasks?page=1&limit=20',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        connections: 15,
        duration: 10,
      });

      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(80);
      expect(result.latency.p90).toBeLessThan(400); // 90th percentile < 400ms
    });

    it('should handle concurrent project creation', async () => {
      const result = await autocannon({
        url: 'http://localhost:3001/api/projects',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Concurrent Test Project',
          description: 'Testing concurrent creation',
        }),
        connections: 5, // Lower concurrency for writes
        duration: 5,
      });

      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(10);
      expect(result.latency.p99).toBeLessThan(2000); // 99th percentile < 2s
    });
  });

  describe('Database Performance', () => {
    it('should execute complex queries efficiently', async () => {
      const database = require('../../src/database/connection');
      const startTime = Date.now();

      // Complex query with joins
      const result = await database.query(
        `
        SELECT 
          p.id, p.name, 
          COUNT(t.id) as task_count,
          AVG(t.estimated_hours) as avg_estimated_hours,
          u.first_name || ' ' || u.last_name as owner_name
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.owner_id = $1
        GROUP BY p.id, u.first_name, u.last_name
        ORDER BY task_count DESC
        LIMIT 50
      `,
        [testUser.id]
      );

      const executionTime = Date.now() - startTime;

      expect(result.rows.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle bulk inserts efficiently', async () => {
      const database = require('../../src/database/connection');
      const startTime = Date.now();

      // Create test project for bulk insert
      const project = await global.testUtils.createTestProject(testUser.id);

      // Bulk insert tasks
      const tasks = [];
      for (let i = 0; i < 100; i++) {
        tasks.push([
          `Bulk Task ${i}`,
          `Description for bulk task ${i}`,
          project.id,
          testUser.id,
          testUser.id,
          'todo',
          'medium',
        ]);
      }

      const values = tasks
        .map(
          (_, i) =>
            `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${
              i * 7 + 5
            }, $${i * 7 + 6}, $${i * 7 + 7})`
        )
        .join(', ');

      const query = `
        INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority)
        VALUES ${values}
      `;

      await database.query(query, tasks.flat());

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete in < 1s
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();

      // Run sustained load test
      await autocannon({
        url: 'http://localhost:3001/api/projects',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        connections: 50,
        duration: 30, // 30 seconds
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await global.testUtils.waitFor(2000);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle request timeout gracefully', async () => {
      // Mock a slow endpoint
      const express = require('express');
      const slowApp = express();

      slowApp.get('/slow', (req, res) => {
        setTimeout(() => {
          res.json({ message: 'slow response' });
        }, 5000); // 5 second delay
      });

      const slowServer = slowApp.listen(3002);

      try {
        const result = await autocannon({
          url: 'http://localhost:3002/slow',
          connections: 5,
          amount: 10, // Only 10 requests
          timeout: 1, // 1 second timeout
        });

        // Should handle timeouts gracefully
        expect(result.timeouts).toBeGreaterThan(0);
        expect(result.non2xx).toBeGreaterThan(0);
      } finally {
        slowServer.close();
      }
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain performance with increased data volume', async () => {
      // Create additional test data
      for (let i = 0; i < 50; i++) {
        const project = await global.testUtils.createTestProject(
          testUser.id,
          null,
          {
            name: `Scalability Test Project ${i}`,
          }
        );

        for (let j = 0; j < 10; j++) {
          await global.testUtils.createTestTask(
            project.id,
            testUser.id,
            testUser.id,
            {
              title: `Scalability Task ${j}`,
            }
          );
        }
      }

      // Test performance with increased data
      const result = await autocannon({
        url: 'http://localhost:3001/api/projects?limit=100',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        connections: 10,
        duration: 10,
      });

      expect(result.non2xx).toBe(0);
      expect(result.requests.average).toBeGreaterThan(30); // Still reasonable performance
      expect(result.latency.p95).toBeLessThan(1000); // Still acceptable latency
    });

    it('should handle concurrent user scenarios', async () => {
      // Create multiple test users
      const users = [];
      const tokens = [];

      for (let i = 0; i < 5; i++) {
        const user = await global.testUtils.createTestUser({
          email: `concurrent${i}@example.com`,
        });
        users.push(user);
        tokens.push(global.testUtils.generateAuthToken(user));
      }

      // Test concurrent access with different users
      const promises = tokens.map((token, index) =>
        autocannon({
          url: 'http://localhost:3001/api/projects',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          connections: 5,
          duration: 5,
        })
      );

      const results = await Promise.all(promises);

      // All users should get good performance
      results.forEach((result) => {
        expect(result.non2xx).toBe(0);
        expect(result.requests.average).toBeGreaterThan(20);
      });
    });
  });
});
