const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,

    // Test file patterns
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    // Support file
    supportFile: 'cypress/support/e2e.js',

    // Fixtures folder
    fixturesFolder: 'cypress/fixtures',

    // Screenshots and videos
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,
    screenshotOnRunFailure: true,

    // Browser configuration
    chromeWebSecurity: false,

    // Environment variables
    env: {
      apiUrl: 'http://localhost:3000/api',
    },

    // Setup and teardown
    setupNodeEvents(on, config) {
      // Implement node event listeners here

      // Task for database cleanup
      on('task', {
        'db:cleanup': () => {
          // This would typically connect to your test database
          // and clean up test data
          return null;
        },

        'db:seed': () => {
          // Seed test data
          return null;
        },

        log(message) {
          console.log(message);
          return null;
        },
      });

      // Plugin for code coverage (if needed)
      // require('@cypress/code-coverage/task')(on, config);

      return config;
    },
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
  },
});
