import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function printPatients() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'emily@rtooth.in',
      password: 'DoctorPassword123'
    })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.data.session.access_token;

  const res = await fetch(`${BASE_URL}/patients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log("Patients returned:", data.data?.patients);
}

printPatients();
