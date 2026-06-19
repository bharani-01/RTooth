import * as symptomService from '../services/symptomService.js';
import * as patientService from '../services/patientService.js';
import { sendResponse } from '../utils/response.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';

/**
 * Log symptoms for the currently logged-in patient
 */
export const logSymptoms = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const { burning_sensation, pain_scale, difficulty_opening_mouth, ulcer_duration, bleeding } = req.body;

    if (!burning_sensation || pain_scale === undefined || !difficulty_opening_mouth || ulcer_duration === undefined) {
      throw new BadRequestError('Missing mandatory fields for symptom logging.');
    }

    const logData = { burning_sensation, pain_scale, difficulty_opening_mouth, ulcer_duration, bleeding };
    const log = await symptomService.createSymptomLog(patientId, logData, req.token);

    return sendResponse(res, 201, 'Symptoms logged successfully.', { log });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all symptom logs of the currently logged-in patient
 */
export const getMySymptoms = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const logs = await symptomService.getSymptomLogsByPatientId(patientId, req.token);

    return sendResponse(res, 200, 'Symptom history retrieved successfully.', { logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all symptom logs of a specific patient (for doctors or the patient themselves)
 */
export const getPatientSymptoms = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Resolve internal patient UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Safety check: Patient role can only request their own records
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own clinical history.');
    }

    // Role verification: Exclude admin role as per user comments
    if (req.profile.role !== 'doctor' && req.profile.role !== 'patient') {
      throw new ForbiddenError('Access denied: Unauthorized role.');
    }

    const logs = await symptomService.getSymptomLogsByPatientId(patientId, req.token);

    return sendResponse(res, 200, 'Symptom logs retrieved successfully.', { logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent symptom logs for a doctor/admin dashboard
 */
export const getRecentSymptomLogs = async (req, res, next) => {
  try {
    const isDoc = req.profile.role === 'doctor';
    const doctorId = isDoc ? req.profile.id : null;

    // Check roles
    if (req.profile.role !== 'doctor' && req.profile.role !== 'admin') {
      throw new ForbiddenError('Access denied: Unauthorized role.');
    }

    const logs = await symptomService.getRecentSymptomLogs(doctorId, req.token);

    return sendResponse(res, 200, 'Recent symptom logs retrieved successfully.', { logs });
  } catch (error) {
    next(error);
  }
};

