# RTooth - Project Layout & Design Guidelines

This document provides a directory index of the RTooth Clinic Management system, complete with file links and explanations, followed by the core design rules of the application.

---

## 🛠️ App Design Rules & Guidelines

1. **Fixed Top Navigation (Header)**
   - The top navigation bar (`header`) must remain **fixed** at the top of the viewport on all pages (desktop and mobile) and must **never scroll with the page**.
   - Spacing is preserved globally using `padding-top: 72px` on the `<body>` element.
   - The logo brand area (`.header-brand-area`) must have a width of exactly `260px` with a right border to align with the sidebar on desktop.
   - The user profile badge must be positioned on the right and align with the right-hand margin of the dashboard content cards (`padding-right: 40px`).

2. **Modular CSS Stylesheets**
   - Each HTML view must have its own dedicated page-level CSS stylesheet linked in the `<head>` (e.g. `/css/doctor_index.css`, `/css/admin_profile.css`).
   - All page-specific stylesheets import the central layout system at the top via `@import url("/css/style.css");` to maintain style consistency and avoid duplication.

3. **Strictly NO Emojis**
   - No emoji characters are permitted anywhere in the layout, sidebars, buttons, labels, or content.
   - All navigation items, actions, and features must use clean, stroke-based SVG icons.

4. **Dedicated User Profiles**
   - Main dashboard overview cards must not display full practitioner or admin profile fields.
   - A dedicated profile page must exist for each role (`/admin/profile.html`, `/doctor/profile.html`, `/patient/profile.html`).
   - The profile view must be accessible by clicking on the account name or email in the user badge.

5. **Mobile Responsiveness**
   - On screens `<= 992px`, the left sidebar collapses into an overlay drawer hidden off-screen (`transform: translateX(-100%)`).
   - Clicking a hamburger toggle button in the fixed header slides the sidebar in, showing a semi-transparent blurred backdrop overlay.
   - Form grid rows and statistics cards stack vertically, and tables are scrollable horizontally (`overflow-x: auto`) inside cards on mobile devices.
   - Margin offsets for the content pane revert to `0` on mobile.

---

## 📂 File Directory Index

### Public Views & Entrypoints
* [public/index.html](file:///d:/dental%20project/public/index.html) - Public landing page introducing RTooth with clean SVG features.
* [public/login.html](file:///d:/dental%20project/public/login.html) - Glassmorphic login page directing users based on their assigned role.
* [public/self-assessment.html](file:///d:/dental%20project/public/self-assessment.html) - Interactive patient oral health self-screening wizard.
* [public/blog/index.html](file:///d:/dental%20project/public/blog/index.html) - Clinical education articles listing hub with search and filters.
* [public/blog/understanding-leukoplakia.html](file:///d:/dental%20project/public/blog/understanding-leukoplakia.html) - Clinical overview of pre-cancerous white and red mucosal lesions.
* [public/blog/reversing-risks.html](file:///d:/dental%20project/public/blog/reversing-risks.html) - Physiological timeline analysis of quitting tobacco.
* [public/blog/practitioner-compliance-guide.html](file:///d:/dental%20project/public/blog/practitioner-compliance-guide.html) - Oncologist and clinic guidelines for compliance retention loops.
* [public/blog/oral-cancer-prevention.html](file:///d:/dental%20project/public/blog/oral-cancer-prevention.html) - Mucosal screening procedures and timeline protocols.
* [public/blog/nutrition-and-oral-health.html](file:///d:/dental%20project/public/blog/nutrition-and-oral-health.html) - Dietary antioxidant nutrients facilitating mucosal tissue repair.
* [public/blog/nicotine-replacement-therapies.html](file:///d:/dental%20project/public/blog/nicotine-replacement-therapies.html) - NRT comparisons and behavioral relapse prevention coping strategies.

### Shared Layouts
* [public/shared/admin_sidebar.html](file:///d:/dental%20project/public/shared/admin_sidebar.html) - Shared HTML containing menu links and logout buttons for IT-Admin roles.
* [public/shared/doctor_sidebar.html](file:///d:/dental%20project/public/shared/doctor_sidebar.html) - Shared HTML containing menu links and logout buttons for Oncologist roles.

### Admin Dashboard Views (`role: admin`)
* [public/admin/index.html](file:///d:/dental%20project/public/admin/index.html) - System administration dashboard with counts of active oncologists.
* [public/admin/doctors.html](file:///d:/dental%20project/public/admin/doctors.html) - Specialized oncologist directory showing registered clinical staff.
* [public/admin/register_doctor.html](file:///d:/dental%20project/public/admin/register_doctor.html) - Form allowing IT-Admins to register specialized doctors.
* [public/admin/profile.html](file:///d:/dental%20project/public/admin/profile.html) - Dedicated profile view showing system administrator details.

### Doctor Dashboard Views (`role: doctor`)
* [public/doctor/index.html](file:///d:/dental%20project/public/doctor/index.html) - Practitioner overview showing active cases, biopsies, and the today's queue.
* [public/doctor/patients.html](file:///d:/dental%20project/public/doctor/patients.html) - Patient database showing active registries and draft records.
* [public/doctor/register_patient.html](file:///d:/dental%20project/public/doctor/register_patient.html) - Comprehensive oral oncology registry form.
* [public/doctor/profile.html](file:///d:/dental%20project/public/doctor/profile.html) - Dedicated oncologist profile showing specialization and licensing credentials.

### Patient Dashboard Views (`role: patient`)
* [public/patient/index.html](file:///d:/dental%20project/public/patient/index.html) - Patient home portal showing attending oncologist, diagnostic records, and staging.
* [public/patient/symptoms.html](file:///d:/dental%20project/public/patient/symptoms.html) - Redesigned clinical Daily Symptom Tracker form and timeline logs.
* [public/patient/self-exam.html](file:///d:/dental%20project/public/patient/self-exam.html) - Step-by-step mirror Guided Oral Self-Examination wizard.
* [public/patient/profile.html](file:///d:/dental%20project/public/patient/profile.html) - Dedicated patient profile showing demographics, medical records, and social history.

---

### Styling (CSS)
* [public/css/style.css](file:///d:/dental%20project/public/css/style.css) - Core global stylesheet defining colors, typography, fixed headers, and responsive drawer layouts.
* [public/css/landing.css](file:///d:/dental%20project/public/css/landing.css) - Page-level styles for the public landing view.
* [public/css/blog.css](file:///d:/dental%20project/public/css/blog.css) - Custom styles for the education blog listing grid and article details view.
* [public/css/self_assessment.css](file:///d:/dental%20project/public/css/self_assessment.css) - Custom styles for the interactive multi-step self-assessment wizard and risk reports.
* [public/css/symptoms.css](file:///d:/dental%20project/public/css/symptoms.css) - Custom styles for the daily patient symptoms tracker, pain scale circles, and timeline logs.
* [public/css/self_exam.css](file:///d:/dental%20project/public/css/self_exam.css) - Custom styles for the step-by-step patient Guided Oral Self-Examination tool.
* [public/css/login.css](file:///d:/dental%20project/public/css/login.css) - Page-level styles for the login form card.
* [public/css/admin_index.css](file:///d:/dental%20project/public/css/admin_index.css) - Page-level styles for the admin overview dashboard.
* [public/css/admin_doctors.css](file:///d:/dental%20project/public/css/admin_doctors.css) - Page-level styles for the admin oncologist directory.
* [public/css/admin_register_doctor.css](file:///d:/dental%20project/public/css/admin_register_doctor.css) - Page-level styles for the admin doctor registration form.
* [public/css/admin_profile.css](file:///d:/dental%20project/public/css/admin_profile.css) - Page-level styles for the admin system profile.
* [public/css/doctor_index.css](file:///d:/dental%20project/public/css/doctor_index.css) - Page-level styles for the doctor overview dashboard.
* [public/css/doctor_patients.css](file:///d:/dental%20project/public/css/doctor_patients.css) - Page-level styles for the doctor patient directory.
* [public/css/doctor_register_patient.css](file:///d:/dental%20project/public/css/doctor_register_patient.css) - Page-level styles for the doctor patient registration form.
* [public/css/doctor_profile.css](file:///d:/dental%20project/public/css/doctor_profile.css) - Page-level styles for the doctor practitioner profile.
* [public/css/patient_index.css](file:///d:/dental%20project/public/css/patient_index.css) - Page-level styles for the patient home portal.
* [public/css/patient_profile.css](file:///d:/dental%20project/public/css/patient_profile.css) - Page-level styles for the patient health profile.

---

### Client Scripts (JS)
* [public/js/api.js](file:///d:/dental%20project/public/js/api.js) - Wrapper functions for backend requests and local token storage.
* [public/js/auth.js](file:///d:/dental%20project/public/js/auth.js) - Handles route guards, login, and initializes mobile sidebar toggles.
* [public/js/admin.js](file:///d:/dental%20project/public/js/admin.js) - Frontend controller logic for administrative dashboards.
* [public/js/doctor.js](file:///d:/dental%20project/public/js/doctor.js) - Frontend controller logic for oncologist dashboards.
* [public/js/patient.js](file:///d:/dental%20project/public/js/patient.js) - Frontend controller logic for patient portals.
* [public/js/self_exam.js](file:///d:/dental%20project/public/js/self_exam.js) - Handles Guided Oral Self-Examination transitions, checklist validations, and auto-logging integration.

---

### Backend Service API (Express)
* [src/server.js](file:///d:/dental%20project/src/server.js) - App listener binding server port.
* [src/app.js](file:///d:/dental%20project/src/app.js) - Configures Express server middleware and maps routes.
* [src/config/supabase.js](file:///d:/dental%20project/src/config/supabase.js) - Initializes Supabase JS SDK client using environment keys.
* [src/middlewares/authMiddleware.js](file:///d:/dental%20project/src/middlewares/authMiddleware.js) - Express middleware verifying auth tokens and route permissions.
* [src/routes/authRoutes.js](file:///d:/dental%20project/src/routes/authRoutes.js) - Defines backend endpoints and routes.
* [src/controllers/authController.js](file:///d:/dental%20project/src/controllers/authController.js) - Controller logic processing authentication requests.
* [src/services/authService.js](file:///d:/dental%20project/src/services/authService.js) - Database service performing Supabase CRUD operations.

---

## 🌐 MNC-Grade API Routes Registry

All backend endpoints are structured and versioned under the `/api/v1` prefix. All endpoints require a JSON payload for `POST` requests and return a standardized JSON envelope.

### Standard Response Formats

#### Success Response (200 / 201)
```json
{
  "success": true,
  "message": "Resource description action completed successfully.",
  "data": { ... }
}
```

#### Error Response (400 / 401 / 403 / 404 / 500)
```json
{
  "success": false,
  "message": "Specific error description details.",
  "stack": "..." // Only included in non-production environments
}
```

---

### API Endpoint Index

| Route | Method | Description | Auth Level | Key Fields & Custom Codes |
|---|---|---|---|---|
| `/api/v1/auth/login` | `POST` | Authenticate user and return session token | Public | Requires `email`, `password` |
| `/api/v1/auth/register` | `POST` | Create a new IT-Admin account | IT-Admin | Requires `email`, `password`, role `admin`, generates `admin_code` (`ADM-xxxxx`) |
| `/api/v1/auth/logout` | `POST` | Sign out and invalidate session token | User Session | Invalidate active JWT |
| `/api/v1/auth/me` | `GET` | Get current user's profile and credentials | User Session | Returns active profile |
| `/api/v1/doctors` | `GET` | List all registered oncology practitioners | IT-Admin | Returns list of doctors with `doctor_code` (`DOC-xxxxx`) |
| `/api/v1/doctors` | `POST` | Register a new doctor profile in system | IT-Admin | Requires demographics & license, generates `doctor_code` (`DOC-xxxxx`) |
| `/api/v1/patients` | `GET` | List all patients registered | Doctor / Admin | For Doctor role, filters only assigned patients. Returns `patient_code` (`PAT-xxxxx`) |
| `/api/v1/patients` | `POST` | Register new patient & record clinical metrics | Doctor | Requires demographics, lifestyle data, and staging, generates `patient_code` (`PAT-xxxxx`) |
| `/api/v1/patients/:id` | `GET` | Retrieve full clinical profile of a patient | Doctor / Admin / Patient | Resolves custom code (`PAT-xxxxx`) internally. Returns habits, medications, and checkups |
| `/api/v1/patients/:id/checkups` | `POST` | Log a new clinical check-up visit | Doctor / Admin | Resolves custom code (`PAT-xxxxx`). Requires findings |
| `/api/v1/patients/:id/medications` | `POST` | Prescribe a medication for the patient | Doctor / Admin | Resolves custom code (`PAT-xxxxx`). Requires name, dosage, frequency, and start_date |
