describe('Task Management App E2E Tests', () => {
  beforeEach(() => {
    // Visit the app
    cy.visit('http://localhost:3000');
  });

  describe('Authentication Flow', () => {
    it('should display login form on homepage', () => {
      cy.get('[data-cy=login-form]').should('be.visible');
      cy.get('[data-cy=email-input]').should('be.visible');
      cy.get('[data-cy=password-input]').should('be.visible');
      cy.get('[data-cy=login-button]').should('be.visible');
    });

    it('should register a new user', () => {
      cy.get('[data-cy=register-link]').click();

      // Fill registration form
      cy.get('[data-cy=first-name-input]').type('John');
      cy.get('[data-cy=last-name-input]').type('Doe');
      cy.get('[data-cy=email-input]').type('john@example.com');
      cy.get('[data-cy=password-input]').type('SecurePass123!');
      cy.get('[data-cy=confirm-password-input]').type('SecurePass123!');

      cy.get('[data-cy=register-button]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.get('[data-cy=welcome-message]').should('contain', 'Welcome, John');
    });

    it('should login existing user', () => {
      // Create user first via API
      cy.request('POST', '/api/auth/register', {
        email: 'test@example.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'User',
      });

      // Login
      cy.get('[data-cy=email-input]').type('test@example.com');
      cy.get('[data-cy=password-input]').type('TestPass123!');
      cy.get('[data-cy=login-button]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.get('[data-cy=user-menu]').should('contain', 'Test User');
    });

    it('should show error for invalid credentials', () => {
      cy.get('[data-cy=email-input]').type('invalid@example.com');
      cy.get('[data-cy=password-input]').type('wrongpassword');
      cy.get('[data-cy=login-button]').click();

      cy.get('[data-cy=error-message]').should(
        'contain',
        'Invalid credentials'
      );
    });

    it('should logout user', () => {
      // Login first
      cy.login('test@example.com', 'TestPass123!');

      // Logout
      cy.get('[data-cy=user-menu]').click();
      cy.get('[data-cy=logout-button]').click();

      // Should redirect to login
      cy.url().should('include', '/login');
      cy.get('[data-cy=login-form]').should('be.visible');
    });
  });

  describe('Project Management', () => {
    beforeEach(() => {
      // Login before each test
      cy.login('test@example.com', 'TestPass123!');
    });

    it('should create a new project', () => {
      cy.get('[data-cy=new-project-button]').click();

      // Fill project form
      cy.get('[data-cy=project-name-input]').type('E2E Test Project');
      cy.get('[data-cy=project-description-input]').type(
        'A project created during E2E testing'
      );
      cy.get('[data-cy=project-priority-select]').select('high');
      cy.get('[data-cy=project-start-date]').type('2024-01-01');
      cy.get('[data-cy=project-end-date]').type('2024-12-31');

      cy.get('[data-cy=create-project-button]').click();

      // Should show success message and redirect
      cy.get('[data-cy=success-message]').should(
        'contain',
        'Project created successfully'
      );
      cy.url().should('include', '/projects');
      cy.get('[data-cy=project-card]').should('contain', 'E2E Test Project');
    });

    it('should display project list', () => {
      // Create test project via API
      cy.createProject('Test Project List', 'Project for list testing');

      cy.visit('/projects');
      cy.get('[data-cy=project-list]').should('be.visible');
      cy.get('[data-cy=project-card]').should('have.length.at.least', 1);
      cy.get('[data-cy=project-card]')
        .first()
        .should('contain', 'Test Project List');
    });

    it('should edit project details', () => {
      // Create project and get its ID
      cy.createProject('Editable Project', 'Original description').then(
        (project) => {
          cy.visit(`/projects/${project.id}`);

          cy.get('[data-cy=edit-project-button]').click();
          cy.get('[data-cy=project-name-input]')
            .clear()
            .type('Updated Project Name');
          cy.get('[data-cy=project-description-input]')
            .clear()
            .type('Updated description');
          cy.get('[data-cy=save-project-button]').click();

          cy.get('[data-cy=success-message]').should(
            'contain',
            'Project updated'
          );
          cy.get('[data-cy=project-title]').should(
            'contain',
            'Updated Project Name'
          );
        }
      );
    });

    it('should delete project', () => {
      cy.createProject('Project to Delete', 'Will be deleted').then(
        (project) => {
          cy.visit(`/projects/${project.id}`);

          cy.get('[data-cy=delete-project-button]').click();
          cy.get('[data-cy=confirm-delete-button]').click();

          cy.get('[data-cy=success-message]').should(
            'contain',
            'Project deleted'
          );
          cy.url().should('include', '/projects');
          cy.get('[data-cy=project-card]').should(
            'not.contain',
            'Project to Delete'
          );
        }
      );
    });

    it('should filter projects by status', () => {
      // Create projects with different statuses
      cy.createProject('Active Project', 'Active project', {
        status: 'active',
      });
      cy.createProject('Completed Project', 'Completed project', {
        status: 'completed',
      });

      cy.visit('/projects');

      // Filter by completed
      cy.get('[data-cy=status-filter]').select('completed');
      cy.get('[data-cy=project-card]').should('have.length', 1);
      cy.get('[data-cy=project-card]').should('contain', 'Completed Project');

      // Filter by active
      cy.get('[data-cy=status-filter]').select('active');
      cy.get('[data-cy=project-card]').should('contain', 'Active Project');
    });
  });

  describe('Task Management', () => {
    let projectId;

    beforeEach(() => {
      cy.login('test@example.com', 'TestPass123!');
      cy.createProject('Task Test Project', 'For task testing').then(
        (project) => {
          projectId = project.id;
        }
      );
    });

    it('should create a new task', () => {
      cy.visit(`/projects/${projectId}`);

      cy.get('[data-cy=new-task-button]').click();
      cy.get('[data-cy=task-title-input]').type('E2E Test Task');
      cy.get('[data-cy=task-description-input]').type(
        'Task created during E2E testing'
      );
      cy.get('[data-cy=task-priority-select]').select('high');
      cy.get('[data-cy=task-due-date]').type('2024-06-01');

      cy.get('[data-cy=create-task-button]').click();

      cy.get('[data-cy=success-message]').should(
        'contain',
        'Task created successfully'
      );
      cy.get('[data-cy=task-card]').should('contain', 'E2E Test Task');
    });

    it('should update task status', () => {
      cy.createTask(projectId, 'Status Test Task', 'For status testing').then(
        (task) => {
          cy.visit(`/projects/${projectId}`);

          cy.get(`[data-cy=task-${task.id}]`).should('be.visible');
          cy.get(`[data-cy=task-status-${task.id}]`).select('in_progress');

          // Should update automatically
          cy.get('[data-cy=success-message]').should('contain', 'Task updated');
          cy.get(`[data-cy=task-status-${task.id}]`).should(
            'have.value',
            'in_progress'
          );
        }
      );
    });

    it('should add task comment', () => {
      cy.createTask(projectId, 'Comment Test Task', 'For comment testing').then(
        (task) => {
          cy.visit(`/tasks/${task.id}`);

          cy.get('[data-cy=comment-input]').type('This is a test comment');
          cy.get('[data-cy=add-comment-button]').click();

          cy.get('[data-cy=comment-list]').should(
            'contain',
            'This is a test comment'
          );
          cy.get('[data-cy=comment-author]').should('contain', 'Test User');
        }
      );
    });

    it('should filter tasks by status', () => {
      // Create tasks with different statuses
      cy.createTask(projectId, 'Todo Task', 'Todo task', { status: 'todo' });
      cy.createTask(projectId, 'Done Task', 'Done task', { status: 'done' });

      cy.visit(`/projects/${projectId}`);

      // Filter by done
      cy.get('[data-cy=task-status-filter]').select('done');
      cy.get('[data-cy=task-card]').should('have.length', 1);
      cy.get('[data-cy=task-card]').should('contain', 'Done Task');

      // Show all
      cy.get('[data-cy=task-status-filter]').select('all');
      cy.get('[data-cy=task-card]').should('have.length', 2);
    });
  });

  describe('Team Management', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'TestPass123!');
    });

    it('should create a new team', () => {
      cy.visit('/teams');

      cy.get('[data-cy=new-team-button]').click();
      cy.get('[data-cy=team-name-input]').type('E2E Test Team');
      cy.get('[data-cy=team-description-input]').type(
        'Team created during E2E testing'
      );

      cy.get('[data-cy=create-team-button]').click();

      cy.get('[data-cy=success-message]').should(
        'contain',
        'Team created successfully'
      );
      cy.get('[data-cy=team-card]').should('contain', 'E2E Test Team');
    });

    it('should add team member', () => {
      // Create another user
      cy.request('POST', '/api/auth/register', {
        email: 'member@example.com',
        password: 'MemberPass123!',
        firstName: 'Team',
        lastName: 'Member',
      });

      cy.createTeam('Member Test Team', 'For member testing').then((team) => {
        cy.visit(`/teams/${team.id}`);

        cy.get('[data-cy=add-member-button]').click();
        cy.get('[data-cy=member-email-input]').type('member@example.com');
        cy.get('[data-cy=member-role-select]').select('member');
        cy.get('[data-cy=invite-member-button]').click();

        cy.get('[data-cy=success-message]').should(
          'contain',
          'Member added successfully'
        );
        cy.get('[data-cy=member-list]').should('contain', 'Team Member');
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'TestPass123!');
    });

    it('should work on mobile viewport', () => {
      cy.viewport('iphone-6');

      cy.visit('/dashboard');
      cy.get('[data-cy=mobile-menu-button]').should('be.visible');
      cy.get('[data-cy=sidebar]').should('not.be.visible');

      // Open mobile menu
      cy.get('[data-cy=mobile-menu-button]').click();
      cy.get('[data-cy=mobile-menu]').should('be.visible');
      cy.get('[data-cy=projects-link]').should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');

      cy.visit('/projects');
      cy.get('[data-cy=project-grid]').should('be.visible');
      cy.get('[data-cy=project-card]').should('have.css', 'width');
    });
  });

  describe('Error Handling', () => {
    it('should display 404 page for non-existent routes', () => {
      cy.visit('/non-existent-page', { failOnStatusCode: false });
      cy.get('[data-cy=404-page]').should('be.visible');
      cy.get('[data-cy=home-link]').click();
      cy.url().should('include', '/dashboard');
    });

    it('should handle network errors gracefully', () => {
      cy.login('test@example.com', 'TestPass123!');

      // Intercept and fail API requests
      cy.intercept('GET', '/api/projects', { forceNetworkError: true });

      cy.visit('/projects');
      cy.get('[data-cy=error-message]').should('contain', 'Network error');
      cy.get('[data-cy=retry-button]').should('be.visible');
    });

    it('should show loading states', () => {
      cy.login('test@example.com', 'TestPass123!');

      // Intercept and delay API requests
      cy.intercept('GET', '/api/projects', (req) => {
        req.reply((res) => {
          res.delay(1000);
          res.send([]);
        });
      });

      cy.visit('/projects');
      cy.get('[data-cy=loading-spinner]').should('be.visible');
    });
  });
});
