const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection options for transactions support
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Check if replica set is configured (required for transactions)
    const adminDb = conn.connection.db.admin();
    const serverStatus = await adminDb.command({ serverStatus: 1 });

    if (!serverStatus.repl) {
      console.warn('⚠️  WARNING: MongoDB is not running as a replica set.');
      console.warn('   Transactions will not work without a replica set.');
      console.warn(
        '   For development, you can start MongoDB with: mongod --replSet rs0'
      );
      console.warn('   Then initialize the replica set with: rs.initiate()');
    } else {
      console.log('✅ Replica set detected - transactions are supported');
    }

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);

    if (error.name === 'MongoServerSelectionError') {
      console.error('💡 Make sure MongoDB is running and accessible');
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Check if MongoDB service is started');
    }

    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

// Health check function
const checkDatabaseHealth = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date() };
  }
};

// Get database statistics
const getDatabaseStats = async () => {
  try {
    const stats = await mongoose.connection.db.stats();
    return {
      database: mongoose.connection.name,
      collections: stats.collections,
      dataSize: Math.round((stats.dataSize / 1024 / 1024) * 100) / 100, // MB
      indexSize: Math.round((stats.indexSize / 1024 / 1024) * 100) / 100, // MB
      documents: stats.objects,
    };
  } catch (error) {
    throw new Error(`Failed to get database stats: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  getDatabaseStats,
};
