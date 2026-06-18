import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data } = await supabaseAdmin
  .from('patient_reports')
  .select('file_name, report_type, patient_id, profiles!patient_reports_patient_id_fkey(first_name, last_name, email)')
  .order('uploaded_at', { ascending: false })
  .limit(20);

console.log(`\nTotal reports found: ${data?.length}`);
data?.forEach(r => {
  const p = r.profiles;
  console.log(`  [${r.report_type}] ${r.file_name}`);
  console.log(`         → Patient: ${p?.first_name} ${p?.last_name} (${p?.email})`);
});
