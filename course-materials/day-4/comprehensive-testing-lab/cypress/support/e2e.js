// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing the test on uncaught exceptions
  // that we expect in our application (like network errors)
  if (err.message.includes('Network Error')) {
    return false;
  }

  // Let other exceptions fail the test
  return true;
});

// Before each test
beforeEach(() => {
  // Clear session storage and local storage
  cy.clearSession();

  // Intercept common API calls
  cy.intercept('GET', '/api/auth/me').as('getMe');
  cy.intercept('GET', '/api/projects').as('getProjects');
  cy.intercept('GET', '/api/tasks').as('getTasks');
  cy.intercept('GET', '/api/teams').as('getTeams');
});

// After each test
afterEach(() => {
  // Could add cleanup logic here if needed
});

// Global error handling
Cypress.on('fail', (error, runnable) => {
  // Log additional debugging information
  console.error('Test failed:', error.message);
  console.error('In test:', runnable.title);

  // Re-throw the error to fail the test
  throw error;
});
