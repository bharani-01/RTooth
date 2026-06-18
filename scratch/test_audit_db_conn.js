import { createClient } from '@supabase/supabase-js';

const url = "https://smwiswcyrkgrstiwiflc.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtd2lzd2N5cmtncnN0aXdpZmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzQ3NzksImV4cCI6MjA5NzExMDc3OX0.c4StqBhIOMhpfVTQO65o-HcIEZgoXn0zdDf1pYoxuMc";

const client = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function test() {
  console.log("Attempting to query table 'audit_logs' on separate DB...");
  const { data, error } = await client.from('audit_logs').select('*').limit(5);
  if (error) {
    console.error("Error querying table:", error.message);
    if (error.message.includes("does not exist")) {
      console.log("Table 'audit_logs' does not exist. We need to create it.");
    }
  } else {
    console.log("Successfully connected and queried 'audit_logs'! Data:", data);
  }
}

test();
