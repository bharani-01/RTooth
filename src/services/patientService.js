import { supabase } from '../config/supabase.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

/**
 * Resolves a patient ID (internal UUID) from either a UUID or a patient code (e.g. PAT-10001).
 */
export const getPatientIdByIdOrCode = async (idOrCode) => {
  if (!idOrCode) throw new BadRequestError('No patient identifier provided.');
  
  // Standard UUID format regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(idOrCode)) {
    return idOrCode;
  }

  // Look up by custom patient_code
  const { data, error } = await supabase
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
export const getPatientProfileById = async (patientIdOrCode) => {
  const patientId = await getPatientIdByIdOrCode(patientIdOrCode);

  // 1. Fetch base profile fields
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== 'patient') {
    throw new NotFoundError('Patient profile not found.');
  }

  // 2. Fetch patient demographic specifics
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) throw patientError;
  const patData = patient || {};

  // 3. Fetch lifestyle habits
  const { data: habits, error: habitsError } = await supabase
    .from('lifestyle_habits')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (habitsError) throw habitsError;
  const habitsData = habits || {};

  // 4. Fetch medical records (clinical stage, lesion location, etc.)
  const { data: records, error: recordsError } = await supabase
    .from('medical_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (recordsError) throw recordsError;
  const latestRecord = records && records.length > 0 ? records[0] : {};

  // 5. Fetch attending doctor details
  let doctor = null;
  if (patData.doctor_id) {
    const { data: docProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patData.doctor_id)
      .maybeSingle();

    if (docProfile) {
      const { data: docDetails } = await supabase
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
  const { data: medications, error: medicationsError } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (medicationsError) throw medicationsError;

  // 7. Fetch checkups
  const { data: checkups, error: checkupsError } = await supabase
    .from('checkups')
    .select('*')
    .eq('patient_id', patientId)
    .order('checkup_date', { ascending: false });

  if (checkupsError) throw checkupsError;

  // Resolve doctor details for each checkup
  const resolvedCheckups = [];
  if (checkups && checkups.length > 0) {
    // Collect all doctor IDs
    const docIds = [...new Set(checkups.map(c => c.doctor_id).filter(id => id != null))];
    let docMap = new Map();
    
    if (docIds.length > 0) {
      const { data: docProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', docIds);
        
      if (docProfiles) {
        docMap = new Map(docProfiles.map(d => [d.id, d]));
      }
    }
    
    for (const c of checkups) {
      const doc = c.doctor_id ? docMap.get(c.doctor_id) : null;
      resolvedCheckups.push({
        ...c,
        doctor_name: doc ? `Dr. ${doc.first_name} ${doc.last_name}` : 'Unknown Doctor'
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
    checkups: resolvedCheckups
  };
};

/**
 * Add a medication record for a patient.
 */
export const createMedication = async (patientId, medData) => {
  const { data, error } = await supabase
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
export const createCheckup = async (patientId, doctorId, checkupData) => {
  const { data, error } = await supabase
    .from('checkups')
    .insert([
      {
        patient_id: patientId,
        doctor_id: doctorId,
        findings: checkupData.findings,
        notes: checkupData.notes || null,
        recommendations: checkupData.recommendations || null,
        checkup_date: checkupData.checkup_date || new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};
