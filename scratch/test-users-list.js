import dotenv from 'dotenv';
dotenv.config();

import { listAllUsers } from '../src/services/authService.js';

async function test() {
  const targetEmail = "seeded_pat_9@rtooth.in";
  try {
    console.log("Calling listAllUsers()...");
    const users = await listAllUsers();
    console.log(`Total users returned: ${users.length}`);
    
    const targetUser = users.find(u => u.email === targetEmail);
    console.log(`Target user details in list:`, targetUser);
    
    const bannedUsers = users.filter(u => u.status === 'banned');
    console.log(`Banned users count in returned list: ${bannedUsers.length}`);
    bannedUsers.forEach(u => {
      console.log(`- ${u.email}: status = ${u.status}`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
