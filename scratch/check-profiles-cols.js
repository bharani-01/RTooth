import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function checkProfiles() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Checking profiles columns...");
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Profile keys:", data.length > 0 ? Object.keys(data[0]) : "No profiles found");
    console.log("First profile data:", data[0]);
  }
}

checkProfiles();
