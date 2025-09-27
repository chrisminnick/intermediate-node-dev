const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Node.js setup test successful!',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    status: 'ready',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Setup test server running on port ${PORT}`);
  console.log(`📊 Node.js version: ${process.version}`);
  console.log(`💻 Platform: ${process.platform}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log('✅ Your Node.js environment is ready for the course!');
});

module.exports = app;
