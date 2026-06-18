import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const email = "seeded_pat_9@rtooth.in";
  console.log(`Checking account: ${email}...`);

  // 1. Check in Auth
  // 1. Check in DB profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error("Profile query error:", profileError);
    return;
  }

  if (!profile) {
    console.log("DB Profile not found by email.");
    return;
  }

  console.log("DB Profile found:");
  console.log(profile);

  // 2. Check in Auth
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (authError) {
    console.error("Auth query error:", authError);
    return;
  }

  if (authUser) {
    console.log("Auth user found:");
    console.log(`- ID: ${authUser.id}`);
    console.log(`- Banned Until: ${authUser.banned_until}`);
    console.log(`- Metadata:`, authUser.user_metadata);
  } else {
    console.log("Auth user not found by ID.");
  }
}

run();
