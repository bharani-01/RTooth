import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  // Find any banned users in Auth
  console.log("Checking all users in Supabase Auth...");
  let found = false;
  users.forEach(u => {
    if (u.banned_until) {
      console.log(`Banned User: ${u.email}`);
      console.log(`- ID: ${u.id}`);
      console.log(`- Banned Until: ${u.banned_until}`);
      found = true;
    }
  });
  if (!found) {
    console.log("No users have a banned_until timestamp in Supabase Auth.");
  }
  
  // Also check database profiles where status is not active
  console.log("\nChecking database profiles status...");
  const { data: profiles, error: pError } = await supabaseAdmin.from('profiles').select('id, email, role, status');
  if (pError) {
    console.error("Profiles query error:", pError.message);
  } else {
    const nonActive = profiles.filter(p => p.status && p.status !== 'active');
    console.log(`Found ${nonActive.length} non-active profiles in DB:`);
    nonActive.forEach(p => {
      console.log(`- ${p.email} (${p.id}): status = ${p.status}`);
    });
  }
}

run();
