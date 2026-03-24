// src/routes/otp.routes.js
const express = require('express');
const { z } = require('zod');
const otpController = require('../controllers/otp.controller');
const validate = require('../middleware/validate');
const { ipLimiter, identifierLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const sendSchema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  idempotencyKey: z.string().uuid().optional()
});

const verifySchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6)
});

const revokeSchema = z.object({
  identifier: z.string().min(1),
  token: z.string().min(1)
});

router.post(
  '/send',
  ipLimiter,
  identifierLimiter,
  validate(z.object({ body: sendSchema })),
  otpController.sendOtp
);

router.post(
  '/verify',
  validate(z.object({ body: verifySchema })),
  otpController.verifyOtp
);

router.post(
  '/revoke',
  validate(z.object({ body: revokeSchema })),
  otpController.revokeOtp
);

module.exports = router;
