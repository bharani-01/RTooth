import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import { otpLimiter } from '../middlewares/rateLimiters.js';
import { body, validationResult } from 'express-validator';

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
  }
];

const router = Router();

// Public Session Routes
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/reset-password-otp', authController.resetPasswordOtp);
router.post('/otp/send', otpLimiter, authController.sendOtp);
router.post('/otp/verify', otpLimiter, authController.verifyOtp);

// Protected Session Routes
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);

// Admin User Management Routes (IT-Admin only)
router.post('/register', requireAuth, requireRole(['admin']), authController.register); // IT-Admin signup
router.get('/admin/users', requireAuth, requireRole(['admin']), authController.adminListUsers);
router.post('/admin/users', requireAuth, requireRole(['admin']), authController.adminCreateUser);
router.put('/admin/users/:id', requireAuth, requireRole(['admin']), authController.adminUpdateUser);
router.delete('/admin/users/:id', requireAuth, requireRole(['admin']), authController.adminDeleteUser);
router.post('/admin/users/:id/ban', requireAuth, requireRole(['admin']), authController.adminBanUser);
router.post('/admin/notifications/daily', requireAuth, requireRole(['admin']), notificationController.triggerDailyNotifications);

export default router;
