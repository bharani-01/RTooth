import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function testGalleryQuery() {
  console.log("Logging in as rahul@rtooth.in...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'e0224033@sriher.edu.in',
      password: 'PatientPassword123'
    })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error("Login failed:", loginData.message);
    return;
  }
  const token = loginData.data.session.access_token;
  const profile = loginData.data.profile;
  console.log(`Login success! User ID: ${profile.id}, Email: ${profile.email}`);

  console.log("Fetching /patients/me/images...");
  const imagesRes = await fetch(`${BASE_URL}/patients/me/images`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const imagesData = await imagesRes.json();
  console.log("Status:", imagesRes.status);
  console.log("Response:", JSON.stringify(imagesData, null, 2));
}

testGalleryQuery();
