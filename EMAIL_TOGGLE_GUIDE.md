# RTooth Email Integration & Toggle Guide

This document explains the current "paused" state of the automated email notifications (using the Resend API) and provides instructions on how to transition this to a clean, environment-variable-driven configuration in the future.

---

## 1. Current Workaround (Source-Code Level)

Because editing the `.env` file was restricted during this session, the email pause was implemented directly in the code.

### Location of the Toggle
In [emailService.js](file:///d:/dental%20project/src/services/emailService.js):
```javascript
// Hardcoded toggle to pause email sending since .env cannot be modified directly
const DISABLE_EMAIL = true;
```

When `DISABLE_EMAIL` is set to `true`, the `sendEmail` function bypasses the Resend API entirely and mock-prints the emails directly to the server terminal output logs.

---

## 2. How to Transition to Environment Variables (Recommended Fix)

Once you have permissions/access to modify the `.env` file, follow these steps to clean up the code and manage the email status via configuration.

### Step A: Update `.env` and `.env.example`

1. Open your workspace `.env` file.
2. Add the `DISABLE_EMAIL` variable at the bottom (set to `true` to pause emails, or `false` to resume them):
   ```env
   # Environment Configuration
   NODE_ENV=development
   DISABLE_EMAIL=false
   ```
3. Update `.env.example` accordingly to document the configuration option.

### Step B: Revert the Hardcoded Constant in Code

Modify [emailService.js](file:///d:/dental%20project/src/services/emailService.js) to dynamically read from `process.env`:

1. Remove the hardcoded constant:
   ```diff
   - // Hardcoded toggle to pause email sending since .env cannot be modified directly
   - const DISABLE_EMAIL = true;
   ```
2. Update the `sendEmail` function to check `process.env.DISABLE_EMAIL`:
   ```javascript
   export const sendEmail = async ({ to, subject, html }) => {
     // Retrieve configuration dynamically from environment variables
     const isEmailDisabled = process.env.DISABLE_EMAIL === 'true';

     if (isEmailDisabled || !RESEND_API_KEY) {
       const reason = isEmailDisabled ? 'DISABLE_EMAIL env flag is set to true' : 'RESEND_API_KEY is not defined';
       console.warn(`\n[EMAIL SERVICE WARNING] Email sending is paused (${reason}). Email mock-printed to console:`);
       // ... (rest of the mock logging code)
       return { success: true, mock: true };
     }
     
     // Outbound API request continues below...
   }
   ```

---

## 3. Verification & Diagnostic Logs

With email sending paused, every time a patient logs a symptom or a doctor logs a checkup:
* No API quota or network requests are sent to Resend.
* A warning block will print to your Node.js console logs detailing the recipient email address, subject, and preview body. Check the terminal executing `npm run dev` to verify notification payloads.
* The frontend landing page displays a small notice badge directing users to the status page `/email-disabled` for system transparency.
