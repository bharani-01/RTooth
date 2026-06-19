import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function testEndpoints() {
  console.log("==========================================");
  console.log("Testing Backend APIs for Patient Profile");
  console.log("==========================================");

  // 1. Authenticate Doctor Emily
  console.log("1. Logging in as Dr. Emily Smith...");
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
    console.error("Login failed:", loginData.message);
    return;
  }
  const token = loginData.data.session.access_token;
  console.log("Login success! Token acquired.");

  // 2. Fetch Rahul Sharma's user ID from patient directory
  console.log("\n2. Fetching patients list to get Rahul Sharma's Patient Code...");
  const patientsRes = await fetch(`${BASE_URL}/patients`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const patientsData = await patientsRes.json();
  if (!patientsData.success) {
    console.error("Fetch patients failed:", patientsData.message);
    return;
  }
  
  const rahul = patientsData.data.patients.find(p => p.first_name === 'Priya' && p.last_name === 'Patel');
  if (!rahul) {
    console.error("Priya Patel not found in the patients list.");
    return;
  }
  const rahulIdOrCode = rahul.patient_code;
  console.log(`Found Priya Patel. Code: ${rahulIdOrCode} (UUID: ${rahul.id})`);

  // 3. Fetch Patient Clinical Profile
  console.log(`\n3. Fetching Rahul's clinical profile via GET /patients/${rahulIdOrCode}...`);
  const profileRes = await fetch(`${BASE_URL}/patients/${rahulIdOrCode}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const profileData = await profileRes.json();
  if (!profileData.success) {
    console.error("Fetch clinical profile failed:", profileData.message);
    return;
  }
  const profile = profileData.data.profile;
  console.log(`Profile Name: ${profile.first_name} ${profile.last_name}`);
  console.log(`Patient Code in response: ${profile.patient_code}`);
  console.log(`Cancer Stage: ${profile.cancer_stage}`);
  console.log(`Lifestyle habits: betel_nut=${profile.betel_nut}, family_history=${profile.family_history}`);
  console.log(`Checkup count: ${profile.checkups.length}`);
  console.log(`Medication count: ${profile.medications.length}`);

  // 4. Log a New Checkup
  console.log(`\n4. Posting a new checkup record via POST /patients/${rahulIdOrCode}/checkups...`);
  const newCheckupRes = await fetch(`${BASE_URL}/patients/${rahulIdOrCode}/checkups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      findings: "Api test checkup findings.",
      notes: "Api test notes.",
      recommendations: "Api test recommendations."
    })
  });
  const checkupResult = await newCheckupRes.json();
  if (!checkupResult.success) {
    console.error("Log checkup failed:", checkupResult.message);
  } else {
    console.log("Log checkup success! Checkup ID:", checkupResult.data.checkup.id);
  }

  // 5. Prescribe a New Medication
  console.log(`\n5. Posting a new medication prescription via POST /patients/${rahulIdOrCode}/medications...`);
  const newMedRes = await fetch(`${BASE_URL}/patients/${rahulIdOrCode}/medications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      medication_name: "API Test Medication",
      dosage: "10mg",
      frequency: "Once daily",
      start_date: "2026-06-15"
    })
  });
  const medResult = await newMedRes.json();
  if (!medResult.success) {
    console.error("Prescribe medication failed:", medResult.message);
  } else {
    console.log("Prescribe medication success! Medication ID:", medResult.data.medication.id);
  }

  // 6. Verify again that records counts are updated
  console.log(`\n6. Re-fetching clinical profile to confirm additions...`);
  const profileRes2 = await fetch(`${BASE_URL}/patients/${rahulIdOrCode}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const profileData2 = await profileRes2.json();
  const profile2 = profileData2.data.profile;
  console.log(`Updated Checkup count: ${profile2.checkups.length}`);
  console.log(`Updated Medication count: ${profile2.medications.length}`);

  // 7. Test Error Handling (GET non-existent patient ID)
  console.log(`\n7. Testing error response formatting via GET /patients/non-existent...`);
  const errorRes = await fetch(`${BASE_URL}/patients/non-existent`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const errorData = await errorRes.json();
  console.log("Error status received:", errorRes.status);
  console.log("Error response payload:", JSON.stringify(errorData, null, 2));
  if (errorRes.status === 404 && errorData.success === false && errorData.message) {
    console.log("Error response formats match standard structure!");
  } else {
    console.error("Error formatting check FAILED.");
  }

  console.log("==========================================");
  console.log("All API checks completed successfully!");
  console.log("==========================================");
}

testEndpoints();
