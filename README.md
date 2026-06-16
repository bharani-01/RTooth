# RTooth - Oral Oncology Clinic Management Portal

RTooth is a premium, enterprise-grade clinical portal designed for early oral cancer staging, biopsy tracking, lifestyle habit histories, and multi-patient oncology coordination. 

---

## 🚀 Hosting on Render (Production Deployment)

This repository includes a `render.yaml` Blueprint specification file to make deployment on **Render** automatic and seamless.

### Step-by-Step Deployment Guide:

1. **Commit and Push to Git**:
   Ensure all local changes are committed and pushed to your GitHub, GitLab, or Bitbucket repository.

2. **Sign In to Render**:
   Create a free account or sign in at [Render.com](https://render.com).

3. **Deploy using Blueprint**:
   - Go to your Render Dashboard.
   - Click on **New +** and select **Blueprint**.
   - Connect your Git repository.
   - Render will read the `render.yaml` file automatically and pre-configure the service:
     - **Service Type**: Web Service (Node)
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free tier (changeable in Render)

4. **Input Environment Variables**:
   Render will prompt you to enter the following values:
   - `SUPABASE_URL`: Your Supabase Project API URL.
   - `SUPABASE_ANON_KEY`: Your Supabase Project Public/Anon Key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Project Service Role Key (used securely on the backend for administrative operations like listing users).

5. **Deploy**:
   Click **Apply**. Render will build the dependencies, serve the Express backend, and expose the web app over a public HTTPS URL.

---

## 💻 Running Locally

### Prerequisites:
- Node.js (version 18 or above recommended)
- A Supabase Project initialized with the SQL schema in `schema.sql`.

### Local Setup:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add:
   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```

3. **Database Seeding (Optional)**:
   Ensure you run the database seeding scripts to insert mock clinicians and patient data:
   ```bash
   node scratch/seed-admin.js
   node scratch/seed-data.js
   ```

4. **Launch Server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at: [http://localhost:5000](http://localhost:5000).

---

## 🌐 API Routes Registry

All backend services are RESTful and versioned under the `/api/v1` prefix:

- **Authentication (`/api/v1/auth`)**:
  - `POST /login` - Sign in and retrieve session tokens.
  - `POST /logout` - Invalidate active session.
  - `GET /me` - Retrieve current logged-in profile.
  - `POST /register` - Register new IT-Admin accounts.
- **Patients Directory (`/api/v1/patients`)**:
  - `GET /` - List patients (scoped to attending doctor).
  - `POST /` - Register new patients.
  - `GET /:id` - Retrieve full clinical profile of a patient by `patient_code` (e.g. `PAT-10001`).
  - `POST /:id/checkups` - Log clinical check-up notes.
  - `POST /:id/medications` - Prescribe medications.
- **Doctors Directory (`/api/v1/doctors`)**:
  - `GET /` - List registered clinicians (IT-Admin only).
  - `POST /` - Register a new doctor profile (IT-Admin only).

---

## 🛠️ Tech Stack & Architecture
- **Backend**: Node.js & Express.
- **Database Layer**: Supabase (PostgreSQL).
- **Authentication**: JWT via Supabase Auth.
- **Frontend**: Vanilla HTML5, CSS3 Variables, ES6 JavaScript.
- **URL Handling**: Support for clean, extension-less paths (e.g., `/login` instead of `/login.html`).
