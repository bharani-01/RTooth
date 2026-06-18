import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Public Session Routes
router.post('/register', authController.register); // IT-Admin signup
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/reset-password-otp', authController.resetPasswordOtp);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

// Protected Session Routes
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);

// Admin User Management Routes (IT-Admin only)
router.get('/admin/users', requireAuth, requireRole(['admin']), authController.adminListUsers);
router.post('/admin/users', requireAuth, requireRole(['admin']), authController.adminCreateUser);
router.put('/admin/users/:id', requireAuth, requireRole(['admin']), authController.adminUpdateUser);
router.delete('/admin/users/:id', requireAuth, requireRole(['admin']), authController.adminDeleteUser);
router.post('/admin/users/:id/ban', requireAuth, requireRole(['admin']), authController.adminBanUser);

export default router;
