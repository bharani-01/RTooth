import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function seedAdmin() {
  const email = "admin@rtooth.in";
  const password = "AdminPassword123";
  const firstName = "IT";
  const lastName = "Admin";

  console.log(`Attempting to seed default IT-Admin account: ${email}...`);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: 'admin'
    }
  });

  if (authError) {
    if (authError.message.includes("already has been registered") || authError.message.includes("already exists")) {
      console.log("IT-Admin auth account already exists. Verifying profile record...");
    } else {
      console.error("Auth creation failed:", authError.message);
      return;
    }
  }

  const userId = authData.user?.id || (await getUserIdByEmail(email));
  if (!userId) {
    console.error("Failed to retrieve or create User ID.");
    return;
  }

  // 2. Create profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email,
      role: 'admin',
      first_name: firstName,
      last_name: lastName,
      phone: '9999999999'
    });

  if (profileError) {
    console.error("Database profile insertion failed:", profileError.message);
  } else {
    console.log("==================================================");
    console.log("IT-Admin seeded successfully!");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("==================================================");
  }
}

async function getUserIdByEmail(email) {
  // Try getting from auth
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  if (listData) {
    const user = listData.users.find(u => u.email === email);
    return user?.id;
  }
  return null;
}

seedAdmin();
