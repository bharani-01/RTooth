import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  const { data, error } = await supabaseAdmin.from('patients').select('*').limit(1);
  if (error) {
    console.error("Error fetching patients:", error.message);
  } else {
    console.log("Patients columns and sample row:", data);
  }
}

run();
