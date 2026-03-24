// src/models/otp.model.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      index: true
    },
    hashedCode: {
      type: String,
      required: true
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'email'],
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: () => require('../config/env').OTP_MAX_ATTEMPTS
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isInvalidated: {
      type: Boolean,
      default: false
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending'
    },
    ipAddress: {
      type: String
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index on expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index on { identifier, isVerified, isInvalidated }
otpSchema.index({ identifier: 1, isVerified: 1, isInvalidated: 1 });

// Unique sparse index on idempotencyKey is already defined in the schema above `unique: true, sparse: true`.
// But we can explicitly declare it if needed or rely on the schema definition.

const OtpModel = mongoose.model('Otp', otpSchema);

module.exports = OtpModel;
