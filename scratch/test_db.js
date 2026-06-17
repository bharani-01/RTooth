import { supabase } from '../src/config/supabase.js';

async function checkDatabase() {
  console.log('Checking database table patient_reports...');
  const { data, error } = await supabase
    .from('patient_reports')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Error querying patient_reports table:', error.message);
    if (error.message.includes('relation "public.patient_reports" does not exist')) {
      console.log('STATUS: The SQL migration in db_update.sql has NOT been run yet.');
    } else {
      console.log('STATUS: Error encountered:', error);
    }
  } else {
    console.log('STATUS: The patient_reports table exists. SQL migration is already applied!');
  }

  console.log('\nChecking medications checkup_id column...');
  const { data: medData, error: medError } = await supabase
    .from('medications')
    .select('checkup_id')
    .limit(1);

  if (medError) {
    console.error('Error querying medications checkup_id:', medError.message);
    if (medError.message.includes('column "checkup_id" does not exist')) {
      console.log('STATUS: medications table alteration is NOT applied.');
    } else {
      console.log('STATUS: Error encountered:', medError);
    }
  } else {
    console.log('STATUS: medications checkup_id column exists. SQL migration is already applied!');
  }
}

checkDatabase();
