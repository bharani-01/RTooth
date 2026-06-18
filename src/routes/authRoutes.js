import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

// Public Session Routes
router.post('/register', authController.register); // IT-Admin signup
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

// Protected Session Routes
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);

export default router;
