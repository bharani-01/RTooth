import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Retrieve system security audit logs (IT-Admin only)
router.get('/audit-logs', requireAuth, requireRole(['admin']), authController.getAuditLogs);

// Retrieve all registered doctors (IT-Admin only)
router.get('/', requireAuth, requireRole(['admin']), authController.getDoctors);

// Debug storage client (IT-Admin only)
router.get('/debug-storage', requireAuth, requireRole(['admin']), authController.debugStorage);

// Retrieve a specific doctor's detailed profile and stats (IT-Admin only)
router.get('/:id', requireAuth, requireRole(['admin']), authController.getDoctorProfile);

// Register a new oncology practitioner (IT-Admin only)
router.post('/', requireAuth, requireRole(['admin']), authController.registerDoctor);

// Trigger reset link for doctor (IT-Admin only)
router.post('/:id/send-reset-link', requireAuth, requireRole(['admin']), authController.sendDoctorResetLink);

export default router;
