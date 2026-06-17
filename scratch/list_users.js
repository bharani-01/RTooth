import { supabase } from '../src/config/supabase.js';

async function listUsers() {
  console.log('Fetching profiles...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, first_name, last_name');

  if (error) {
    console.error('Error fetching profiles:', error.message);
    return;
  }

  console.log('Profiles in Database:');
  console.table(profiles);

  console.log('\nFetching patients...');
  const { data: patients, error: patError } = await supabase
    .from('patients')
    .select('id, patient_code, status');

  if (patError) {
    console.error('Error fetching patients:', patError.message);
    return;
  }

  console.log('Patients in Database:');
  console.table(patients);
}

listUsers();
