import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function findPatient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', '56ba4e2d-7e83-459d-be77-bf7cab0e26ad').maybeSingle();
  console.log("Profile:", profile);

  const { data: patient } = await supabase.from('patients').select('*').eq('id', '56ba4e2d-7e83-459d-be77-bf7cab0e26ad').maybeSingle();
  console.log("Patient:", patient);
}

findPatient();
