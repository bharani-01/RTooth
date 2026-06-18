import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log("Triggering resetPasswordForEmail...");
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail('test-error@rtooth.in', {
      redirectTo: 'http://localhost:5000/reset_password.html'
    });
    if (error) {
      console.log("\n--- Supabase Auth Error Details ---");
      console.log("name:", error.name);
      console.log("message type:", typeof error.message);
      console.log("message:", error.message);
      console.log("status:", error.status);
      console.log("JSON:", JSON.stringify(error));
      console.log("Keys:", Object.keys(error));
      console.log("Full error object:", error);
    } else {
      console.log("No error returned, data:", data);
    }
  } catch (err) {
    console.error("Caught exception:", err);
  }
}
run();
