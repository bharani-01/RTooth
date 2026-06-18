import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testListDoctors() {
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'doctor')
    .order('last_name', { ascending: true });

  if (profilesError) {
    console.error(profilesError);
    return;
  }

  const docIds = profiles.map(p => p.id);
  const { data: doctors, error: docError } = await supabaseAdmin
    .from('doctors')
    .select('*')
    .in('id', docIds);

  if (docError) {
    console.error(docError);
    return;
  }

  // 1. Fetch patient counts per doctor
  const { data: patients, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('id, doctor_id');
  
  if (patientError) {
    console.error(patientError);
    return;
  }

  // 2. Fetch precise file sizes per doctor
  const { data: reports, error: reportsError } = await supabaseAdmin
    .from('patient_reports')
    .select('patient_id, doctor_id, file_url');
  
  if (reportsError) {
    console.error(reportsError);
    return;
  }

  console.log(`Reports length: ${reports?.length}`);
  if (reports && reports.length > 0) {
    console.log('Sample file_url:', reports[0].file_url);

    // Collect all unique patient folders
    const patientFilesMap = new Map();
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) {
        console.log(`Failed to split file_url: ${r.file_url}`);
        return;
      }
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) {
        console.log(`Failed to split pathAndName: ${pathAndName}`);
        return;
      }
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      if (!patientFilesMap.has(pid)) {
        patientFilesMap.set(pid, new Set());
      }
      patientFilesMap.get(pid).add(fileName);
    });

    const patientIds = Array.from(patientFilesMap.keys());
    console.log(`Unique patient IDs with files:`, patientIds);
    
    const listPromises = patientIds.map(pid => 
      supabaseAdmin.storage.from('patient-reports').list(pid)
    );
    
    const listResults = await Promise.all(listPromises);
    console.log(`Storage listing results counts:`, listResults.map(r => r.data?.length || 0));

    // Map filename to size for each patient
    const fileSizeMap = new Map(); // "patient_id/filename" -> size
    patientIds.forEach((pid, index) => {
      const res = listResults[index];
      const allowedNames = patientFilesMap.get(pid);
      if (res.data) {
        res.data.forEach(file => {
          if (allowedNames.has(file.name) && file.metadata && file.metadata.size) {
            fileSizeMap.set(`${pid}/${file.name}`, file.metadata.size);
          } else {
            console.log(`Skip file: ${file.name} (allowed: ${allowedNames.has(file.name)}, size: ${file.metadata?.size})`);
          }
        });
      }
    });

    console.log(`fileSizeMap size: ${fileSizeMap.size}`);
    
    // Sum sizes per doctor
    const doctorSizeMap = new Map();
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      const size = fileSizeMap.get(`${pid}/${fileName}`) || 0;
      console.log(`Report file ${fileName} size resolved to: ${size}`);
      if (r.doctor_id) {
        doctorSizeMap.set(r.doctor_id, (doctorSizeMap.get(r.doctor_id) || 0) + size);
      }
    });

    const totalStorage = Array.from(doctorSizeMap.values()).reduce((a, b) => a + b, 0);
    console.log(`Total calculated storage: ${totalStorage} bytes`);
  }
}

testListDoctors();
