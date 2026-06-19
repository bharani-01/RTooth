import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function testDocFetch() {
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

  console.log("Fetching images for PAT-12974...");
  const imagesRes = await fetch(`${BASE_URL}/patients/PAT-12974/images`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const imagesData = await imagesRes.json();
  console.log("Status:", imagesRes.status);
  console.log("Response:", JSON.stringify(imagesData, null, 2));
}

testDocFetch();
