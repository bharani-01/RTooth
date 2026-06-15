import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Retrieve all registered doctors (IT-Admin only)
router.get('/', requireAuth, requireRole(['admin']), authController.getDoctors);

// Register a new oncology practitioner (IT-Admin only)
router.post('/', requireAuth, requireRole(['admin']), authController.registerDoctor);

export default router;
