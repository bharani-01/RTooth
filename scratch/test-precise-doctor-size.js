import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function calculatePreciseDoctorFilesSize(doctorId) {
  // 1. Get all reports uploaded by this doctor
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('patient_reports')
    .select('patient_id, file_url')
    .eq('doctor_id', doctorId);
  
  if (reportsError) {
    throw reportsError;
  }
  
  if (!reports || reports.length === 0) {
    return { count: 0, sizeBytes: 0 };
  }
  
  // Group files by patient_id
  const patientFilesMap = new Map();
  reports.forEach(r => {
    // Extract storage file name from file_url
    // URL format: .../patient-reports/patientId/uniqueFileName
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
  
  // 2. Fetch storage file lists for all unique patient folders in parallel
  const patientIds = Array.from(patientFilesMap.keys());
  const listPromises = patientIds.map(pid => 
    supabaseAdmin.storage.from('patient-reports').list(pid)
  );
  
  const results = await Promise.all(listPromises);
  
  let totalSize = 0;
  let fileCount = 0;
  
  patientIds.forEach((pid, index) => {
    const res = results[index];
    if (res.error) {
      console.warn(`Storage list warning for patient ${pid}:`, res.error.message);
      return;
    }
    const allowedFileNames = patientFilesMap.get(pid);
    if (res.data) {
      res.data.forEach(file => {
        if (allowedFileNames.has(file.name) && file.metadata && file.metadata.size) {
          totalSize += file.metadata.size;
          fileCount++;
        }
      });
    }
  });
  
  return { count: fileCount, sizeBytes: totalSize };
}

async function main() {
  const { data: docs } = await supabaseAdmin.from('doctors').select('id').limit(1);
  if (docs && docs.length > 0) {
    const docId = docs[0].id;
    console.log(`Calculating precise files size for doctor ${docId}...`);
    const stats = await calculatePreciseDoctorFilesSize(docId);
    console.log("Precise Stats:", stats);
  } else {
    console.log("No doctors found.");
  }
}

main();
