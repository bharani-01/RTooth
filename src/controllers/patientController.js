import * as patientService from '../services/patientService.js';
import { sendResponse } from '../utils/response.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';

/**
 * Get the full profile data of a specific patient by ID or custom patient code.
 */
export const getPatientProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    // Safety check: Patient role can only request their own record
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own clinical history.');
    }

    const patientProfile = await patientService.getPatientProfileById(patientId);
    
    // Attending doctor log warning
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      console.warn(`[Warning] Attending doctor discrepancy. Doctor: ${req.profile.id}, Patient Attending Doctor: ${patientProfile.doctor_id}`);
    }

    return sendResponse(res, 200, 'Patient profile retrieved successfully.', { profile: patientProfile });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a medication prescription for the patient
 */
export const addMedication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { medication_name, dosage, frequency, start_date, end_date } = req.body;

    if (!medication_name || !dosage || !frequency || !start_date) {
      throw new BadRequestError('Missing mandatory fields: medication_name, dosage, frequency, and start_date are required.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    const medData = { medication_name, dosage, frequency, start_date, end_date };
    const medication = await patientService.createMedication(patientId, medData);

    return sendResponse(res, 201, 'Medication prescription added successfully.', { medication });
  } catch (error) {
    next(error);
  }
};

/**
 * Log a clinical check-up visit for the patient
 */
export const addCheckup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { findings, notes, recommendations, checkup_date } = req.body;

    if (!findings) {
      throw new BadRequestError('Missing mandatory fields: findings description is required.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    const checkupData = { findings, notes, recommendations, checkup_date };
    const doctorId = req.profile.id; // Logged-in doctor ID
    const checkup = await patientService.createCheckup(patientId, doctorId, checkupData);

    return sendResponse(res, 201, 'Check-up record logged successfully.', { checkup });
  } catch (error) {
    next(error);
  }
};
