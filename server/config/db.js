import mongoose from 'mongoose';

/**
 * Connect to MongoDB replica set
 * Replica set is required for Change Streams (CDC)
 */
export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }

    const conn = await mongoose.connect(MONGODB_URI, {
      // Use new URL parser and unified topology
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Check if replica set is configured
    const admin = conn.connection.db.admin();
    const replStatus = await admin.command({ replSetGetStatus: 1 }).catch(() => null);

    if (replStatus) {
      console.log(`🔄 Replica Set: ${replStatus.set}`);
    } else {
      console.warn('⚠️  WARNING: Not running as replica set. Change Streams will not work!');
      console.warn('   See README for setup instructions.');
    }

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Handle connection events
 */
export const setupDBEventHandlers = () => {
  mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB Error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB Disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB Reconnected');
  });
};
