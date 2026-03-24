// // src/middleware/rateLimiter.js
// const { rateLimit } = require('express-rate-limit');
// const { RedisStore } = require('rate-limit-redis');
// const { Redis } = require('ioredis');
// const env = require('../config/env');
// const logger = require('../config/logger');

// let store = undefined;
// if (env.REDIS_URL) {
//   const client = new Redis(env.REDIS_URL);
//   client.on('error', (err) => logger.error({ message: 'Redis rate-limit error', error: err.message }));
//   store = new RedisStore({
//     sendCommand: (...args) => client.call(...args)
//   });
// } else {
//   logger.warn({ message: 'REDIS_URL not set, using MemoryStore for rate limiting' });
// }

// const windowMs = env.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

// const handler = (req, res, next, options) => {
//   res.status(options.statusCode).json({
//     success: false,
//     code: 'RATE_LIMIT_EXCEEDED',
//     message: options.message,
//     retryAfter: Math.ceil(options.windowMs / 1000),
//     requestId: req.id
//   });
// };

// const ipLimiter = rateLimit({
//   windowMs,
//   max: env.OTP_RATE_LIMIT_COUNT * 2,
//   store,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests from this IP',
//   handler
// });

// const identifierLimiter = rateLimit({
//   windowMs,
//   max: env.OTP_RATE_LIMIT_COUNT,
//   store,
//   keyGenerator: (req) => req.body.identifier || req.ip,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many OTP requests for this identifier',
//   handler
// });

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   store,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests globally',
//   handler
// });

// module.exports = {
//   ipLimiter,
//   identifierLimiter,
//   globalLimiter
// };

































// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const WINDOW_MS = (parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES) || 10) * 60 * 1000;
const MAX_PER_IDENTIFIER = parseInt(process.env.OTP_RATE_LIMIT_COUNT) || 3;
const MAX_PER_IP = MAX_PER_IDENTIFIER * 2;

const makeMemoryStore = () => undefined; // express-rate-limit uses MemoryStore by default

let makeStore;

if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
  try {
    const { RedisStore } = require('rate-limit-redis');
    const Redis = require('ioredis');

    makeStore = (prefix) => {
      const client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      });

      client.on('error', (err) => {
        logger.error('Redis rate-limit error', { error: err.message });
      });

      return new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix,
      });
    };

    logger.info('Using Redis store for rate limiting');
  } catch (err) {
    logger.warn('Redis setup failed, falling back to MemoryStore', { error: err.message });
    makeStore = () => makeMemoryStore();
  }
} else {
  logger.warn('REDIS_URL not set, using MemoryStore for rate limiting');
  makeStore = () => makeMemoryStore();
}

// Global limiter — applied to all routes (100 req / 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore ? makeStore('global:') : undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      requestId: req.id,
    });
  },
});

// Per-identifier limiter — applied to /v1/otp/send only
const identifierLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_PER_IDENTIFIER,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `identifier:${req.body?.identifier || req.ip}`,
  store: makeStore ? makeStore('identifier:') : undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Max ${MAX_PER_IDENTIFIER} OTP requests per ${process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 10} minutes`,
      retryAfter: Math.ceil(WINDOW_MS / 1000),
      requestId: req.id,
    });
  },
});

// Per-IP limiter — applied to /v1/otp/send only
const ipLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_PER_IP,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip}`,
  store: makeStore ? makeStore('ip:') : undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
      requestId: req.id,
    });
  },
});

module.exports = { globalLimiter, identifierLimiter, ipLimiter };