import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function fetchSampleUsers() {
  // Fetch 5 seeded doctors
  const { data: doctors } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('role', 'doctor')
    .like('email', 'seeded_doc_%')
    .limit(5);

  // Fetch 5 active seeded patients
  const { data: activePatients } = await supabaseAdmin
    .from('patients')
    .select('id, status')
    .eq('status', 'active')
    .limit(5);

  let patients = [];
  if (activePatients?.length) {
    const ids = activePatients.map(p => p.id);
    const { data: patProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', ids);
    patients = patProfiles || [];
  }

  console.log('\n=== SEEDED DOCTORS ===');
  doctors?.forEach(d => console.log(`  ${d.first_name} ${d.last_name} | ${d.email} | DoctorPassword123`));

  console.log('\n=== SEEDED PATIENTS (active) ===');
  patients?.forEach(p => console.log(`  ${p.first_name} ${p.last_name} | ${p.email} | PatientPassword123`));
}

fetchSampleUsers();
