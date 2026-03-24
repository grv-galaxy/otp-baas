// src/server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const mongoose = require('mongoose');

const env = require('./config/env');
const logger = require('./config/logger');
const connectDB = require('./config/db');

const requestId = require('./middleware/requestId');
const { globalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const otpRoutes = require('./routes/otp.routes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(requestId);

morgan.token('id', (req) => req.id);
app.use(morgan(':remote-addr - :id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms', {
  stream: { write: (message) => logger.info({ message: message.trim() }) }
}));

app.use(globalLimiter);

app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    db: isDbConnected ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime())
  });
});

const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'OTP BaaS API', version: '1.0.0', description: 'Production-ready OTP Backend-as-a-Service' },
  servers: [{ url: '/v1/otp', description: 'OTP Endpoints' }],
  paths: {
    '/send': {
      post: {
        summary: 'Send an OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', required: ['identifier', 'channel'], properties: { identifier: { type: 'string' }, channel: { type: 'string', enum: ['email', 'sms', 'whatsapp'] }, idempotencyKey: { type: 'string', format: 'uuid' } } } }
          }
        },
        responses: { '200': { description: 'OTP sent' }, '429': { description: 'Rate limit exceeded' } }
      }
    },
    '/verify': {
      post: {
        summary: 'Verify an OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', required: ['identifier', 'code'], properties: { identifier: { type: 'string' }, code: { type: 'string' } } } }
          }
        },
        responses: { '200': { description: 'OTP verified, returns JWT' }, '401': { description: 'Invalid OTP code' } }
      }
    },
    '/revoke': {
      post: {
        summary: 'Revoke an OTP or verification token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', required: ['identifier', 'token'], properties: { identifier: { type: 'string' }, token: { type: 'string' } } } }
          }
        },
        responses: { '200': { description: 'Token revoked' }, '401': { description: 'Invalid token' } }
      }
    }
  }
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/v1/otp', otpRoutes);
app.use(errorHandler);

let server;

const startServer = async () => {
  await connectDB();
  server = app.listen(env.PORT, () => {
    logger.info({ message: `Server listening on port ${env.PORT}` });
  });

  const gracefulShutdown = () => {
    logger.info({ message: 'SIGTERM or SIGINT received. Shutting down gracefully...' });
    if (server) {
      server.close(async () => {
        logger.info({ message: 'Waiting for in-flight requests to complete (10s timeout)...' });
        await mongoose.connection.close();
        logger.info({ message: 'Server shut down gracefully' });
        process.exit(0);
      });
      setTimeout(() => {
        logger.error({ message: 'Could not close connections in time, forcefully shutting down' });
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
};

if (require.main === module) {
  startServer();
}

module.exports = app;
