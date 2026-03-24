// src/config/logger.js
const winston = require('winston');
const env = require('./env');

const { combine, timestamp, json, colorize, printf } = winston.format;

const customFormat = printf((info) => {
  const { level, message, timestamp, requestId, service, ...metadata } = info;
  let msg = `[${timestamp}] [${service}] [${requestId || 'no-req-id'}] ${level}: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const isProd = env.NODE_ENV === 'production';

const transports = [
  new winston.transports.Console({
    format: isProd
      ? combine(timestamp(), json())
      : combine(colorize(), timestamp(), customFormat)
  })
];

if (isProd) {
  transports.push(
    new winston.transports.File({ filename: 'error.log', level: 'error', format: combine(timestamp(), json()) }),
    new winston.transports.File({ filename: 'combined.log', format: combine(timestamp(), json()) })
  );
}

const logger = winston.createLogger({
  level: env.NODE_ENV !== 'production' ? 'debug' : 'info',
  defaultMeta: { service: 'otp-baas' },
  transports
});

module.exports = logger;
