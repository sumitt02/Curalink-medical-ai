const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/curalink';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected.');
    });

    return conn;
  } catch (error) {
    console.warn(`⚠️  MongoDB connection failed: ${error.message}`);
    console.warn('   Running in memory-only mode (conversations won\'t persist between restarts).');
    console.warn('   To persist data, set MONGODB_URI in backend/.env to a MongoDB Atlas connection string.');
    // Don't crash — app works without DB (in-memory fallback in chatController)
    return null;
  }
};

module.exports = connectDB;
