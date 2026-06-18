import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data, error } = await supabaseAdmin.from('patient_reports').select('*').limit(1);
  if (error) {
    console.error("Error fetching patient_reports:", error.message);
  } else {
    console.log("Successfully queried patient_reports. Columns are:", Object.keys(data[0] || {}));
  }
}

main();
