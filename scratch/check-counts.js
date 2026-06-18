import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function checkCounts() {
  const { count: checkups } = await supabaseAdmin.from('checkups').select('*', { count: 'exact', head: true });
  const { count: patients } = await supabaseAdmin.from('patients').select('*', { count: 'exact', head: true });
  const { count: doctors } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor');
  const { count: reports } = await supabaseAdmin.from('patient_reports').select('*', { count: 'exact', head: true });
  console.log(`Doctors: ${doctors}`);
  console.log(`Patients: ${patients}`);
  console.log(`Checkups: ${checkups}`);
  console.log(`Reports: ${reports}`);
}

checkCounts();
