import rateLimit from 'express-rate-limit';

const skipInDevelopment = (req, res) => process.env.NODE_ENV !== 'production';

// Login/register: 10 attempts per IP per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: skipInDevelopment,
});

// OTP: 5 sends per IP per 15 minutes (separate from login limiter)
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
});

// Upload: 10 uploads per hour
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many upload requests from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
});

// General API: 300 requests per IP per 15 minutes
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Request rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
});
