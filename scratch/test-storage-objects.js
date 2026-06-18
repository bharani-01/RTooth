import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'storage' }
});

async function main() {
  const { data, error } = await supabaseAdmin
    .from('objects')
    .select('name, metadata')
    .eq('bucket_id', 'patient-reports')
    .limit(10);
  
  if (error) {
    console.error("Error fetching storage schema objects:", error.message);
  } else {
    console.log("Successfully fetched storage objects:", data);
  }
}

main();
