// ***********************************************
// Custom commands for task management app testing
// ***********************************************

/**
 * Login command
 */
Cypress.Commands.add('login', (email, password) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  }).then((response) => {
    window.localStorage.setItem('auth_token', response.body.token);
    window.localStorage.setItem('user', JSON.stringify(response.body.user));
  });
});

/**
 * Create project via API
 */
Cypress.Commands.add('createProject', (name, description, options = {}) => {
  const token = window.localStorage.getItem('auth_token');
  
  return cy.request({
    method: 'POST',
    url: '/api/projects',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: {
      name,
      description,
      ...options,
    },
  }).then((response) => response.body.project);
});

/**
 * Create task via API
 */
Cypress.Commands.add('createTask', (projectId, title, description, options = {}) => {
  const token = window.localStorage.getItem('auth_token');
  
  return cy.request({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: {
      projectId,
      title,
      description,
      ...options,
    },
  }).then((response) => response.body.task);
});

/**
 * Create team via API
 */
Cypress.Commands.add('createTeam', (name, description) => {
  const token = window.localStorage.getItem('auth_token');
  
  return cy.request({
    method: 'POST',
    url: '/api/teams',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { name, description },
  }).then((response) => response.body.team);
});

/**
 * Wait for element to be visible with retry
 */
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
});

/**
 * Clear local storage and session
 */
Cypress.Commands.add('clearSession', () => {
  cy.clearLocalStorage();
  cy.clearCookies();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

/**
 * Fill form with data object
 */
Cypress.Commands.add('fillForm', (formData) => {
  Object.keys(formData).forEach((key) => {
    cy.get(`[data-cy=${key}]`).type(formData[key]);
  });
});

/**
 * Check if element has loading state
 */
Cypress.Commands.add('shouldBeLoading', (selector) => {
  cy.get(selector).should('have.class', 'loading');
});

/**
 * Check API response status
 */
Cypress.Commands.add('checkApiResponse', (alias, expectedStatus = 200) => {
  cy.wait(alias).then((interception) => {
    expect(interception.response.statusCode).to.equal(expectedStatus);
  });
});

/**
 * Upload file
 */
Cypress.Commands.add('uploadFile', (selector, fileName, fileType = 'image/png') => {
  cy.fixture(fileName).then((fileContent) => {
    cy.get(selector).selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName,
      mimeType: fileType,
    });
  });
});

/**
 * Assert notification message
 */
Cypress.Commands.add('shouldShowNotification', (message, type = 'success') => {
  cy.get(`[data-cy=${type}-notification]`).should('be.visible').and('contain', message);
});

/**
 * Drag and drop
 */
Cypress.Commands.add('dragAndDrop', (source, target) => {
  cy.get(source).trigger('mousedown', { which: 1 });
  cy.get(target).trigger('mousemove').trigger('mouseup');
});

// Add type definitions for TypeScript support
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      createProject(name: string, description: string, options?: object): Chainable<any>;
      createTask(projectId: number, title: string, description: string, options?: object): Chainable<any>;
      createTeam(name: string, description: string): Chainable<any>;
      waitForElement(selector: string, timeout?: number): Chainable<JQuery<HTMLElement>>;
      clearSession(): Chainable<void>;
      fillForm(formData: object): Chainable<void>;
      shouldBeLoading(selector: string): Chainable<JQuery<HTMLElement>>;
      checkApiResponse(alias: string, expectedStatus?: number): Chainable<void>;
      uploadFile(selector: string, fileName: string, fileType?: string): Chainable<void>;
      shouldShowNotification(message: string, type?: string): Chainable<JQuery<HTMLElement>>;
      dragAndDrop(source: string, target: string): Chainable<void>;
    }
  }
}