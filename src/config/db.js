// src/config/db.js
const mongoose = require('mongoose');
const logger = require('./logger');
const env = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true
    });

    logger.info({ message: 'MongoDB connected successfully' });
  } catch (err) {
    logger.error({ message: 'Failed to connect to MongoDB', error: err.message });
    // In production we might want to exit, but per requirements we attempt reconnects.
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn({ message: 'MongoDB disconnected. Attempting reconnect after 5 seconds...' });
  setTimeout(connectDB, 5000);
});

mongoose.connection.on('error', (err) => {
  logger.error({ message: 'MongoDB connection error', error: err.message });
});

module.exports = connectDB;
