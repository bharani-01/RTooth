import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runTests() {
  console.log("=== STARTING API-BASED NOTIFICATION INTEGRATION TESTS ===");

  try {
    // 1. Locate seeded doctor and patient from database
    console.log("Locating test doctor and patient profiles...");
    const { data: docProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('role', 'doctor')
      .eq('email', 'seeded_doc_49@rtooth.in')
      .single();

    const { data: patProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('role', 'patient')
      .eq('email', 'rahul@rtooth.in')
      .single();

    if (!docProfile || !patProfile) {
      throw new Error("Required seeded doctor (seeded_doc_49@rtooth.in) or patient (rahul@rtooth.in) not found.");
    }

    const docId = docProfile.id;
    const patId = patProfile.id;

    console.log(`Doctor ID: ${docId}, Patient ID: ${patId}`);

    // Ensure the patient is assigned to this doctor
    console.log("Ensuring patient is assigned to the doctor...");
    await supabaseAdmin
      .from('patients')
      .update({ doctor_id: docId })
      .eq('id', patId);

    // 2. Login as Patient
    console.log("Logging in as patient...");
    const patLoginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rahul@rtooth.in", password: "PatientPassword123" })
    });
    const patLoginData = await patLoginRes.json();
    if (!patLoginRes.ok) throw new Error(`Patient login failed: ${JSON.stringify(patLoginData)}`);
    const patToken = patLoginData.data.session.access_token;
    console.log("Patient logged in successfully.");

    // 3. Login as Doctor
    console.log("Logging in as doctor...");
    const docLoginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "seeded_doc_49@rtooth.in", password: "DoctorPassword123" })
    });
    const docLoginData = await docLoginRes.json();
    if (!docLoginRes.ok) throw new Error(`Doctor login failed: ${JSON.stringify(docLoginData)}`);
    const docToken = docLoginData.data.session.access_token;
    console.log("Doctor logged in successfully.");

    // 4. Login as Admin
    console.log("Logging in as admin...");
    const adminLoginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@rtooth.in", password: "AdminPassword123" })
    });
    const adminLoginData = await adminLoginRes.json();
    if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    const adminToken = adminLoginData.data.session.access_token;
    console.log("Admin logged in successfully.");

    // 5. Patient logs symptoms
    console.log("Patient submitting symptom log via API...");
    const symptomRes = await fetch("http://localhost:5000/api/v1/patients/me/symptoms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${patToken}`
      },
      body: JSON.stringify({
        burning_sensation: "Severe",
        pain_scale: 8,
        difficulty_opening_mouth: "Moderate",
        ulcer_duration: 5,
        bleeding: true
      })
    });
    const symptomData = await symptomRes.json();
    if (!symptomRes.ok) throw new Error(`Symptom submission failed: ${JSON.stringify(symptomData)}`);
    console.log("Symptom submission API Succeeded. Log ID:", symptomData.data.log.id);

    // 6. Doctor logs a consultation visit (with follow-up scheduled for tomorrow)
    console.log("Doctor logging consultation visit via API...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const visitRes = await fetch(`http://localhost:5000/api/v1/patients/${patId}/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${docToken}`
      },
      body: JSON.stringify({
        findings: "Patient shows signs of leukoplakia. Active follow-up required.",
        notes: "Counselled patient to quit smoking.",
        recommendations: "Apply ointment daily.",
        next_checkup_date: tomorrow.toISOString(),
        followup_interval: "2 weeks",
        followup_notes: "Inspect oral mucosa healing progress.",
        prescriptions: JSON.stringify([
          { medication_name: "Kenacort Paste", dosage: "5g", frequency: "3 times daily" }
        ])
      })
    });
    const visitData = await visitRes.json();
    if (!visitRes.ok) throw new Error(`Visit logging failed: ${JSON.stringify(visitData)}`);
    console.log("Consultation visit logging API Succeeded. Checkup ID:", visitData.data.checkup.id);

    // 7. Admin triggers daily notifications
    console.log("Admin triggering daily scheduled notifications job via API...");
    const notifyRes = await fetch("http://localhost:5000/api/v1/auth/admin/notifications/daily", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      }
    });
    const notifyData = await notifyRes.json();
    if (!notifyRes.ok) throw new Error(`Notifications job failed: ${JSON.stringify(notifyData)}`);
    console.log("Daily Notifications API Succeeded. Execution Summary:\n", JSON.stringify(notifyData.data, null, 2));

    console.log("=== ALL NOTIFICATION INTEGRATION TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test execution failed:", err.message);
  }
}

runTests();
