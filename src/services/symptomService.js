import { supabase, supabaseAdmin, getSupabaseUserClient } from '../config/supabase.js';
import * as emailService from './emailService.js';

const getClient = (token) => token ? getSupabaseUserClient(token) : (supabaseAdmin || supabase);

/**
 * Log symptoms for a patient
 */
export const createSymptomLog = async (patientId, data, token) => {
  const { burning_sensation, pain_scale, difficulty_opening_mouth, ulcer_duration, bleeding } = data;
  const dbClient = getClient(token);

  const { data: log, error } = await dbClient
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

  // Run email dispatch asynchronously to avoid blocking the client request
  (async () => {
    try {
      // 1. Fetch patient code and assigned doctor_id
      const { data: patientData } = await dbClient
        .from('patients')
        .select('doctor_id, patient_code')
        .eq('id', patientId)
        .single();

      if (patientData && patientData.doctor_id) {
        // 2. Fetch doctor profile details (name and email)
        const { data: docProfile } = await dbClient
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', patientData.doctor_id)
          .single();

        // 3. Fetch patient profile details (name)
        const { data: patProfile } = await dbClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', patientId)
          .single();

        if (docProfile && docProfile.email) {
          const doctorName = `${docProfile.first_name} ${docProfile.last_name}`;
          const patientName = patProfile ? `${patProfile.first_name} ${patProfile.last_name}` : 'A Patient';

          await emailService.sendSymptomNotificationEmail({
            doctorEmail: docProfile.email,
            doctorName,
            patientName,
            patientCode: patientData.patient_code,
            symptoms: log
          });
        }
      }
    } catch (emailErr) {
      console.error('[SYMPTOM EMAIL NOTIFICATION ERROR]', emailErr.message);
    }
  })();

  return log;
};

/**
 * Fetch past symptom logs for a patient
 */
export const getSymptomLogsByPatientId = async (patientId, token) => {
  const dbClient = getClient(token);
  const { data: logs, error } = await dbClient
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
export const getRecentSymptomLogs = async (doctorId, token) => {
  const dbClient = getClient(token);
  let patientsQuery = dbClient.from('patients').select('id, patient_code');
  if (doctorId) {
    patientsQuery = patientsQuery.eq('doctor_id', doctorId);
  }
  const { data: patients, error: patientError } = await patientsQuery;
  if (patientError) throw patientError;
  if (!patients || patients.length === 0) return [];
  const patientIds = patients.map(p => p.id);
  const patientCodeMap = new Map(patients.map(p => [p.id, p.patient_code]));

  const { data: profiles, error: profileError } = await dbClient
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', patientIds);
  if (profileError) throw profileError;
  const nameMap = new Map(profiles.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

  const { data: logs, error: logsError } = await dbClient
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
