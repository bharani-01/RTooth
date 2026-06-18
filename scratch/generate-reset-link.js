import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function generate() {
  console.log("Generating recovery link for admin@rtooth.in...");
  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: 'admin@rtooth.in',
      options: {
        redirectTo: 'http://localhost:5000/reset_password.html'
      }
    });

    if (error) {
      console.error("Error generating link:", error);
    } else {
      console.log("\nSuccess! Link properties:");
      console.log(data);
      console.log("\nCopy and paste this URL into your browser to test the Reset Password page locally:");
      // Extract hash fragment containing access_token
      const actionLink = data.properties.action_link;
      const hashIndex = actionLink.indexOf('#');
      const hashParams = hashIndex !== -1 ? actionLink.substring(hashIndex + 1) : '';
      console.log(`http://localhost:5000/reset_password.html#${hashParams}`);
    }
  } catch (err) {
    console.error("Exception:", err);
  }
}

generate();
