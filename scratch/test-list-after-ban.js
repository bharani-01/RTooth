import dotenv from 'dotenv';
dotenv.config();

import { banUserAdmin, listAllUsers } from '../src/services/authService.js';

async function test() {
  const targetUserId = "ee417790-a805-43ca-b5fd-772b192a314c"; // erumai saani
  
  try {
    console.log(`Banning user ${targetUserId}...`);
    await banUserAdmin(targetUserId, true);
    
    console.log("Fetching listAllUsers()...");
    const users = await listAllUsers();
    const bannedUser = users.find(u => u.id === targetUserId);
    console.log("Banned user details in listAllUsers return:", bannedUser);

    console.log("Reverting...");
    await banUserAdmin(targetUserId, false);
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

test();
