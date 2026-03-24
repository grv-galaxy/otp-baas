// src/controllers/otp.controller.js
const otpService = require('../services/otp.service');
const { verifyToken } = require('../utils/jwt.utils');

const sendOtp = async (req, res, next) => {
  try {
    const { identifier, channel, idempotencyKey } = req.body;
    const ipAddress = req.ip;
    const requestId = req.id;

    const result = await otpService.sendOtp({
      identifier,
      channel,
      idempotencyKey,
      ipAddress,
      requestId
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { identifier, code } = req.body;
    const result = await otpService.verifyOtp({ identifier, code });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const revokeOtp = async (req, res, next) => {
  try {
    const { identifier, token } = req.body;
    let decodedToken = null;
    try {
      decodedToken = await verifyToken(token);
    } catch (err) {
      const error = new Error('Invalid or expired token');
      error.code = 'VALIDATION_ERROR';
      error.status = 401;
      throw error;
    }

    if (decodedToken.sub !== identifier) {
      const error = new Error('Token does not match identifier');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const result = await otpService.revokeOtp({ 
      identifier, 
      jti: decodedToken.jti, 
      exp: decodedToken.exp 
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  revokeOtp
};
