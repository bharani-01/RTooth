// Using native fetch


async function runTest() {
  const email = "admin@rtooth.in";
  const password = "AdminPassword123";

  console.log(`Logging in to local server as ${email}...`);
  try {
    const loginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
    }

    const loginData = await loginRes.json();
    console.log("Login successful!");
    const token = loginData.data.session.access_token;
    console.log("Access Token retrieved. Fetching users list...");

    const usersRes = await fetch("http://localhost:5000/api/v1/auth/admin/users", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!usersRes.ok) {
      const errText = await usersRes.text();
      throw new Error(`Fetch users failed with status ${usersRes.status}: ${errText}`);
    }

    const usersData = await usersRes.json();
    console.log(`Users fetched from local server API successfully!`);
    console.log(`Total users in system: ${usersData.data.users.length}`);
    console.log("First 3 users details:");
    console.log(usersData.data.users.slice(0, 3));
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runTest();
