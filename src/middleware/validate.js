// src/middleware/validate.js
const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new Error('Validation Error');
      error.code = 'VALIDATION_ERROR';
      error.status = 422;
      error.details = err.errors.map(e => ({ path: e.path.join('.'), message: e.message }));
      next(error);
    } else {
      next(err);
    }
  }
};

module.exports = validate;
