import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';
const ROOT_URL = 'http://localhost:5000';

// Global test counters
let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

function assertFormat(responseJson, description) {
  assert(
    responseJson && typeof responseJson === 'object',
    `${description}: Response is an object`
  );
  if (responseJson) {
    if (responseJson.success === true) {
      assert(
        typeof responseJson.message === 'string',
        `${description}: Success response has 'message' string`
      );
      if (responseJson.data !== undefined) {
        assert(
          typeof responseJson.data === 'object' || Array.isArray(responseJson.data),
          `${description}: Success response 'data' is an object or array`
        );
      }
    } else if (responseJson.success === false) {
      assert(
        typeof responseJson.message === 'string',
        `${description}: Error response has 'message' string`
      );
    } else {
      assert(false, `${description}: Response has success property as boolean`);
    }
  }
}

async function runVerification() {
  console.log("=================================================");
  console.log("    RTOOTH API & REDIRECT VERIFICATION SUITE     ");
  console.log("=================================================\n");

  let doctorToken = '';
  let adminToken = '';
  let patientToken = '';

  // 1. AUTHENTICATION LOGINS
  console.log("--- 1. Testing Authentications ---");
  try {
    const docRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emily@rtooth.in', password: 'DoctorPassword123' })
    });
    const docData = await docRes.json();
    if (!docData.success) {
      console.log("Doctor login failed: status =", docRes.status, "message =", docData.message);
    }
    assert(docRes.status === 200, "Doctor login HTTP status is 200");
    assertFormat(docData, "Doctor login body format");
    assert(docData.success === true && docData.data?.session?.access_token, "Doctor token retrieved successfully");
    doctorToken = docData.data?.session?.access_token;
  } catch (err) {
    console.error("Doctor Login failed with error:", err.message);
  }

  try {
    const adminRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rtooth.in', password: 'AdminPassword123' })
    });
    const adminData = await adminRes.json();
    if (!adminData.success) {
      console.log("Admin login failed: status =", adminRes.status, "message =", adminData.message);
    }
    assert(adminRes.status === 200, "Admin login HTTP status is 200");
    assertFormat(adminData, "Admin login body format");
    assert(adminData.success === true && adminData.data?.session?.access_token, "Admin token retrieved successfully");
    adminToken = adminData.data?.session?.access_token;
  } catch (err) {
    console.error("Admin Login failed with error:", err.message);
  }

  try {
    const patRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@rtooth.in', password: 'PatientPassword123' })
    });
    const patData = await patRes.json();
    if (!patData.success) {
      console.log("Patient login failed: status =", patRes.status, "message =", patData.message);
    }
    assert(patRes.status === 200, "Patient login HTTP status is 200");
    assertFormat(patData, "Patient login body format");
    assert(patData.success === true && patData.data?.session?.access_token, "Patient token retrieved successfully");
    patientToken = patData.data?.session?.access_token;
  } catch (err) {
    console.error("Patient Login failed with error:", err.message);
  }

  // 2. CHECK /auth/me LOGGED IN PROFILE
  console.log("\n--- 2. Testing /auth/me Endpoints ---");
  if (doctorToken) {
    try {
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const meData = await meRes.json();
      assert(meRes.status === 200, "GET /auth/me returns 200");
      assertFormat(meData, "GET /auth/me response");
      assert(meData.data?.profile?.role === 'doctor', "GET /auth/me role matches 'doctor'");
    } catch (err) {
      console.error("/auth/me check failed:", err.message);
    }
  }

  // 3. RETRIEVALS (DOCTOR / ADMIN / PATIENT)
  console.log("\n--- 3. Testing Patient Clinical Profile Routing & BOLA Guards ---");
  if (doctorToken) {
    try {
      // List patients
      const listRes = await fetch(`${BASE_URL}/patients`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const listData = await listRes.json();
      assert(listRes.status === 200, "GET /patients returns 200 for Doctor");
      assertFormat(listData, "GET /patients response");
      assert(Array.isArray(listData.data?.patients), "GET /patients response contains 'patients' array");

      // Retrieve specific patient profile
      const targetPatient = listData.data.patients[0];
      if (targetPatient) {
        const patientCode = targetPatient.patient_code;
        const profileRes = await fetch(`${BASE_URL}/patients/${patientCode}`, {
          headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const profileData = await profileRes.json();
        assert(profileRes.status === 200, `GET /patients/${patientCode} returns 200`);
        assertFormat(profileData, `GET /patients/${patientCode} response`);
        assert(profileData.data?.profile?.patient_code === patientCode, "Retrieved patient_code matches requested patient_code");

        // Test BOLA Guard: Patient Priya tries to access another patient or doctor accesses without auth
        if (patientToken) {
          const bolaRes = await fetch(`${BASE_URL}/patients/${patientCode}`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
          });
          const bolaData = await bolaRes.json();
          // It could be 200 if Priya is accessing herself, but 403 Forbidden otherwise.
          if (targetPatient.email === 'priya@rtooth.in') {
            assert(bolaRes.status === 200, "Priya accessing her own patient profile returns 200");
          } else {
            assert(bolaRes.status === 403, "Priya accessing another patient's profile returns 403 Forbidden");
            assertFormat(bolaData, "BOLA 403 error response");
          }
        }
      }
    } catch (err) {
      console.error("Clinical Profile checks failed:", err.message);
    }
  }

  // 4. TESTING REDIRECTING ROUTES & CLEAN URLS
  console.log("\n--- 4. Testing .html Redirecting Routes & Clean URLs ---");
  const redirectTests = [
    { path: '/login.html', expectedRedirect: '/login' },
    { path: '/index.html', expectedRedirect: '/index' },
    { path: '/doctor/index.html', expectedRedirect: '/doctor/index' },
    { path: '/patient/profile.html', expectedRedirect: '/patient/profile' }
  ];

  for (const t of redirectTests) {
    try {
      const res = await fetch(`${ROOT_URL}${t.path}`, {
        redirect: 'manual' // Do not follow redirects automatically
      });
      assert(res.status === 301, `GET ${t.path} returns permanent redirect 301`);
      const redirectLocation = res.headers.get('location');
      assert(
        redirectLocation && redirectLocation.endsWith(t.expectedRedirect),
        `GET ${t.path} redirects to: ${t.expectedRedirect} (Actual: ${redirectLocation})`
      );
    } catch (err) {
      console.error(`Redirect test for ${t.path} failed:`, err.message);
    }
  }

  // Check that clean URL paths resolve correctly (without .html extension)
  const cleanUrlTests = [
    { path: '/login', mime: 'text/html' },
    { path: '/doctor/index', mime: 'text/html' },
    { path: '/patient/profile', mime: 'text/html' },
    { path: '/self-assessment', mime: 'text/html' }
  ];

  for (const t of cleanUrlTests) {
    try {
      const res = await fetch(`${ROOT_URL}${t.path}`);
      assert(res.status === 200, `GET clean URL ${t.path} returns 200 OK`);
      const contentType = res.headers.get('content-type') || '';
      assert(
        contentType.includes(t.mime),
        `GET clean URL ${t.path} serves content-type containing ${t.mime} (Actual: ${contentType})`
      );
    } catch (err) {
      console.error(`Clean URL test for ${t.path} failed:`, err.message);
    }
  }

  // 5. ERROR OUTPUT FORMATS
  console.log("\n--- 5. Testing Standardized Error Handling Formats ---");
  try {
    // 404 Endpoint Not Found
    const notFoundRes = await fetch(`${BASE_URL}/non-existent-api-endpoint`);
    const notFoundData = await notFoundRes.json();
    assert(notFoundRes.status === 404, "Undefined API endpoint returns HTTP 404");
    assertFormat(notFoundData, "404 undefined API endpoint");
    assert(notFoundData.success === false, "404 API error response has success=false");

    // 401 Unauthorized (No token)
    const unauthRes = await fetch(`${BASE_URL}/patients`);
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, "No auth token GET /patients returns HTTP 401");
    assertFormat(unauthData, "401 unauthorized endpoint");
    assert(unauthData.success === false, "401 error response has success=false");
  } catch (err) {
    console.error("Error formatting tests failed:", err.message);
  }

  console.log("\n=================================================");
  console.log(`    VERIFICATION COMPLETED: ${passedTests}/${totalTests} PASSED`);
  console.log("=================================================");
}

runVerification();
