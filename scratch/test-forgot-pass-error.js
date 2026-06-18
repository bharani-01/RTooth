import { sendForgotPasswordEmail } from '../src/services/authService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log("Triggering sendForgotPasswordEmail for admin@rtooth.in...");
  try {
    const data = await sendForgotPasswordEmail('admin@rtooth.in', 'http://localhost:5000/reset_password.html');
    console.log("Success:", data);
  } catch (err) {
    console.log("\n--- Caught Error details ---");
    console.log("Constructor:", err.constructor.name);
    console.log("Name:", err.name);
    console.log("Message type:", typeof err.message);
    console.log("Message:", err.message);
    console.log("Status:", err.status);
    console.log("Full error:", err);
  }
}
run();
