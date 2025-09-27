# Setup Test

This is a simple Node.js application to verify that your development environment is properly configured for the Intermediate Development with Node.js course.

## Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

## Running the Test

1. Start the test server:

   ```bash
   npm start
   ```

2. Open your browser and visit:

   ```
   http://localhost:3000
   ```

3. You should see a JSON response confirming your setup is working.

## Expected Output

If everything is working correctly, you should see:

- The server starts without errors
- You can access the health endpoint at `/health`
- The main endpoint returns system information

## Troubleshooting

- **Port already in use**: The server will try to use port 3000. If that port is busy, set a different port:

  ```bash
  PORT=3001 npm start
  ```

- **Module not found**: Make sure you ran `npm install` first

- **Permission errors**: On some systems, you might need to use `sudo npm install` or configure npm properly

## Next Steps

Once this setup test is working, you're ready to begin the course labs!
