import * as patientService from '../services/patientService.js';
import { sendResponse } from '../utils/response.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';
import { supabase, supabaseAdmin, getSupabaseUserClient } from '../config/supabase.js';
import crypto from 'crypto';


/**
 * Get the full profile data of a specific patient by ID or custom patient code.
 */
export const getPatientProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Resolve internal UUID
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Safety check: Patient role can only request their own record
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own clinical history.');
    }

    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    
    // Check doctor ownership to prevent BOLA/IDOR
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to retrieve this patient\'s clinical history.');
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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to manage prescriptions for this patient.');
    }

    const medData = { medication_name, dosage, frequency, start_date, end_date };
    const medication = await patientService.createMedication(patientId, medData, req.token);

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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to log check-ups for this patient.');
    }

    const checkupData = { findings, notes, recommendations, checkup_date, next_checkup_date, followup_interval, followup_notes };
    const doctorId = req.profile.id; // Logged-in doctor ID
    const checkup = await patientService.createCheckup(patientId, doctorId, checkupData, req.token);

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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to update this patient\'s status.');
    }

    const patient = await patientService.updatePatientStatus(patientId, status, req.token);

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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to update this patient\'s profile.');
    }

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

    const updatedProfile = await patientService.updatePatientProfile(patientId, updateData, req.token);

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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);
    const doctorId = req.profile.id;
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to create visit records for this patient.');
    }

    const cleanPatientName = `${patientProfile.first_name}_${patientProfile.last_name}`.replace(/[^a-zA-Z0-9_]/g, '');
    const checkupId = crypto.randomUUID();

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
        const cleanReportType = reportType.replace(/[^a-zA-Z0-9_]/g, '_');
        const formattedDate = new Date().toISOString().slice(0, 19).replace(/T/, '_').replace(/:/g, '-');
        const uniqueFileName = `${patientId}/${cleanPatientName}-${cleanReportType}-${formattedDate}-Visit-${checkupId}.${fileExt}`;
        const newFileName = `${cleanPatientName}-${cleanReportType}-${formattedDate}-Visit-${checkupId.substring(0, 8)}.${fileExt}`;

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
          file_name: newFileName,
          file_url: publicUrl
        });
      }
    }

    const visitData = {
      id: checkupId,
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

    const visitResult = await patientService.createVisit(patientId, doctorId, visitData, req.token);

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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);
    const doctorId = req.profile.id;
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);

    // Check doctor ownership to prevent BOLA/IDOR
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to add reports for this patient.');
    }

    const cleanPatientName = `${patientProfile.first_name}_${patientProfile.last_name}`.replace(/[^a-zA-Z0-9_]/g, '');

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
      const cleanReportType = reportType.replace(/[^a-zA-Z0-9_]/g, '_');
      const formattedDate = new Date().toISOString().slice(0, 19).replace(/T/, '_').replace(/:/g, '-');
      const uniqueFileName = `${patientId}/${cleanPatientName}-${cleanReportType}-${formattedDate}-Visit-${visitId}.${fileExt}`;
      const newFileName = `${cleanPatientName}-${cleanReportType}-${formattedDate}-Visit-${visitId.substring(0, 8)}.${fileExt}`;

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
      const dbClient = getSupabaseUserClient(req.token);
      const { data: repData, error: repError } = await dbClient
        .from('patient_reports')
        .insert([
          {
            patient_id: patientId,
            doctor_id: doctorId,
            checkup_id: visitId,
            report_type: reportType,
            file_name: newFileName,
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
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Safety check: Patient role can only request their own record
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own clinical history.');
    }

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to view visit records for this patient.');
    }

    const visitDetails = await patientService.getVisitDetails(patientId, visitId, req.token);

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

    // Resolve internal patient UUID to check doctor ownership to prevent BOLA/IDOR
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to modify prescriptions for this patient.');
    }

    const medData = { medication_name, dosage, frequency, start_date, end_date };
    const medication = await patientService.updateMedication(medicationId, medData, req.token);

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

    // Resolve internal patient UUID to check doctor ownership to prevent BOLA/IDOR
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to delete prescriptions for this patient.');
    }

    await patientService.deleteMedication(medicationId, req.token);

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
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
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
    const visitDetails = await patientService.getVisitDetails(patientId, visitId, req.token);
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
    const compliance = await patientService.getPatientsFollowupCompliance(doctorId, req.token);
    return sendResponse(res, 200, 'Patient follow-up compliance retrieved successfully.', { compliance });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload diagnostic photograph for the patient
 */
export const uploadPatientImage = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const { image_type, description } = req.body;

    if (!req.file) {
      throw new BadRequestError('No file provided for upload.');
    }

    if (!image_type || !['Lesion Photograph', 'Mouth Opening Image', 'Progression Image'].includes(image_type)) {
      throw new BadRequestError('Invalid or missing image_type. Must be one of: Lesion Photograph, Mouth Opening Image, Progression Image.');
    }

    // Resolve patient details for clean file name
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    const cleanPatientName = `${patientProfile.first_name}_${patientProfile.last_name}`.replace(/[^a-zA-Z0-9_]/g, '');

    // Ensure bucket exists
    try {
      if (supabaseAdmin) {
        await supabaseAdmin.storage.createBucket('patient-images', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          fileSizeLimit: 10485760 // 10MB
        });
      }
    } catch (bucketErr) {
      // Ignored if exists
    }

    // Generate unique name
    const fileExt = req.file.originalname.split('.').pop();
    const cleanImageType = image_type.replace(/[^a-zA-Z0-9_]/g, '_');
    const formattedDate = new Date().toISOString().slice(0, 19).replace(/T/, '_').replace(/:/g, '-');
    const uniqueFileName = `${patientId}/${cleanPatientName}-${cleanImageType}-${formattedDate}.${fileExt}`;

    const storageClient = supabaseAdmin || supabase;
    const { data, error: uploadErr } = await storageClient.storage
      .from('patient-images')
      .upload(uniqueFileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadErr) {
      console.error('Supabase upload error:', uploadErr);
      throw new Error(`Failed to upload file: ${uploadErr.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('patient-images')
      .getPublicUrl(uniqueFileName);

    const imageRecord = await patientService.savePatientImageMetadata(patientId, {
      image_type,
      file_name: `${cleanPatientName}-${cleanImageType}-${formattedDate}.${fileExt}`,
      file_url: publicUrl,
      description
    }, req.token);

    return sendResponse(res, 201, 'Photograph uploaded successfully.', { image: imageRecord });
  } catch (error) {
    next(error);
  }
};

/**
 * Get currently logged-in patient's own gallery images
 */
export const getMyImages = async (req, res, next) => {
  try {
    const patientId = req.profile.id;
    const images = await patientService.fetchPatientImages(patientId, req.token);

    // Sanitize private doctor notes
    const sanitizedImages = images.map(img => {
      if (img.doctor_notes_visibility === 'private') {
        const { doctor_notes, ...rest } = img;
        return { ...rest, doctor_notes: null };
      }
      return img;
    });

    return sendResponse(res, 200, 'Patient gallery images retrieved successfully.', { images: sanitizedImages });
  } catch (error) {
    next(error);
  }
};

/**
 * Get images for a specific patient (doctor/admin sees all; self patient gets sanitized notes)
 */
export const getPatientImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);

    // Safety check: Patients can only retrieve their own gallery
    if (req.profile.role === 'patient' && req.profile.id !== patientId) {
      throw new ForbiddenError('Access denied: Patients can only retrieve their own gallery.');
    }

    // Check doctor ownership to prevent BOLA/IDOR
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to view gallery images for this patient.');
    }

    const images = await patientService.fetchPatientImages(patientId, req.token);

    let sanitizedImages = images;
    if (req.profile.role === 'patient') {
      sanitizedImages = images.map(img => {
        if (img.doctor_notes_visibility === 'private') {
          const { doctor_notes, ...rest } = img;
          return { ...rest, doctor_notes: null };
        }
        return img;
      });
    }

    return sendResponse(res, 200, 'Patient gallery images retrieved successfully.', { images: sanitizedImages });
  } catch (error) {
    next(error);
  }
};

/**
 * Add or update doctor notes for a patient image (doctors/admins only)
 */
export const updateImageDoctorNotes = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    const { doctor_notes, doctor_notes_visibility } = req.body;

    if (doctor_notes_visibility && !['public', 'private'].includes(doctor_notes_visibility)) {
      throw new BadRequestError("Invalid visibility. Visibility must be 'public' or 'private'.");
    }

    // Resolve internal patient UUID to check doctor ownership to prevent BOLA/IDOR
    const patientId = await patientService.getPatientIdByIdOrCode(id, req.token);
    const patientProfile = await patientService.getPatientProfileById(patientId, req.token);
    if (req.profile.role === 'doctor' && patientProfile.doctor_id && patientProfile.doctor_id !== req.profile.id) {
      throw new ForbiddenError('Access denied: You are not authorized to manage notes for this patient\'s gallery.');
    }

    const updatedImage = await patientService.updateImageNotes(imageId, {
      doctor_notes,
      doctor_notes_visibility
    }, req.token);

    return sendResponse(res, 200, 'Doctor notes updated successfully.', { image: updatedImage });
  } catch (error) {
    next(error);
  }
};
