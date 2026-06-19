import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function testDocDashboard() {
  console.log("Logging in as Dr. Emily Smith...");
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

  console.log("\n--- Testing GET /patients ---");
  try {
    const res = await fetch(`${BASE_URL}/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Count:", data.data?.patients?.length);
  } catch (err) {
    console.error("Failed:", err.message);
  }

  console.log("\n--- Testing GET /patients/scheduling/followups ---");
  try {
    const res = await fetch(`${BASE_URL}/patients/scheduling/followups`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Count:", data.data?.compliance?.length);
  } catch (err) {
    console.error("Failed:", err.message);
  }

  console.log("\n--- Testing GET /patients/symptoms/recent ---");
  try {
    const res = await fetch(`${BASE_URL}/patients/symptoms/recent`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Count:", data.data?.logs?.length);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

testDocDashboard();
