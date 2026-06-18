import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function listDoctorsWithStats() {
  // 1. Fetch profiles of doctors
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'doctor')
    .order('last_name', { ascending: true });

  if (profilesError) throw profilesError;

  const docIds = profiles.map(p => p.id);
  const { data: doctors, error: docError } = await supabaseAdmin
    .from('doctors')
    .select('*')
    .in('id', docIds);

  if (docError) throw docError;

  const docMap = new Map((doctors || []).map(d => [d.id, d]));

  // 2. Fetch patient counts per doctor
  const { data: patients, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('id, doctor_id');
  
  if (patientError) throw patientError;
  
  const patientCountMap = new Map();
  (patients || []).forEach(p => {
    if (p.doctor_id) {
      patientCountMap.set(p.doctor_id, (patientCountMap.get(p.doctor_id) || 0) + 1);
    }
  });

  // 3. Fetch precise file sizes per doctor
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('patient_reports')
    .select('patient_id, doctor_id, file_url');
  
  if (reportsError) throw reportsError;
  
  const doctorSizeMap = new Map(); // doctor_id -> size in bytes
  
  if (reports && reports.length > 0) {
    // Collect all unique patient folders
    const patientFilesMap = new Map();
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      if (!patientFilesMap.has(pid)) {
        patientFilesMap.set(pid, new Set());
      }
      patientFilesMap.get(pid).add(fileName);
    });

    const patientIds = Array.from(patientFilesMap.keys());
    const listPromises = patientIds.map(pid => 
      supabaseAdmin.storage.from('patient-reports').list(pid)
    );
    
    const listResults = await Promise.all(listPromises);
    
    // Map filename to size for each patient
    const fileSizeMap = new Map(); // "patient_id/filename" -> size
    patientIds.forEach((pid, index) => {
      const res = listResults[index];
      if (res.error) {
        console.warn(`Storage list warning for patient ${pid}:`, res.error.message);
        return;
      }
      const allowedNames = patientFilesMap.get(pid);
      if (res.data) {
        res.data.forEach(file => {
          if (allowedNames.has(file.name) && file.metadata && file.metadata.size) {
            fileSizeMap.set(`${pid}/${file.name}`, file.metadata.size);
          }
        });
      }
    });

    // Sum sizes per doctor
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      const size = fileSizeMap.get(`${pid}/${fileName}`) || 0;
      if (r.doctor_id) {
        doctorSizeMap.set(r.doctor_id, (doctorSizeMap.get(r.doctor_id) || 0) + size);
      }
    });
  }

  // 4. Map final output
  return profiles.map(p => {
    const docData = docMap.get(p.id) || {};
    return {
      id: p.id,
      doctor_code: docData.doctor_code,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      specialization: docData.specialization || 'General Dentistry',
      license_number: docData.license_number || 'N/A',
      patient_count: patientCountMap.get(p.id) || 0,
      total_file_size_bytes: doctorSizeMap.get(p.id) || 0
    };
  });
}

async function main() {
  console.log("Fetching doctors with live patient counts and file sizes...");
  const docs = await listDoctorsWithStats();
  console.log("Result:", JSON.stringify(docs, null, 2));
}

main();
