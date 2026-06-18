import dotenv from 'dotenv';
dotenv.config();

const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("Fetching PostgREST OpenAPI schema to find RPCs...");
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    const rpcs = Object.keys(data.paths).filter(p => p.startsWith('/rpc/'));
    console.log("RPC paths available:", rpcs);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
