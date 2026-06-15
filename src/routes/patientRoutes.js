import { Router } from 'express';
import * as patientController from '../controllers/patientController.js';
import * as authController from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Retrieve all patients for the doctor/admin
router.get('/', requireAuth, requireRole(['doctor', 'admin']), authController.getPatients);

// Register a new patient under the doctor session
router.post('/', requireAuth, requireRole(['doctor']), authController.registerPatient);

// Retrieve full patient clinical profile (doctors, admins, or patient themselves)
router.get('/:id', requireAuth, requireRole(['doctor', 'admin', 'patient']), patientController.getPatientProfile);

// Prescribe a medication (doctors/admins only)
router.post('/:id/medications', requireAuth, requireRole(['doctor', 'admin']), patientController.addMedication);

// Log a check-up record (doctors/admins only)
router.post('/:id/checkups', requireAuth, requireRole(['doctor', 'admin']), patientController.addCheckup);

export default router;
