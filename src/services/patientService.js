import { supabase as baseSupabase, supabaseAdmin, getSupabaseUserClient } from '../config/supabase.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as emailService from './emailService.js';

const getClient = (token) => token ? getSupabaseUserClient(token) : (supabaseAdmin || baseSupabase);

/**
 * Resolves a patient ID (internal UUID) from either a UUID or a patient code (e.g. PAT-10001).
 */
export const getPatientIdByIdOrCode = async (idOrCode, token) => {
  if (!idOrCode) throw new BadRequestError('No patient identifier provided.');
  
  // Standard UUID format regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(idOrCode)) {
    return idOrCode;
  }

  // Look up by custom patient_code
  const client = getClient(token);
  const { data, error } = await client
    .from('patients')
    .select('id')
    .eq('patient_code', idOrCode)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundError(`Patient not found with identifier: ${idOrCode}`);
  }

  return data.id;
};

/**
 * Fetch patient profile details (demographics, habits, records, checkups, medications) by Patient ID or Patient Code.
 */
export const getPatientProfileById = async (patientIdOrCode, token) => {
  const patientId = await getPatientIdByIdOrCode(patientIdOrCode, token);
  const client = getClient(token);

  // 1. Fetch base profile fields
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== 'patient') {
    throw new NotFoundError('Patient profile not found.');
  }

  // 2. Fetch patient demographic specifics
  const { data: patient, error: patientError } = await client
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) throw patientError;
  const patData = patient || {};

  // 3. Fetch lifestyle habits
  const { data: habits, error: habitsError } = await client
    .from('lifestyle_habits')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (habitsError) throw habitsError;
  const habitsData = habits || {};

  // 4. Fetch medical records (clinical stage, lesion location, etc.)
  const { data: records, error: recordsError } = await client
    .from('medical_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (recordsError) throw recordsError;
  const latestRecord = records && records.length > 0 ? records[0] : {};

  // 5. Fetch attending doctor details
  let doctor = null;
  if (patData.doctor_id) {
    const { data: docProfile } = await client
      .from('profiles')
      .select('*')
      .eq('id', patData.doctor_id)
      .maybeSingle();

    if (docProfile) {
      const { data: docDetails } = await client
        .from('doctors')
        .select('*')
        .eq('id', patData.doctor_id)
        .maybeSingle();

      doctor = {
        id: patData.doctor_id,
        first_name: docProfile.first_name,
        last_name: docProfile.last_name,
        specialization: docDetails?.specialization || 'Oncologist'
      };
    }
  }

  // 6. Fetch medications
  const { data: medications, error: medicationsError } = await client
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (medicationsError) throw medicationsError;

  // 7. Fetch patient reports
  const { data: reports, error: reportsError } = await client
    .from('patient_reports')
    .select('*')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false });

  if (reportsError) throw reportsError;

  // 8. Fetch checkups
  const { data: checkups, error: checkupsError } = await client
    .from('checkups')
    .select('*')
    .eq('patient_id', patientId)
    .order('checkup_date', { ascending: false });

  if (checkupsError) throw checkupsError;

  // Resolve doctor details, prescriptions, and reports for each checkup
  const resolvedCheckups = [];
  if (checkups && checkups.length > 0) {
    // Collect all doctor IDs
    const docIds = [...new Set(checkups.map(c => c.doctor_id).filter(id => id != null))];
    let docMap = new Map();
    
    if (docIds.length > 0) {
      const { data: docProfiles } = await client
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', docIds);
        
      if (docProfiles) {
        docMap = new Map(docProfiles.map(d => [d.id, d]));
      }
    }
    
    for (const c of checkups) {
      const doc = c.doctor_id ? docMap.get(c.doctor_id) : null;
      const checkupMeds = medications ? medications.filter(m => m.checkup_id === c.id) : [];
      const checkupReports = reports ? reports.filter(r => r.checkup_id === c.id) : [];

      resolvedCheckups.push({
        ...c,
        doctor_name: doc ? `Dr. ${doc.first_name} ${doc.last_name}` : 'Unknown Doctor',
        prescriptions: checkupMeds,
        reports: checkupReports
      });
    }
  }

  return {
    id: profile.id,
    patient_code: patData.patient_code,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    
    date_of_birth: patData.date_of_birth,
    gender: patData.gender,
    address: patData.address,
    doctor_id: patData.doctor_id,
    status: patData.status || 'active',
    doctor,

    tobacco_habit: habitsData.tobacco_habit,
    tobacco_frequency: habitsData.tobacco_frequency,
    tobacco_duration: habitsData.tobacco_duration,
    alcohol_habit: habitsData.alcohol_habit,
    alcohol_frequency: habitsData.alcohol_frequency,
    alcohol_duration: habitsData.alcohol_duration,
    betel_nut: habitsData.betel_nut,
    family_history: habitsData.family_history,
    
    cancer_stage: latestRecord.cancer_stage,
    lesion_location: latestRecord.lesion_location,
    risk_factors: latestRecord.risk_factors,

    medications: medications || [],
    checkups: resolvedCheckups,
    reports: reports || []
  };
};

/**
 * Add a medication record for a patient.
 */
export const createMedication = async (patientId, medData, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('medications')
    .insert([
      {
        patient_id: patientId,
        medication_name: medData.medication_name,
        dosage: medData.dosage,
        frequency: medData.frequency,
        start_date: medData.start_date,
        end_date: medData.end_date || null
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Add a checkup record for a patient.
 */
export const createCheckup = async (patientId, doctorId, checkupData, token) => {
  const insertPayload = {
    patient_id: patientId,
    doctor_id: doctorId,
    findings: checkupData.findings,
    notes: checkupData.notes || null,
    recommendations: checkupData.recommendations || null,
    checkup_date: checkupData.checkup_date || new Date().toISOString(),
    next_checkup_date: checkupData.next_checkup_date || null,
    followup_interval: checkupData.followup_interval || null,
    followup_notes: checkupData.followup_notes || null
  };

  if (checkupData.id) {
    insertPayload.id = checkupData.id;
  }

  const client = getClient(token);
  const { data, error } = await client
    .from('checkups')
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update patient status (e.g. draft -> active)
 */
export const updatePatientStatus = async (patientId, status, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('patients')
    .update({ status })
    .eq('id', patientId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update patient profile details (demographics, habits, medical records)
 */
export const updatePatientProfile = async (patientId, updateData, token) => {
  const client = getClient(token);

  // 1. Update profiles table
  const { error: profileError } = await client
    .from('profiles')
    .update({
      first_name: updateData.firstName,
      last_name: updateData.lastName,
      phone: updateData.phone || null
    })
    .eq('id', patientId);

  if (profileError) throw profileError;

  // 2. Update patients table
  const { error: patientError } = await client
    .from('patients')
    .update({
      date_of_birth: updateData.dateOfBirth || null,
      gender: updateData.gender || 'Not Specified',
      address: updateData.address || null,
      status: updateData.status // active or draft
    })
    .eq('id', patientId);

  if (patientError) throw patientError;

  // 3. Update lifestyle_habits table
  const { error: habitsError } = await client
    .from('lifestyle_habits')
    .update({
      tobacco_habit: updateData.tobaccoHabit || 'none',
      tobacco_frequency: updateData.tobaccoFrequency || null,
      tobacco_duration: updateData.tobaccoDuration || null,
      alcohol_habit: updateData.alcoholHabit || 'none',
      alcohol_frequency: updateData.alcoholFrequency || null,
      alcohol_duration: updateData.alcoholDuration || null,
      betel_nut: updateData.betelNut || 'no',
      family_history: updateData.familyHistory || 'no'
    })
    .eq('patient_id', patientId);

  if (habitsError) throw habitsError;

  // 4. Update or Insert medical records
  const { data: records, error: getRecError } = await client
    .from('medical_records')
    .select('id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (getRecError) throw getRecError;

  if (records && records.length > 0) {
    const latestRecordId = records[0].id;
    const { error: recordUpdateError } = await client
      .from('medical_records')
      .update({
        cancer_stage: updateData.cancerStage || 'Suspicious Lesion',
        lesion_location: updateData.lesionLocation || 'Not Specified',
        risk_factors: updateData.riskFactors || null
      })
      .eq('id', latestRecordId);

    if (recordUpdateError) throw recordUpdateError;
  } else {
    const { error: recordInsertError } = await client
      .from('medical_records')
      .insert([
        {
          patient_id: patientId,
          cancer_stage: updateData.cancerStage || 'Suspicious Lesion',
          lesion_location: updateData.lesionLocation || 'Not Specified',
          risk_factors: updateData.riskFactors || null
        }
      ]);

    if (recordInsertError) throw recordInsertError;
  }

  // Get full updated profile
  return getPatientProfileById(patientId, token);
};

/**
 * Create a complete patient visit record (checkup + medications + uploaded reports)
 */
export const createVisit = async (patientId, doctorId, visitData, token) => {
  const client = getClient(token);

  // 1. Create the checkup (visit header)
  const checkup = await createCheckup(patientId, doctorId, {
    id: visitData.id || null,
    findings: visitData.findings,
    notes: visitData.notes,
    recommendations: visitData.recommendations,
    checkup_date: visitData.checkup_date,
    next_checkup_date: visitData.next_checkup_date,
    followup_interval: visitData.followup_interval,
    followup_notes: visitData.followup_notes
  }, token);

  const checkupId = checkup.id;

  // 2. Add medications (prescriptions) linked to this checkup
  const prescriptions = [];
  if (visitData.prescriptions && visitData.prescriptions.length > 0) {
    for (const med of visitData.prescriptions) {
      const { data: medData, error: medError } = await client
        .from('medications')
        .insert([
          {
            patient_id: patientId,
            medication_name: med.medication_name,
            dosage: med.dosage,
            frequency: med.frequency,
            start_date: med.start_date || new Date().toISOString().split('T')[0],
            end_date: med.end_date || null,
            checkup_id: checkupId
          }
        ])
        .select()
        .single();

      if (medError) throw medError;
      prescriptions.push(medData);
    }
  }

  // 3. Add report metadata linked to this checkup
  const reports = [];
  if (visitData.reports && visitData.reports.length > 0) {
    for (const rep of visitData.reports) {
      const { data: repData, error: repError } = await client
        .from('patient_reports')
        .insert([
          {
            patient_id: patientId,
            doctor_id: doctorId,
            checkup_id: checkupId,
            report_type: rep.report_type,
            file_name: rep.file_name,
            file_url: rep.file_url
          }
        ])
        .select()
        .single();

      if (repError) throw repError;
      reports.push(repData);
    }
  }

  // Asynchronously dispatch clinical visit email notification to the patient
  (async () => {
    try {
      // 1. Fetch patient profile details (name and email)
      const { data: patProfile } = await client
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', patientId)
        .single();

      // 2. Fetch doctor profile details (name)
      const { data: docProfile } = await client
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', doctorId)
        .single();

      if (patProfile && patProfile.email) {
        const patientName = `${patProfile.first_name} ${patProfile.last_name}`;
        const doctorName = docProfile ? `${docProfile.first_name} ${docProfile.last_name}` : 'RTooth Specialist';

        await emailService.sendVisitSummaryEmail({
          patientEmail: patProfile.email,
          patientName,
          doctorName,
          checkup,
          prescriptions
        });
      }
    } catch (emailErr) {
      console.error('[VISIT EMAIL SUMMARY ERROR]', emailErr.message);
    }
  })();

  return {
    checkup,
    prescriptions,
    reports
  };
};

/**
 * Retrieve a specific visit details including nested prescriptions, reports, patient demographics and oncologist details
 */
export const getVisitDetails = async (patientId, visitId, token) => {
  const client = getClient(token);

  // 1. Fetch the checkup record
  const { data: checkup, error: checkupError } = await client
    .from('checkups')
    .select('*')
    .eq('id', visitId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (checkupError) throw checkupError;
  if (!checkup) {
    throw new NotFoundError('Clinical visit record not found.');
  }

  // 2. Fetch doctor profile details
  let doctorName = 'Unknown Doctor';
  let doctorSpecialization = 'Oncologist';
  if (checkup.doctor_id) {
    const { data: docProfile } = await client
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', checkup.doctor_id)
      .maybeSingle();
    
    if (docProfile) {
      doctorName = `Dr. ${docProfile.first_name} ${docProfile.last_name}`;
    }

    const { data: docDetails } = await client
      .from('doctors')
      .select('specialization')
      .eq('id', checkup.doctor_id)
      .maybeSingle();
    
    if (docDetails?.specialization) {
      doctorSpecialization = docDetails.specialization;
    }
  }

  // 3. Fetch patient demographics
  const { data: patProfile, error: patProfileError } = await client
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', patientId)
    .maybeSingle();

  if (patProfileError) throw patProfileError;

  const { data: patDetails, error: patDetailsError } = await client
    .from('patients')
    .select('date_of_birth, gender')
    .eq('id', patientId)
    .maybeSingle();

  if (patDetailsError) throw patDetailsError;

  // 4. Fetch patient medical record oncology parameters
  const { data: records, error: recordsError } = await client
    .from('medical_records')
    .select('cancer_stage, lesion_location')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (recordsError) throw recordsError;
  const latestRecord = records && records.length > 0 ? records[0] : {};

  // 5. Fetch prescriptions linked to this visit
  const { data: prescriptions, error: prescriptionsError } = await client
    .from('medications')
    .select('*')
    .eq('checkup_id', visitId)
    .order('created_at', { ascending: false });

  if (prescriptionsError) throw prescriptionsError;

  // 6. Fetch reports uploaded for this visit
  const { data: reports, error: reportsError } = await client
    .from('patient_reports')
    .select('*')
    .eq('checkup_id', visitId)
    .order('uploaded_at', { ascending: false });

  if (reportsError) throw reportsError;

  return {
    visit: {
      id: checkup.id,
      findings: checkup.findings,
      notes: checkup.notes,
      recommendations: checkup.recommendations,
      checkup_date: checkup.checkup_date,
      doctor_name: doctorName,
      doctor_specialization: doctorSpecialization,
      next_checkup_date: checkup.next_checkup_date,
      followup_interval: checkup.followup_interval,
      followup_notes: checkup.followup_notes
    },
    patient: {
      id: patientId,
      first_name: patProfile?.first_name || '',
      last_name: patProfile?.last_name || '',
      date_of_birth: patDetails?.date_of_birth || null,
      gender: patDetails?.gender || 'Not Specified',
      cancer_stage: latestRecord.cancer_stage || 'Suspicious Lesion',
      lesion_location: latestRecord.lesion_location || 'Not Specified'
    },
    prescriptions: prescriptions || [],
    reports: reports || []
  };
};

/**
 * Update an existing medication record
 */
export const updateMedication = async (medicationId, medData, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('medications')
    .update({
      medication_name: medData.medication_name,
      dosage: medData.dosage,
      frequency: medData.frequency,
      start_date: medData.start_date,
      end_date: medData.end_date || null
    })
    .eq('id', medicationId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a medication record
 */
export const deleteMedication = async (medicationId, token) => {
  const client = getClient(token);
  const { error } = await client
    .from('medications')
    .delete()
    .eq('id', medicationId);

  if (error) throw error;
  return true;
};

/**
 * Retrieve patient follow-up compliance list for a doctor or admin.
 */
export const getPatientsFollowupCompliance = async (doctorId, token) => {
  const client = getClient(token);

  // 1. Fetch active patients for the doctor (or all if doctorId is null for admin)
  let patientsQuery = client.from('patients').select('id, patient_code, status');
  if (doctorId) {
    patientsQuery = patientsQuery.eq('doctor_id', doctorId);
  }
  const { data: patients, error: patientsError } = await patientsQuery;
  if (patientsError) throw patientsError;

  // Filter to active patients only
  const activePatients = (patients || []).filter(p => p.status === 'active');
  if (activePatients.length === 0) return [];

  const patientIds = activePatients.map(p => p.id);

  // 2. Fetch profiles for these patients
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .in('id', patientIds);
  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // 3. Fetch all checkups for these patients ordered by checkup_date descending
  const { data: checkups, error: checkupsError } = await client
    .from('checkups')
    .select('id, patient_id, checkup_date, next_checkup_date, followup_interval, followup_notes')
    .in('patient_id', patientIds)
    .order('checkup_date', { ascending: false });
  if (checkupsError) throw checkupsError;

  // Group checkups by patient_id, keeping only the most recent checkup
  const latestCheckupMap = new Map();
  (checkups || []).forEach(c => {
    if (!latestCheckupMap.has(c.patient_id)) {
      latestCheckupMap.set(c.patient_id, c);
    }
  });

  // 4. Map patients and determine compliance status
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  return activePatients.map(p => {
    const profile = profileMap.get(p.id) || {};
    const latestCheckup = latestCheckupMap.get(p.id) || null;
    
    let nextCheckupDate = null;
    let followupInterval = null;
    let followupNotes = null;
    let lastVisitDate = null;
    let status = 'compliant'; // Default status is compliant if no upcoming scheduled check-up

    if (latestCheckup) {
      lastVisitDate = latestCheckup.checkup_date;
      nextCheckupDate = latestCheckup.next_checkup_date;
      followupInterval = latestCheckup.followup_interval;
      followupNotes = latestCheckup.followup_notes;

      if (nextCheckupDate) {
        const nextDate = new Date(nextCheckupDate);
        if (nextDate < now) {
          status = 'overdue';
        } else if (nextDate <= sevenDaysFromNow) {
          status = 'due_soon';
        } else {
          status = 'compliant';
        }
      }
    }

    return {
      patient_id: p.id,
      patient_code: p.patient_code,
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      last_visit_date: lastVisitDate,
      next_checkup_date: nextCheckupDate,
      followup_interval: followupInterval,
      followup_notes: followupNotes,
      status
    };
  });
};

/**
 * Save patient uploaded image metadata to database
 */
export const savePatientImageMetadata = async (patientId, imageData, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('patient_images')
    .insert([
      {
        patient_id: patientId,
        image_type: imageData.image_type,
        file_name: imageData.file_name,
        file_url: imageData.file_url,
        description: imageData.description || null
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetch patient uploaded images, sorted chronologically descending
 */
export const fetchPatientImages = async (patientId, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('patient_images')
    .select('*')
    .eq('patient_id', patientId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Update doctor notes and visibility for an image
 */
export const updateImageNotes = async (imageId, notesData, token) => {
  const client = getClient(token);
  const { data, error } = await client
    .from('patient_images')
    .update({
      doctor_notes: notesData.doctor_notes,
      doctor_notes_visibility: notesData.doctor_notes_visibility || 'public'
    })
    .eq('id', imageId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
