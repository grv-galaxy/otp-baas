// src/middleware/errorHandler.js
const logger = require('../config/logger');
const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    code = 'VALIDATION_ERROR';
    message = 'Invalid JSON payload';
    status = 400;
  }

  if (status === 500) {
    logger.error({
      message: err.message,
      requestId: req.id,
      stack: err.stack,
      url: req.originalUrl
    });
    
    if (env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
    }
  }

  const response = {
    success: false,
    code,
    message,
    requestId: req.id
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(status).json(response);
};

module.exports = errorHandler;
