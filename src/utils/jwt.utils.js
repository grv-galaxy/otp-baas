// src/utils/jwt.utils.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Redis = require('ioredis');

const inMemoryBlocklist = new Set();
let redisClient = null;

if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });
  redisClient.on('error', () => { /* Prevent crash on redis error in background */ });
}

const signToken = (payload) => {
  return jwt.sign(
    payload,
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: 'HS256'
    }
  );
};

const verifyToken = async (token) => {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithms: ['HS256']
  });

  const isBlocked = await isTokenRevoked(decoded.jti);
  if (isBlocked) {
    const err = new Error('Token has been revoked');
    err.code = 'TOKEN_REVOKED';
    err.status = 401;
    throw err;
  }

  return decoded;
};

const revokeToken = async (jti, exp) => {
  if (redisClient) {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redisClient.setex(`bl_${jti}`, ttl, 'true');
    }
  } else {
    inMemoryBlocklist.add(jti);
    // basic cleanup simulation for in-memory
    setTimeout(() => {
      inMemoryBlocklist.delete(jti);
    }, (exp - Math.floor(Date.now() / 1000)) * 1000);
  }
};

const isTokenRevoked = async (jti) => {
  if (redisClient) {
    const val = await redisClient.get(`bl_${jti}`);
    return val === 'true';
  }
  return inMemoryBlocklist.has(jti);
};

module.exports = {
  signToken,
  verifyToken,
  revokeToken,
  isTokenRevoked
};
