import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Public Routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected Routes
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.post('/doctor/register-patient', requireAuth, requireRole(['doctor']), authController.registerPatient);
router.get('/doctor/patients', requireAuth, requireRole(['doctor']), authController.getPatients);
router.post('/admin/register-doctor', requireAuth, requireRole(['admin']), authController.registerDoctor);
router.get('/admin/doctors', requireAuth, requireRole(['admin']), authController.getDoctors);

// Role Specific Test Routes (useful for validating client-side page guards)
router.get('/doctor/verify', requireAuth, requireRole(['doctor']), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized access to Doctor resource verified.',
    data: {
      profile: req.profile
    }
  });
});

router.get('/patient/verify', requireAuth, requireRole(['patient']), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized access to Patient resource verified.',
    data: {
      profile: req.profile
    }
  });
});

export default router;
