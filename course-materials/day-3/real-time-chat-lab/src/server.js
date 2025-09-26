require('dotenv').config();

const http = require('http');
const app = require('./app');
const SocketHandler = require('./socketHandler');
const redisManager = require('../config/redis');
const chatService = require('./services/chatService');
const logger = require('../utils/logger');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const socketHandler = new SocketHandler(server);

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} signal received, shutting down gracefully...`);
  logger.logSystemEvent('server-shutdown-started', { signal });

  try {
    // Close HTTP server
    server.close(async () => {
      console.log('📡 HTTP server closed');

      try {
        // Close Socket.IO connections
        socketHandler.io.close(() => {
          console.log('🔌 Socket.IO server closed');
        });

        // Disconnect from Redis
        await redisManager.disconnect();

        logger.logSystemEvent('server-shutdown-completed');
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during shutdown initiation', error);
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Real-Time Chat Server...');
    logger.logSystemEvent('server-startup-initiated');

    // Connect to Redis
    console.log('🔄 Connecting to Redis...');
    await redisManager.connect();

    // Initialize chat service (create default rooms)
    console.log('🏠 Initializing chat service...');
    await chatService.initialize();

    // Start HTTP server
    server.listen(PORT, () => {
      const startupMessage = `
🎉 Real-Time Chat Server Started Successfully!

📍 Server Details:
   - Port: ${PORT}
   - Environment: ${process.env.NODE_ENV || 'development'}
   - Process ID: ${process.pid}
   - Node Version: ${process.version}

🌐 URLs:
   - Chat Application: http://localhost:${PORT}
   - API Base: http://localhost:${PORT}/api
   - Health Check: http://localhost:${PORT}/api/health

🔗 Redis Connection:
   - URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}
   - Status: Connected ✅

🚀 Features Available:
   ✅ Real-time messaging with Socket.IO
   ✅ Multi-room chat support
   ✅ User authentication (JWT + Guest mode)
   ✅ File upload and sharing
   ✅ Private messaging
   ✅ Rate limiting and spam protection
   ✅ Message persistence with Redis
   ✅ Admin moderation tools
   ✅ Typing indicators
   ✅ Online user tracking

📊 Default Rooms Created:
   - general (public)
   - random (public)  
   - help (public)

🔧 Admin Features:
   - User management and role promotion
   - Room moderation and message deletion
   - System statistics and monitoring
   - Rate limiting and spam detection

💡 Quick Start:
   1. Open http://localhost:${PORT} in your browser
   2. Enter a username or continue as guest
   3. Start chatting in the 'general' room
   4. Try creating private rooms or sending direct messages

📝 Logs: Check ./logs/ directory for detailed application logs

⚡ Ready to accept connections!
      `;

      console.log(startupMessage);

      logger.logSystemEvent('server-startup-completed', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        nodeVersion: process.version,
      });
    });

    // Setup graceful shutdown handlers
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', reason, {
        promise: promise.toString(),
      });
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Log server statistics periodically
    if (process.env.NODE_ENV !== 'test') {
      setInterval(async () => {
        try {
          const socketStats = socketHandler.getStats();
          const redisStats = await redisManager.getStats();

          logger.logSystemEvent('periodic-stats', {
            sockets: socketStats,
            redis: redisStats,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
          });
        } catch (error) {
          logger.error('Error collecting periodic stats', error);
        }
      }, 5 * 60 * 1000); // Every 5 minutes
    }

    // Cleanup tasks (run every hour)
    if (process.env.NODE_ENV !== 'test') {
      setInterval(async () => {
        try {
          console.log('🧹 Running cleanup tasks...');

          // Cleanup inactive rooms
          const cleanedRooms = await chatService.cleanupInactiveRooms(7); // 7 days

          // Cleanup old guest users
          const { default: userService } = await import(
            './services/userService.js'
          );
          const cleanedGuests = await userService.cleanupGuestUsers(24); // 24 hours

          // Cleanup old logs
          const cleanedLogs = await logger.cleanupLogs(30); // 30 days

          logger.logSystemEvent('cleanup-completed', {
            cleanedRooms,
            cleanedGuests,
            cleanedLogs,
          });

          console.log(
            `🧹 Cleanup completed: ${cleanedRooms} rooms, ${cleanedGuests} guests, ${cleanedLogs} logs`
          );
        } catch (error) {
          logger.error('Error during cleanup tasks', error);
        }
      }, 60 * 60 * 1000); // Every hour
    }
  } catch (error) {
    logger.error('Server startup failed', error);
    console.error('❌ Failed to start server:', error.message);

    // Provide helpful error messages
    if (error.message.includes('Redis')) {
      console.error('\n💡 Redis Connection Help:');
      console.error('   Make sure Redis is running:');
      console.error('   - macOS: brew services start redis');
      console.error('   - Linux: sudo systemctl start redis');
      console.error('   - Docker: docker run -d -p 6379:6379 redis:7-alpine');
      console.error('   - Or update REDIS_URL in your .env file');
    }

    if (error.message.includes('EADDRINUSE')) {
      console.error(`\n💡 Port ${PORT} is already in use.`);
      console.error('   Try a different port:');
      console.error(`   - PORT=3001 npm start`);
      console.error('   - Or stop the other process using this port');
    }

    process.exit(1);
  }
};

// Export for testing
module.exports = { server, socketHandler };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
