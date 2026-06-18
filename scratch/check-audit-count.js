import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.AUDIT_LOG_SUPABASE_URL,
  process.env.AUDIT_LOG_SUPABASE_ANON_KEY
);

async function check() {
  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });
  
  if (error) console.error(error);
  else console.log('Total audit logs in DB:', count);
}
check();
