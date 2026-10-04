const { rateLimit } = require('express-rate-limit');

const jsonHandler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
  handler: jsonHandler
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts. Please try again later.',
  handler: jsonHandler
});

const pricingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Pricing request limit reached. Please try again later.',
  handler: jsonHandler
});

module.exports = { apiLimiter, authLimiter, pricingLimiter };
