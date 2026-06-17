import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function checkDb() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Checking profiles table...");
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log(profiles);

  console.log("Checking patients table...");
  const { data: patients } = await supabase.from('patients').select('*');
  console.log(patients);

  console.log("Checking checkups table...");
  const { data: checkups } = await supabase.from('checkups').select('*');
  console.log(checkups);
}

checkDb();
