import * as patientService from '../services/patientService.js';
import { sendResponse } from '../utils/response.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

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
    const { findings, notes, recommendations, checkup_date, next_checkup_date, followup_interval, followup_notes } = req.body;

    if (!findings) {
      throw new BadRequestError('Missing mandatory fields: findings description is required.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    const checkupData = { findings, notes, recommendations, checkup_date, next_checkup_date, followup_interval, followup_notes };
    const doctorId = req.profile.id; // Logged-in doctor ID
    const checkup = await patientService.createCheckup(patientId, doctorId, checkupData);

    return sendResponse(res, 201, 'Check-up record logged successfully.', { checkup });
  } catch (error) {
    next(error);
  }
};

/**
 * Update the status of a patient (e.g. from draft to active)
 */
export const updatePatientStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'draft'].includes(status)) {
      throw new BadRequestError("Invalid status. Status must be 'active' or 'draft'.");
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    const patient = await patientService.updatePatientStatus(patientId, status);

    return sendResponse(res, 200, `Patient status updated to '${status}' successfully.`, { patient });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing patient profile details
 */
export const updatePatientProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      cancerStage,
      lesionLocation,
      riskFactors,
      address,
      tobaccoHabit,
      tobaccoFrequency,
      tobaccoDuration,
      alcoholHabit,
      alcoholFrequency,
      alcoholDuration,
      betelNut,
      familyHistory,
      status
    } = req.body;

    if (!firstName || !lastName) {
      throw new BadRequestError('Missing required fields: firstName and lastName are mandatory.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    const updateData = {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      cancerStage,
      lesionLocation,
      riskFactors,
      address,
      tobaccoHabit,
      tobaccoFrequency,
      tobaccoDuration,
      alcoholHabit,
      alcoholFrequency,
      alcoholDuration,
      betelNut,
      familyHistory,
      status: status || 'draft'
    };

    const updatedProfile = await patientService.updatePatientProfile(patientId, updateData);

    return sendResponse(res, 200, 'Patient profile updated successfully.', { profile: updatedProfile });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a complete patient visit record (checkup, prescriptions, reports)
 */
export const createPatientVisit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { findings, notes, recommendations, checkup_date, prescriptions, report_types, next_checkup_date, followup_interval, followup_notes } = req.body;

    if (!findings) {
      throw new BadRequestError('Clinical findings are required to log a visit.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);
    const doctorId = req.profile.id;

    // Parse prescriptions JSON if sent
    let parsedPrescriptions = [];
    if (prescriptions) {
      try {
        parsedPrescriptions = typeof prescriptions === 'string' ? JSON.parse(prescriptions) : prescriptions;
      } catch (err) {
        throw new BadRequestError('Invalid prescriptions JSON format.');
      }
    }

    // Parse report types JSON if sent
    let parsedReportTypes = [];
    if (report_types) {
      try {
        parsedReportTypes = typeof report_types === 'string' ? JSON.parse(report_types) : report_types;
      } catch (err) {
        throw new BadRequestError('Invalid report_types JSON format.');
      }
    }

    // Handle files upload to Supabase Storage
    const uploadedReports = [];
    if (req.files && req.files.length > 0) {
      // Create bucket if not exists (using admin client)
      try {
        if (supabaseAdmin) {
          await supabaseAdmin.storage.createBucket('patient-reports', {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
            fileSizeLimit: 10485760
          });
        }
      } catch (bucketErr) {
        // Ignored if bucket exists
      }

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const reportType = parsedReportTypes[i] || 'Other';

        // Generate unique name
        const fileExt = file.originalname.split('.').pop();
        const uniqueFileName = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

        // Upload to bucket (using admin client to bypass storage RLS constraints)
        const storageClient = supabaseAdmin || supabase;
        const { data, error: uploadErr } = await storageClient.storage
          .from('patient-reports')
          .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (uploadErr) {
          console.error('Supabase upload error:', uploadErr);
          throw new Error(`Failed to upload file '${file.originalname}': ${uploadErr.message}`);
        }

        // Retrieve public URL
        const { data: { publicUrl } } = supabase.storage
          .from('patient-reports')
          .getPublicUrl(uniqueFileName);

        uploadedReports.push({
          report_type: reportType,
          file_name: file.originalname,
          file_url: publicUrl
        });
      }
    }

    const visitData = {
      findings,
      notes: notes || null,
      recommendations: recommendations || null,
      checkup_date: checkup_date || new Date().toISOString(),
      prescriptions: parsedPrescriptions,
      reports: uploadedReports,
      next_checkup_date: next_checkup_date || null,
      followup_interval: followup_interval || null,
      followup_notes: followup_notes || null
    };

    const visitResult = await patientService.createVisit(patientId, doctorId, visitData);

    return sendResponse(res, 201, 'Consultation visit logged successfully.', visitResult);
  } catch (error) {
    next(error);
  }
};

/**
 * Add additional reports to an existing visit
 */
export const addVisitReports = async (req, res, next) => {
  try {
    const { id, visitId } = req.params;
    const { report_types } = req.body;

    if (!req.files || req.files.length === 0) {
      throw new BadRequestError('No files provided for upload.');
    }

    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);
    const doctorId = req.profile.id;

    // Parse report types JSON if sent
    let parsedReportTypes = [];
    if (report_types) {
      try {
        parsedReportTypes = typeof report_types === 'string' ? JSON.parse(report_types) : report_types;
      } catch (err) {
        throw new BadRequestError('Invalid report_types JSON format.');
      }
    }

    // Handle files upload to Supabase Storage
    const uploadedReports = [];
    
    // Ensure bucket exists
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.storage.createBucket('patient-reports', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
          fileSizeLimit: 10485760
        });
      }
    } catch (bucketErr) {
      // Ignored if bucket exists
    }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const reportType = parsedReportTypes[i] || 'Other';

      // Generate unique name
      const fileExt = file.originalname.split('.').pop();
      const uniqueFileName = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

      // Upload to bucket (using admin client to bypass storage RLS constraints)
      const storageClient = supabaseAdmin || supabase;
      const { data, error: uploadErr } = await storageClient.storage
        .from('patient-reports')
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadErr) {
        console.error('Supabase upload error:', uploadErr);
        throw new Error(`Failed to upload file '${file.originalname}': ${uploadErr.message}`);
      }

      // Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from('patient-reports')
        .getPublicUrl(uniqueFileName);

      // Insert metadata into patient_reports
      const { data: repData, error: repError } = await supabase
        .from('patient_reports')
        .insert([
          {
            patient_id: patientId,
            doctor_id: doctorId,
            checkup_id: visitId,
            report_type: reportType,
            file_name: file.originalname,
            file_url: publicUrl
          }
        ])
        .select()
        .single();

      if (repError) throw repError;
      uploadedReports.push(repData);
    }

    return sendResponse(res, 201, 'Additional reports added successfully.', { reports: uploadedReports });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve specific visit details (doctors, admins, and patient themselves)
 */
export const getPatientVisitDetails = async (req, res, next) => {
  try {
    const { id, visitId } = req.params;

    // Resolve internal patient UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id);

    // Safety check: Patient role can only request their own record
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own clinical history.');
    }

    const visitDetails = await patientService.getVisitDetails(patientId, visitId);

    return sendResponse(res, 200, 'Visit details retrieved successfully.', visitDetails);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing medication prescription (doctors/admins only)
 */
export const updateMedication = async (req, res, next) => {
  try {
    const { id, medicationId } = req.params;
    const { medication_name, dosage, frequency, start_date, end_date } = req.body;

    if (!medication_name || !dosage || !frequency || !start_date) {
      throw new BadRequestError('Missing mandatory fields for prescription update.');
    }

    const medData = { medication_name, dosage, frequency, start_date, end_date };
    const medication = await patientService.updateMedication(medicationId, medData);

    return sendResponse(res, 200, 'Medication prescription updated successfully.', { medication });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an existing medication prescription (doctors/admins only)
 */
export const deleteMedication = async (req, res, next) => {
  try {
    const { id, medicationId } = req.params;

    await patientService.deleteMedication(medicationId);

    return sendResponse(res, 200, 'Medication prescription deleted successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile data of the currently logged-in patient.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const patientProfile = await patientService.getPatientProfileById(patientId);
    return sendResponse(res, 200, 'Patient profile retrieved successfully.', { profile: patientProfile });
  } catch (error) {
    next(error);
  }
};

/**
 * Get details of a specific visit of the currently logged-in patient.
 */
export const getMyVisitDetails = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const { visitId } = req.params;
    const visitDetails = await patientService.getVisitDetails(patientId, visitId);
    return sendResponse(res, 200, 'Visit details retrieved successfully.', visitDetails);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve patient follow-up compliance checklist.
 */
export const getFollowupCompliance = async (req, res, next) => {
  try {
    const isDoc = req.profile.role === 'doctor';
    const doctorId = isDoc ? req.profile.id : null;
    const compliance = await patientService.getPatientsFollowupCompliance(doctorId);
    return sendResponse(res, 200, 'Patient follow-up compliance retrieved successfully.', { compliance });
  } catch (error) {
    next(error);
  }
};




