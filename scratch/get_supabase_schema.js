// Using native fetch

const url = "https://smwiswcyrkgrstiwiflc.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtd2lzd2N5cmtncnN0aXdpZmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzQ3NzksImV4cCI6MjA5NzExMDc3OX0.c4StqBhIOMhpfVTQO65o-HcIEZgoXn0zdDf1pYoxuMc";

async function main() {
  console.log("Fetching PostgREST OpenAPI schema...");
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
    console.log("Paths available:");
    console.log(Object.keys(data.paths));
    console.log("Definitions available:");
    console.log(Object.keys(data.definitions || {}));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
