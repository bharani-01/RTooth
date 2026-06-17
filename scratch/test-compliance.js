import { getPatientsFollowupCompliance } from '../src/services/patientService.js';
import { supabase } from '../src/config/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function testCompliance() {
  console.log("Testing follow-up compliance service...");
  try {
    // 1. Sign in as Dr. Emily Smith to establish auth context/session for RLS
    console.log("Signing in as Dr. Emily Smith...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'emily@rtooth.in',
      password: 'DoctorPassword123'
    });

    if (authError || !authData.user) {
      console.error("Authentication failed:", authError?.message);
      return;
    }

    console.log(`Signed in successfully! User ID: ${authData.user.id}`);
    
    // 2. Query compliance
    const compliance = await getPatientsFollowupCompliance(authData.user.id);
    console.log(`Retrieved compliance items: ${compliance.length}`);
    console.log(JSON.stringify(compliance, null, 2));
    
    // Validate expectation
    const overdue = compliance.filter(c => c.status === 'overdue');
    const dueSoon = compliance.filter(c => c.status === 'due_soon');
    const compliant = compliance.filter(c => c.status === 'compliant');
    
    console.log("==========================================");
    console.log(`Missed Follow-ups (overdue): ${overdue.length} (Expected: 1 - Rahul)`);
    console.log(`Due Soon: ${dueSoon.length} (Expected: 1 - Priya)`);
    console.log(`Compliant: ${compliant.length} (Expected: 1 - Vikram)`);
    console.log("==========================================");
    
    if (overdue.length === 1 && overdue[0].first_name === 'Rahul' &&
        dueSoon.length === 1 && dueSoon[0].first_name === 'Priya' &&
        compliant.length === 1 && compliant[0].first_name === 'Vikram') {
      console.log("SUCCESS: Compliance status grouping is 100% CORRECT!");
    } else {
      console.error("FAILURE: Compliance status grouping mismatch!");
    }
  } catch (err) {
    console.error("Error running test:", err.message);
  }
}

testCompliance();
