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
  const res = await supabaseAdmin.auth.admin.listUsers();
  if (res.error) {
    console.error("Error listing users:", res.error.message);
  } else {
    console.log("Users in Supabase:");
    res.data.users.forEach(u => {
      console.log(`- ${u.email}: ${u.id}`);
    });
  }
}

runTest();
