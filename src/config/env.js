// src/config/env.js
const { cleanEnv, str, port, num, bool } = require('envalid');
const dotenv = require('dotenv');

dotenv.config();

const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production', 'staging'], default: 'development' }),
  PORT: port({ default: 3000 }),
  MONGODB_URI: str(),
  JWT_SECRET: str(),
  JWT_ISSUER: str(),
  JWT_AUDIENCE: str(),
  JWT_EXPIRES_IN: str({ default: '1h' }),
  CORS_ORIGINS: str({ default: '*' }),
  OTP_EXPIRY_MINUTES: num({ default: 5 }),
  OTP_MAX_ATTEMPTS: num({ default: 3 }),
  OTP_RATE_LIMIT_COUNT: num({ default: 3 }),
  OTP_RATE_LIMIT_WINDOW_MINUTES: num({ default: 10 }),
  SMTP_HOST: str({ default: '' }),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASS: str({ default: '' }),
  EMAIL_FROM: str({ default: '' }),
  MC_AUTH_TOKEN: str({ default: '' }),
  MC_CUSTOMER_ID: str({ default: '' }),
  MC_SENDER_ID: str({ default: '' }),
  REDIS_URL: str({ default: '' }),
  MOCK_MODE: bool({ default: false }),
  TWILIO_ACCOUNT_SID: str({ default: '' }),
  TWILIO_AUTH_TOKEN: str({ default: '' }),
  TWILIO_PHONE_NUMBER: str({ default: '' }),
});

module.exports = env;
