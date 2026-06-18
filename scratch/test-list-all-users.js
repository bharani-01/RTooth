import dotenv from 'dotenv';
dotenv.config();

import { listAllUsers } from '../src/services/authService.js';

async function test() {
  try {
    console.log("Calling listAllUsers()...");
    const users = await listAllUsers();
    console.log(`Successfully retrieved ${users.length} users:`);
    users.slice(0, 5).forEach(u => {
      console.log(`- ${u.first_name} ${u.last_name} (${u.email}) [Role: ${u.role}, Status: ${u.status}]`);
    });
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

test();
