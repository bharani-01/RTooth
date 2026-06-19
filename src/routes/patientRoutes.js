import { Router } from 'express';
import * as patientController from '../controllers/patientController.js';
import * as authController from '../controllers/authController.js';
import * as symptomController from '../controllers/symptomController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Retrieve all patients for the doctor/admin
router.get('/', requireAuth, requireRole(['doctor', 'admin']), authController.getPatients);

// Register a new patient under the doctor session
router.post('/', requireAuth, requireRole(['doctor']), authController.registerPatient);

// Retrieve currently logged-in patient's own profile
router.get('/me', requireAuth, requireRole(['patient']), patientController.getMyProfile);

// Retrieve currently logged-in patient's own visit details
router.get('/me/visits/:visitId', requireAuth, requireRole(['patient']), patientController.getMyVisitDetails);

// Log symptoms for currently logged-in patient
router.post('/me/symptoms', requireAuth, requireRole(['patient']), symptomController.logSymptoms);

// Retrieve currently logged-in patient's own symptom logs
router.get('/me/symptoms', requireAuth, requireRole(['patient']), symptomController.getMySymptoms);

// Retrieve recent symptom logs of patients (for doctors and admins)
router.get('/symptoms/recent', requireAuth, requireRole(['doctor', 'admin']), symptomController.getRecentSymptomLogs);

// Retrieve follow-up compliance checklist (doctors and admins only)
router.get('/scheduling/followups', requireAuth, requireRole(['doctor', 'admin']), patientController.getFollowupCompliance);

// Retrieve symptom logs of a specific patient (for doctors or the patient themselves)
router.get('/:id/symptoms', requireAuth, requireRole(['doctor', 'patient']), symptomController.getPatientSymptoms);

// Retrieve full patient clinical profile (doctors, admins, or patient themselves)
router.get('/:id', requireAuth, requireRole(['doctor', 'admin', 'patient']), patientController.getPatientProfile);

// Prescribe a medication (doctors/admins only)
router.post('/:id/medications', requireAuth, requireRole(['doctor', 'admin']), patientController.addMedication);

// Update a medication prescription (doctors/admins only)
router.put('/:id/medications/:medicationId', requireAuth, requireRole(['doctor', 'admin']), patientController.updateMedication);

// Delete a medication prescription (doctors/admins only)
router.delete('/:id/medications/:medicationId', requireAuth, requireRole(['doctor', 'admin']), patientController.deleteMedication);

// Log a check-up record (doctors/admins only)
router.post('/:id/checkups', requireAuth, requireRole(['doctor', 'admin']), patientController.addCheckup);

// Update patient status (doctors/admins only)
router.patch('/:id/status', requireAuth, requireRole(['doctor', 'admin']), patientController.updatePatientStatus);

// Update patient profile details (doctors/admins only)
router.put('/:id', requireAuth, requireRole(['doctor', 'admin']), patientController.updatePatientProfile);

// Create a complete consultation visit (doctors only)
router.post('/:id/visits', requireAuth, requireRole(['doctor']), upload.array('report_files', 5), patientController.createPatientVisit);

// Add additional reports to a specific visit (doctors only)
router.post('/:id/visits/:visitId/reports', requireAuth, requireRole(['doctor']), upload.array('report_files', 5), patientController.addVisitReports);

// Retrieve a specific consultation visit details (doctors, admins, and patients)
router.get('/:id/visits/:visitId', requireAuth, requireRole(['doctor', 'admin', 'patient']), patientController.getPatientVisitDetails);

// Patient image gallery uploads (patients only)
router.post('/me/images', requireAuth, requireRole(['patient']), upload.single('image_file'), patientController.uploadPatientImage);
router.get('/me/images', requireAuth, requireRole(['patient']), patientController.getMyImages);

// Retrieve patient images (doctors, admins, or patient self)
router.get('/:id/images', requireAuth, requireRole(['doctor', 'admin', 'patient']), patientController.getPatientImages);

// Update doctor notes for a patient image (doctors and admins only)
router.patch('/:id/images/:imageId/notes', requireAuth, requireRole(['doctor', 'admin']), patientController.updateImageDoctorNotes);

export default router;
