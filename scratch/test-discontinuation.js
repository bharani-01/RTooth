import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTest() {
  console.log("==========================================");
  console.log("Testing Soft-Delete & Discontinuation isolation");
  console.log("==========================================");

  // 1. Log in as Dr. Emily
  console.log("1. Logging in as Dr. Emily...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'emily@rtooth.in',
      password: 'DoctorPassword123'
    })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error("Doctor Login failed:", loginData.message);
    process.exit(1);
  }
  const docToken = loginData.data.session.access_token;
  console.log("Doctor logged in successfully!");

  // 2. Fetch Priya Patel's profile to find patient code
  const patientCode = 'PAT-10002'; // Priya's patient code
  console.log(`\n2. Fetching Priya Patel's profile (as Doctor)...`);
  const profileRes = await fetch(`${BASE_URL}/patients/${patientCode}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const profileData = await profileRes.json();
  if (!profileData.success) {
    console.error("Fetch profile failed:", profileData.message);
    process.exit(1);
  }
  const originalMedCount = profileData.data.profile.medications.length;
  console.log(`Original medication count for Priya: ${originalMedCount}`);

  // 3. Prescribe a new temporary medication
  console.log("\n3. Prescribing a new temporary medication...");
  const prescribeRes = await fetch(`${BASE_URL}/patients/${patientCode}/medications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${docToken}`
    },
    body: JSON.stringify({
      medication_name: "Discontinuation Test Drug",
      dosage: "500mg",
      frequency: "Three times daily",
      start_date: new Date().toISOString().split('T')[0],
      dosage_form: "Tablet",
      times_a_day: 3,
      relation_to_food: "After Food",
      route: "Oral",
      instructions: "Take with warm water"
    })
  });
  const prescribeData = await prescribeRes.json();
  if (!prescribeData.success) {
    console.error("Prescription failed:", prescribeData.message);
    process.exit(1);
  }
  const newMed = prescribeData.data.medication;
  console.log(`Prescribed successfully! Med ID: ${newMed.id}`);

  // 4. Verify patient list (Doctor view) has the new med
  console.log("\n4. Re-fetching profile (Doctor view) to confirm prescription is active...");
  const profileRes2 = await fetch(`${BASE_URL}/patients/${patientCode}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const profileData2 = await profileRes2.json();
  const docMeds = profileData2.data.profile.medications;
  const addedMed = docMeds.find(m => m.id === newMed.id);
  if (!addedMed) {
    console.error("Prescribed medication not found in doctor's profile response!");
    process.exit(1);
  }
  console.log(`Found med in Doctor profile. Status: ${addedMed.status}`);
  if (addedMed.status !== 'active') {
    console.error(`Expected status 'active', but got '${addedMed.status}'`);
    process.exit(1);
  }

  // 5. Log in as Patient (Priya Patel) and check active prescriptions
  console.log("\n5. Logging in as Patient Priya Patel...");
  const patLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'priya@rtooth.in',
      password: 'PatientPassword123'
    })
  });
  const patLoginData = await patLoginRes.json();
  if (!patLoginData.success) {
    console.error("Patient Login failed:", patLoginData.message);
    process.exit(1);
  }
  const patToken = patLoginData.data.session.access_token;

  console.log("Fetching Priya's own profile (Patient view)...");
  const patProfileRes = await fetch(`${BASE_URL}/patients/me`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const patProfileData = await patProfileRes.json();
  const patMeds = patProfileData.data.profile.medications;
  const patAddedMed = patMeds.find(m => m.id === newMed.id);
  if (!patAddedMed) {
    console.error("Prescribed active medication not found in patient's profile response!");
    process.exit(1);
  }
  console.log("Successfully confirmed Patient can see the active medication prescription!");

  // 6. Doctor soft-deletes (discontinues) the medication
  console.log(`\n6. Soft-deleting (discontinuing) medication ${newMed.id} (as Doctor)...`);
  const deleteRes = await fetch(`${BASE_URL}/patients/${patientCode}/medications/${newMed.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const deleteData = await deleteRes.json();
  if (!deleteData.success) {
    console.error("Failed to delete medication:", deleteData.message);
    process.exit(1);
  }
  console.log("Delete API call succeeded!");

  // 7. Verify Doctor can see it as discontinued
  console.log("\n7. Fetching profile (Doctor view) to verify discontinuation history...");
  const profileRes3 = await fetch(`${BASE_URL}/patients/${patientCode}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const profileData3 = await profileRes3.json();
  const docMedsAfterDelete = profileData3.data.profile.medications;
  const discontinuedMed = docMedsAfterDelete.find(m => m.id === newMed.id);
  if (!discontinuedMed) {
    console.error("Discontinued medication completely disappeared from Doctor profile! It should remain in history.");
    process.exit(1);
  }
  console.log(`Found med in Doctor profile. Status: ${discontinuedMed.status}, End Date: ${discontinuedMed.end_date}`);
  if (discontinuedMed.status !== 'discontinued') {
    console.error(`Expected status 'discontinued', but got '${discontinuedMed.status}'`);
    process.exit(1);
  }
  if (!discontinuedMed.end_date) {
    console.error("Expected end_date to be set to today, but it is null.");
    process.exit(1);
  }

  // 8. Verify Patient CANNOT see it anymore
  console.log("\n8. Fetching Priya's own profile (Patient view) to verify it is hidden...");
  const patProfileRes2 = await fetch(`${BASE_URL}/patients/me`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const patProfileData2 = await patProfileRes2.json();
  const patMedsAfterDelete = patProfileData2.data.profile.medications;
  const patDiscontinuedMed = patMedsAfterDelete.find(m => m.id === newMed.id);
  if (patDiscontinuedMed) {
    console.error("Discontinued medication is STILL visible on the Patient dashboard! Security violation.");
    process.exit(1);
  }
  console.log("SUCCESS: Discontinued medication is hidden from the Patient profile!");

  // 9. Verify Patient CANNOT retrieve it in visit details
  if (newMed.checkup_id) {
    console.log(`\n9. Fetching Patient's visit detail for checkup ${newMed.checkup_id}...`);
    const visitRes = await fetch(`${BASE_URL}/patients/me/visits/${newMed.checkup_id}`, {
      headers: { 'Authorization': `Bearer ${patToken}` }
    });
    const visitData = await visitRes.json();
    const visitMeds = visitData.data.prescriptions;
    const patVisitMed = visitMeds.find(m => m.id === newMed.id);
    if (patVisitMed) {
      console.error("Discontinued medication is STILL visible in Patient's visit details!");
      process.exit(1);
    }
    console.log("SUCCESS: Discontinued medication is hidden from Patient's visit details!");
  }

  console.log("\n==========================================");
  console.log("All soft-delete & role isolation checks PASSED!");
  console.log("==========================================");
}

runTest();
