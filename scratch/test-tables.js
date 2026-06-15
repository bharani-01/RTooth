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

async function runTest() {
  console.log("Checking medications table...");
  const { data: meds, error: medsError } = await supabaseAdmin.from('medications').select('*').limit(1);
  if (medsError) {
    console.error("Error reading medications:", medsError.message);
  } else {
    console.log("medications table exists! Sample data:", meds);
  }

  console.log("Checking checkups table...");
  const { data: checkups, error: checkupsError } = await supabaseAdmin.from('checkups').select('*').limit(1);
  if (checkupsError) {
    console.error("Error reading checkups:", checkupsError.message);
  } else {
    console.log("checkups table exists! Sample data:", checkups);
  }
}

runTest();
