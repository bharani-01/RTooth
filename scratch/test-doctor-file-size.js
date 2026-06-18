import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function calculateDoctorFilesSize(doctorId) {
  // 1. Get all patient IDs assigned to this doctor
  const { data: patients, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('doctor_id', doctorId);
  
  if (patientError) {
    throw patientError;
  }
  
  if (!patients || patients.length === 0) {
    return { count: 0, sizeBytes: 0 };
  }
  
  const patientIds = patients.map(p => p.id);
  
  // 2. Fetch storage file lists for all these patients in parallel
  const listPromises = patientIds.map(pid => 
    supabaseAdmin.storage.from('patient-reports').list(pid)
  );
  
  const results = await Promise.all(listPromises);
  
  let totalSize = 0;
  let fileCount = 0;
  
  results.forEach(res => {
    if (res.error) {
      console.warn("Storage list warning:", res.error.message);
      return;
    }
    if (res.data) {
      res.data.forEach(file => {
        // Skip placeholders or folders if any
        if (file.metadata && file.metadata.size) {
          totalSize += file.metadata.size;
          fileCount++;
        }
      });
    }
  });
  
  return { count: fileCount, sizeBytes: totalSize };
}

async function main() {
  // Fetch a doctor to test
  const { data: docs } = await supabaseAdmin.from('doctors').select('id').limit(1);
  if (docs && docs.length > 0) {
    const docId = docs[0].id;
    console.log(`Calculating files size for doctor ${docId}...`);
    const stats = await calculateDoctorFilesSize(docId);
    console.log("Stats:", stats);
  } else {
    console.log("No doctors found to test.");
  }
}

main();
