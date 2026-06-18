async function runTest() {
  const adminEmail = "admin@rtooth.in";
  const adminPassword = "AdminPassword123";
  const targetUserId = "ee417790-a805-43ca-b5fd-772b192a314c"; // erumai saani

  try {
    console.log("Logging in as admin...");
    const loginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.session.access_token;

    console.log("Simulating PUT update request for user ee417790-a805-43ca-b5fd-772b192a314c...");
    const updateRes = await fetch(`http://localhost:5000/api/v1/auth/admin/users/${targetUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        first_name: "erumai",
        last_name: "saani-updated",
        email: "saabierumai@gmail.com",
        phone: "9876543210",
        role: "doctor",
        specialization: "Oral Oncologist",
        license_number: "MDS-9999"
      })
    });

    const updateData = await updateRes.json();
    console.log("Update response:", updateData);

    // Verify change in DB
    const listRes = await fetch("http://localhost:5000/api/v1/auth/admin/users", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const updatedUser = listData.data.users.find(u => u.id === targetUserId);
    console.log("Retrieved updated user details from list API:", updatedUser);

    // Revert back
    console.log("Reverting changes...");
    await fetch(`http://localhost:5000/api/v1/auth/admin/users/${targetUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        first_name: "erumai",
        last_name: "saani",
        email: "saabierumai@gmail.com",
        phone: "",
        role: "doctor"
      })
    });
    console.log("Revert complete!");

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runTest();
