import dotenv from 'dotenv';
dotenv.config();

import { banUserAdmin } from '../src/services/authService.js';

async function test() {
  const targetUserId = "ee417790-a805-43ca-b5fd-772b192a314c"; // erumai saani
  
  try {
    console.log(`Banning user ${targetUserId}...`);
    const profile = await banUserAdmin(targetUserId, true);
    console.log("Ban successful! Updated profile:", profile);
    
    console.log("Unbanning user to revert...");
    const reverted = await banUserAdmin(targetUserId, false);
    console.log("Unban successful! Updated profile:", reverted);
  } catch (error) {
    console.error("Ban failed with error:", error);
  }
}

test();
