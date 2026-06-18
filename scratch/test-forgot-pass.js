import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testForgot() {
  console.log("Triggering resetPasswordForEmail for admin@rtooth.in...");
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail('admin@rtooth.in', {
      redirectTo: 'http://localhost:5000/reset_password.html'
    });
    if (error) {
      console.error("Supabase error:", error);
    } else {
      console.log("Success! Data:", data);
    }
  } catch (err) {
    console.error("Exception:", err);
  }
}

testForgot();
