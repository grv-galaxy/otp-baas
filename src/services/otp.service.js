// src/services/otp.service.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const OtpModel = require('../models/otp.model');
const env = require('../config/env');
const logger = require('../config/logger');
const { signToken, revokeToken } = require('../utils/jwt.utils');

const EmailProvider = require('./providers/email.provider');
const SmsProvider = require('./providers/sms.provider');
const WhatsappProvider = require('./providers/whatsapp.provider');
const MockProvider = require('./providers/mock.provider');

const getProvider = (channel) => {
  if (env.MOCK_MODE) return new MockProvider();

  if (channel === 'email' && (!env.SMTP_HOST || !env.SMTP_USER)) {
    return new MockProvider();
  }
  if ((channel === 'sms' || channel === 'whatsapp') && !env.MC_AUTH_TOKEN) {
    return new MockProvider();
  }

  if (channel === 'email') return new EmailProvider();
  if (channel === 'sms') return new SmsProvider();
  if (channel === 'whatsapp') return new WhatsappProvider();

  return new MockProvider();
};

const sendOtp = async ({ identifier, channel, idempotencyKey, ipAddress, requestId }) => {
  if (idempotencyKey) {
    const existing = await OtpModel.findOne({
      idempotencyKey,
      expiresAt: { $gt: new Date() }
    });

    if (existing) {
      return {
        success: true,
        message: 'OTP sent',
        channel: existing.channel,
        expiresIn: Math.max(0, Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000))
      };
    }
  }

  const otpCode = crypto.randomInt(100000, 999999).toString();
  const hashedCode = await bcrypt.hash(otpCode, 10);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  const otpDoc = await OtpModel.create({
    identifier,
    hashedCode,
    channel,
    expiresAt,
    ipAddress,
    idempotencyKey
  });

  const provider = getProvider(channel);

  try {
    await provider.send(identifier, otpCode, channel, requestId);
    otpDoc.deliveryStatus = 'sent';
    await otpDoc.save();

    return {
      success: true,
      message: 'OTP sent',
      channel,
      expiresIn: env.OTP_EXPIRY_MINUTES * 60
    };
  } catch (error) {
    otpDoc.deliveryStatus = 'failed';
    await otpDoc.save();

    const identifierHash = crypto.createHash('sha256').update(identifier).digest('hex');
    logger.error({
      message: 'Provider error sending OTP',
      requestId,
      channel,
      identifier_hash: identifierHash,
      error: error.message
    });

    const err = new Error('Failed to send OTP via provider');
    err.code = 'PROVIDER_ERROR';
    err.status = 502;
    throw err;
  }
};

const verifyOtp = async ({ identifier, code }) => {
  const otpDoc = await OtpModel.findOne({
    identifier,
    isVerified: false,
    isInvalidated: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    const err = new Error('OTP not found or expired');
    err.code = 'OTP_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (otpDoc.attempts >= otpDoc.maxAttempts) {
    otpDoc.isInvalidated = true;
    await otpDoc.save();
    const err = new Error('OTP invalidated due to maximum attempts reached');
    err.code = 'OTP_INVALIDATED';
    err.status = 410;
    throw err;
  }

  const isValidHash = await bcrypt.compare(code, otpDoc.hashedCode);

  otpDoc.attempts += 1;

  if (!isValidHash) {
    if (otpDoc.attempts >= otpDoc.maxAttempts) {
      otpDoc.isInvalidated = true;
      await otpDoc.save();
      const err = new Error('OTP invalidated due to maximum attempts reached');
      err.code = 'OTP_INVALIDATED';
      err.status = 410;
      throw err;
    }
    await otpDoc.save();
    
    // As per spec: Return 401 with attemptsRemaining
    const err = new Error('Invalid OTP code');
    err.code = 'OTP_INVALID';
    err.status = 401;
    err.attemptsRemaining = otpDoc.maxAttempts - otpDoc.attempts;
    throw err;
  }

  otpDoc.isVerified = true;
  await otpDoc.save();

  const jti = uuidv4();
  const token = signToken({
    sub: identifier,
    channel: otpDoc.channel,
    jti
  });

  return {
    success: true,
    verificationToken: token
  };
};

const revokeOtp = async ({ identifier, jti, exp }) => {
  await OtpModel.updateMany({ identifier }, { $set: { isInvalidated: true } });
  if (jti && exp) {
    await revokeToken(jti, exp);
  }
  return { success: true };
};

module.exports = {
  sendOtp,
  verifyOtp,
  revokeOtp
};
