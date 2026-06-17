import { supabase } from '../config/supabase.js';

/**
 * Log symptoms for a patient
 */
export const createSymptomLog = async (patientId, data) => {
  const { burning_sensation, pain_scale, difficulty_opening_mouth, ulcer_duration, bleeding } = data;

  const { data: log, error } = await supabase
    .from('symptom_logs')
    .insert([
      {
        patient_id: patientId,
        burning_sensation,
        pain_scale: parseInt(pain_scale, 10),
        difficulty_opening_mouth,
        ulcer_duration: parseInt(ulcer_duration, 10),
        bleeding: bleeding === true || bleeding === 'true'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return log;
};

/**
 * Fetch past symptom logs for a patient
 */
export const getSymptomLogsByPatientId = async (patientId) => {
  const { data: logs, error } = await supabase
    .from('symptom_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  return logs || [];
};

/**
 * Fetch recent symptom logs from patients (filtered by doctor if doctorId is provided)
 */
export const getRecentSymptomLogs = async (doctorId) => {
  let patientsQuery = supabase.from('patients').select('id, patient_code');
  if (doctorId) {
    patientsQuery = patientsQuery.eq('doctor_id', doctorId);
  }
  const { data: patients, error: patientError } = await patientsQuery;
  if (patientError) throw patientError;
  if (!patients || patients.length === 0) return [];
  const patientIds = patients.map(p => p.id);
  const patientCodeMap = new Map(patients.map(p => [p.id, p.patient_code]));

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', patientIds);
  if (profileError) throw profileError;
  const nameMap = new Map(profiles.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

  const { data: logs, error: logsError } = await supabase
    .from('symptom_logs')
    .select('*')
    .in('patient_id', patientIds)
    .order('logged_at', { ascending: false })
    .limit(20);
  if (logsError) throw logsError;

  return (logs || []).map(log => ({
    ...log,
    patient_name: nameMap.get(log.patient_id) || 'Unknown Patient',
    patient_code: patientCodeMap.get(log.patient_id) || 'N/A'
  }));
};

