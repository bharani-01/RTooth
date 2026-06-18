async function runTest() {
  const adminEmail = "admin@rtooth.in";
  const adminPassword = "AdminPassword123";

  try {
    console.log("Logging in as admin...");
    const loginRes = await fetch("http://localhost:5000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.session.access_token;

    console.log("Creating a temporary test user via admin route...");
    const createRes = await fetch("http://localhost:5000/api/v1/auth/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        first_name: "Test",
        last_name: "AdminCreation",
        email: "test_admin_creation@rtooth.in",
        password: "TemporaryPassword123",
        phone: "9876543211",
        role: "patient",
        date_of_birth: "2000-01-01",
        gender: "Female"
      })
    });

    const createData = await createRes.json();
    console.log("Creation Response:", createData);

    if (createRes.ok) {
      const createdId = createData.data.profile.id;
      console.log(`User created successfully with ID: ${createdId}`);

      console.log("Purging temporary test user account...");
      const deleteRes = await fetch(`http://localhost:5000/api/v1/auth/admin/users/${createdId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const deleteData = await deleteRes.json();
      console.log("Deletion Response:", deleteData);
    }
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runTest();
