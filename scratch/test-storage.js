import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testStorage() {
  const { data: reports, error: dbError } = await supabaseAdmin
    .from('patient_reports')
    .select('patient_id, file_url')
    .limit(5);

  if (dbError) {
    console.error('DB Error:', dbError);
    return;
  }

  console.log(`Found ${reports?.length} report records.`);
  if (!reports || reports.length === 0) return;

  const patientId = reports[0].patient_id;
  console.log(`Listing files for patient ID: ${patientId}`);
  
  const { data: files, error: storageError } = await supabaseAdmin
    .storage
    .from('patient-reports')
    .list(patientId);

  if (storageError) {
    console.error('Storage Error:', storageError);
  } else {
    console.log(`Found ${files?.length} files in storage for this patient.`);
    console.log(files);
  }
}

testStorage();
