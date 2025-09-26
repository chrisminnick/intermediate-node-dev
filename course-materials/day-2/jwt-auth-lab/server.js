const app = require('./app');

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log('🚀 JWT Authentication Lab Server');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
  console.log('📚 Available endpoints:');
  console.log('   GET  / - API documentation');
  console.log('   GET  /health - Health check');
  console.log('   POST /api/auth/register - User registration');
  console.log('   POST /api/auth/login - User login');
  console.log('   GET  /api/auth/profile - User profile (protected)');
  console.log('   GET  /api/users - All users (admin only)');
  console.log('   GET  /api/protected - Protected demo endpoint');
  console.log('   GET  /api/admin - Admin demo endpoint');
  console.log('');
  console.log('🔐 Default admin credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('');
  console.log('👤 Default user credentials:');
  console.log('   Username: user');
  console.log('   Password: user123');
  console.log('');
  console.log('⚡ Ready to accept connections!');
});

module.exports = server;
