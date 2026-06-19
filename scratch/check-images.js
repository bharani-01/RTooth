import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function checkImages() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Checking profiles...");
  const { data: profiles, error: errProf } = await supabase.from('profiles').select('id, email, first_name, last_name, role');
  if (errProf) console.error("Profile query error:", errProf);
  console.log(profiles);

  console.log("\nChecking patient_images...");
  const { data: images, error: errImages } = await supabase.from('patient_images').select('*');
  if (errImages) console.error("Images query error:", errImages);
  console.log(images);
}

checkImages();
