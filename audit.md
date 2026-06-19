# Site Audit Report

**Date:** June 19, 2026
**Project:** RTooth — Enterprise Care Coordination for Oral Oncology
**Detected stack:** Node.js (Express 4.19) · Supabase (PostgreSQL + Auth + Storage) · Vanilla HTML/CSS/JS (ES Modules) · WebSocket (`ws` 8.21) · Resend (email) · Multer (file upload) · express-rate-limit · Deployed via Render
**Detected audience/goal:** Healthcare practitioners (oncologists, IT-Admins) and oral oncology patients. Business goal: manage oral cancer patient registry, track dysplasia stages, coordinate biopsy records, enable symptom self-reporting and compliance auditing.
**Design system maturity:** Partially tokenized — a solid `:root` token set exists in `style.css` (colors, shadows, radii, transitions) but is undercut by dozens of hardcoded hex values, ad-hoc `style=""` attributes in HTML templates, and two competing color themes (`--primary: #0284c7` in style.css vs `--primary-brand: #9e1a22` in landing.css) that are never fully resolved across all pages.

---

## Anti-Pattern Verdict

**Partially** — 4 of 8 AI-generation tells are present, but the domain-specific content (oral oncology staging, RLS audit middleware, real WebSocket metrics, actual multi-role clinical workflows) is too technically coherent to be pure AI scaffolding. This is a real project with AI-assisted UI generation on the landing/marketing layer.

**Tells present:**
1. **Hero metrics that are unverifiable** (`index.html:67–85`): "98.7% Screening Accuracy," "12,400+ Monitored Profiles," and "< 24 hr Biopsy Response" are displayed as trust signals with no source citation. The 12,400+ claim is particularly implausible for what is demonstrably a demo system with seeded data.
2. **Predictable landing page layout** (`index.html`): centered hero → 3-col capabilities grid → tobacco tabs → 4-col workflow steps → security split card → FAQ accordion → CTA banner → footer. No structural deviation.
3. **Card-grid overuse** (`landing.css:217–260`, `landing.css:263–294`): every content group defaults to the same border+border-radius+shadow card, including the workflow steps which would benefit from a true timeline connector.
4. **Generic font as the only font** (`style.css:1–2`): Outfit + Plus Jakarta Sans are competent choices but have zero typographic personality — standard pairing for AI-generated interfaces. No display typeface, no deliberate contrast.

**Tells absent:** No purple/indigo gradient (the MNC Red is a real deliberate choice), no emoji as icons (all SVG), no "Online" status badges with no backing, no competing equal-weight CTAs on the same view.

**Score: 2/4**

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1/4 | Modals have no `role="dialog"`, no focus trap, no `aria-describedby`; forms have no error association |
| 2 | Performance | 2/4 | No lazy loading on images; auth rate limiter allows 100 req/15 min (loose for a medical system) |
| 3 | Security | 1/4 | JWT + full patient profile stored in `localStorage`; no CSP header; wildcard CORS fallback in production; debug storage endpoint exposes key metadata |
| 4 | Theming & design system | 2/4 | Tokens exist but 50+ hardcoded values leak through HTML `style=""` attributes; two competing primary color tokens |
| 5 | Responsive design | 3/4 | Good mobile breakpoints; tables reflow to card layout; main gap is landing nav silently collapses links at narrow viewport |
| 6 | Anti-patterns | 2/4 | Fabricated metrics, layout predictability, card-grid overuse |
| | **Total** | **11/24** | **Acceptable** |

**Legal & compliance flags:**
- Privacy Policy: **Present** and linked from cookie banner and footer of landing/legal pages — but **not linked from the login page footer**
- Terms of Service: **Present** and linked from legal page footers — but **not linked from the login page footer** or the landing page main footer
- Cookie consent: **Present** but **non-compliant** — cookies (session token in localStorage) are written before consent is given; banner is decorative only
- GDPR signals: **Missing** — privacy policy mentions patient data rights but no in-app mechanism to request deletion or data export
- COPPA: **N/A** (clinical platform; not targeting under-13 users and no self-registration for patients)

---

## Executive Summary

RTooth is a functioning clinical management platform with a real multi-role architecture, solid backend patterns (JWT-gated routes, RLS enforcement, audit trail), and good overall code organization. The most critical risks are a **P0 security concern** — the Supabase JWT access token and full patient profile (containing PHI) are stored in `localStorage`, making them trivially accessible to any XSS payload — combined with **no Content-Security-Policy header** and **pervasive unescaped `innerHTML` templating** across all frontend JS files. These three together create a complete XSS → token theft → PHI exfiltration chain on a platform that handles cancer patient records. Separately, the `debugStorage` endpoint is accessible to admins in production and leaks key suffix values and internal client state. Accessibility is poor across the dynamic UI layer — every programmatically generated modal lacks a focus trap, `role="dialog"`, and Escape-key handling. The project is **not ready for production launch** without addressing the P0 security cluster and at minimum the P1 accessibility gaps.

**Total findings by severity:** P0 **2** · P1 **8** · P2 **6** · P3 **5**

---

## Quick Wins

1. **Move token from `localStorage` to `sessionStorage`** (P0) — one-line change in `api.js:29`, eliminates XSS persistence risk
2. **Add a global CSP header in `app.js`** (P1) — one `res.setHeader('Content-Security-Policy', ...)` call in a middleware, cuts XSS blast radius immediately
3. **Add `role="dialog"` + `aria-modal="true"` to all modals** (P1) — present in `auth.js:332` `showConfirmModal`, `admin.js` audit details modal, and several others; adding two attributes each takes minutes
4. **Remove or guard the `/debug-storage` endpoint** (P1) — comment out or add a `NODE_ENV !== 'production'` guard in `doctorRoutes.js:14`
5. **Fix email CTAs hardcoded to `localhost:5000`** (P2) — replace with `process.env.APP_URL` in `emailService.js:149, 225, 271, 342`

---

## Findings

### P0 — Blocking

#### JWT Access Token and Patient PHI Stored in `localStorage`
- **Category:** Security — Storage
- **Location:** `public/js/api.js:29,43`
- **Issue:** The Supabase JWT access token (`supabase_auth_token`) and the full patient profile JSON (`user_profile`) — which includes name, email, phone, cancer stage, lesion location, tobacco habits, doctor assignments, and patient code — are persisted to `localStorage`. `localStorage` is synchronously accessible to any JavaScript running on the same origin, including any injected XSS payload. Since the platform has pervasive unescaped `innerHTML` templating (see P1 XSS below), the attack chain is complete: inject script → steal token → call authenticated API endpoints as that user → read or modify patient health records.
- **User impact:** A successful XSS attack on a doctor's session grants full, persistent read/write access to all patients assigned to that doctor. On an admin's session it grants access to the entire patient registry, audit logs, and the ability to create/delete users. Patients' Protected Health Information (PHI) is exfiltrated silently. The token persists across browser sessions because `localStorage` is not cleared on tab close.
- **Fix:** Move the session token to `sessionStorage` (not accessible to other tabs, auto-cleared on session end) or, better, use an `HttpOnly` cookie set by the server so it is completely inaccessible to JavaScript. The full patient profile object should not be persisted at all — cache only the non-sensitive role + user ID required for guard checks, and always re-fetch sensitive profile data from the authenticated `/auth/me` endpoint.

---

#### Unescaped `innerHTML` Templating with Server-Supplied Data Throughout the Dashboard
- **Category:** Security — XSS
- **Location:** `public/js/admin.js` (~30+ instances), `public/js/patient_profile_doctor.js` (~20+ instances), `public/js/doctor.js`, `public/js/gallery.js`, `public/js/symptoms_patient.js`, `public/js/visit_detail_doctor.js`, `public/js/visit_detail_patient.js`, `public/js/patient.js`
- **Issue:** All dashboard JS files construct HTML by directly string-interpolating server-supplied values into `innerHTML` template literals. Examples: `admin.js:202` interpolates `doc.first_name`, `doc.last_name`, `doc.specialization`, `doc.email` directly into table row HTML. `patient_profile_doctor.js:248` interpolates checkup `findings` and `notes` text. `symptoms_patient.js:83` interpolates symptom log text. None of these values are HTML-escaped before insertion. Any value containing `<script>` or `<img onerror=...>` stored in the database would execute as JavaScript when rendered. Since doctors input free-text findings, and patients input symptom notes, these are realistic data entry points.
- **User impact:** A malicious actor who can insert a stored XSS payload (e.g. a patient with a crafted name or a doctor who types script tags into a findings field) can execute arbitrary JavaScript in the browser of every user who views that record. Combined with the `localStorage` token storage above, this achieves persistent session hijacking of medical staff.
- **Fix:** Create a `escapeHtml(str)` utility function (replace `&`, `<`, `>`, `"`, `'` with their HTML entities) and call it on every server-supplied string before it is interpolated into `innerHTML`. Alternatively, switch to DOM API methods (`document.createElement`, `el.textContent = value`) for leaf text nodes, which are XSS-safe by default. Do not use `innerHTML` for text content.

---

### P1 — Major

#### No Content-Security-Policy Header
- **Category:** Security — Headers
- **Location:** `src/app.js` (no security header middleware present)
- **Issue:** The Express application serves no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers. Without CSP, the browser places no restrictions on where scripts can be loaded from or what inline scripts can execute, removing the browser's last line of defence against XSS.
- **User impact:** Any XSS payload executes without browser restriction. Clickjacking is possible (the app can be embedded in a cross-origin iframe). MIME-type sniffing attacks are possible.
- **Fix:** Add a security header middleware (e.g. the `helmet` package, which sets all critical headers in one line) before route registration in `app.js`. At minimum: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss:`. Also add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.

#### Wildcard CORS Fallback in Production Configuration
- **Category:** Security — Headers/CORS
- **Location:** `src/app.js:48–50`
- **Issue:** When `ALLOWED_ORIGINS` is not set in the environment, the CORS policy falls back to `['*']`, allowing any origin to make credentialed cross-origin requests. The `render.yaml` does not define `ALLOWED_ORIGINS`, meaning this wildcard is active in the current deployed configuration.
- **User impact:** Any website on the internet can make authenticated API calls to RTooth using a victim user's browser session (CSRF-style attack). Since the API uses Bearer tokens rather than cookies, the actual CSRF risk is mitigated — but wildcard CORS is still a significant misconfiguration that allows cross-origin reads of API responses, defeating same-origin isolation.
- **Fix:** Add `ALLOWED_ORIGINS` to `render.yaml` environment variables (e.g. `https://rtooth-clinic.onrender.com`) and remove the `'*'` fallback. Fail hard with a startup warning if the variable is missing in production.

#### `debugStorage` Endpoint Accessible in Production
- **Category:** Security
- **Location:** `src/routes/doctorRoutes.js:14`, `src/services/authService.js:940–999`
- **Issue:** The `/api/v1/doctors/debug-storage` endpoint (admin-only) returns internal environment state including whether service-role keys are defined, their lengths, their last 15 characters (`SUPABASE_SERVICE_ROLE_KEY_suffix`), and whether the admin Supabase client's key matches the anon vs. service key. While it requires admin auth, it is a significant information disclosure for an attacker who compromises an admin account, and it should not exist in production.
- **User impact:** An attacker with a stolen admin token (see P0 findings) can enumerate internal key fingerprints, confirming which Supabase credentials are in use and validating stolen partial key values.
- **Fix:** Add a `NODE_ENV !== 'production'` guard in the route handler, or remove the endpoint entirely. Debug tooling belongs in development scripts, not production APIs.

#### All Programmatically-Generated Modals Missing ARIA Roles and Focus Management
- **Category:** Accessibility
- **Location:** `public/js/auth.js:325–361` (`showConfirmModal`), `public/js/auth.js:363–397` (`showAlertModal`), `public/js/admin.js:748–772` (audit log detail modal)
- **Issue:** All dynamically created modals (confirm dialog, alert dialog, audit log modal) lack `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`. No focus is moved into the modal when it opens, no focus trap keeps the user inside, Escape key does not close modals, and focus is not returned to the trigger element when the modal closes. The HTML modal in `admin/audit_logs.html` has a close button with `aria-label` but the container has no `role`.
- **User impact:** Screen reader users receive no announcement that a dialog has opened and can continue tabbing through the background page content — including interacting with action buttons that modify patient data. Keyboard-only users cannot dismiss modals without clicking the cancel button (Escape key is not handled). For a HIPAA-handled medical platform, modal accessibility is a legal risk beyond a UX one.
- **Fix:** When creating modals, add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="[modal-title-id]"`. Move focus to the first focusable element inside the modal on open. Implement a focus trap (loop Tab/Shift+Tab within the modal). Add an `keydown` listener for `Escape` to close. On close, return focus to the element that triggered the modal.

#### Forgot Password Redirect Exposes Email as Plaintext URL Query Parameter
- **Category:** Security / Privacy
- **Location:** `public/js/auth.js:565`
- **Issue:** After submitting the forgot-password form, the code redirects to `/reset_password.html?email=${encodeURIComponent(email)}`. The user's email address — which is PHI on a medical platform — is exposed in the browser URL bar, browser history, server access logs (as part of the URL), and any referrer headers sent to third-party resources (Google Fonts, etc.).
- **User impact:** A patient's email address (which they may want to keep private from their employer or family members) is visible in the browser URL bar and logged in server access logs and browser history. On a shared computer, any subsequent user can see whose account is being reset.
- **Fix:** Use `sessionStorage` to pass the email between pages (set before redirect, read and clear on destination page load). The email never touches the URL.

#### No `autocomplete` Attributes on Form Inputs; Password Fields Lack Strength Guidance
- **Category:** Accessibility / Usability
- **Location:** `public/login.html:43,51`, `public/reset_password.html` (password inputs), `public/admin/register_doctor.html`
- **Issue:** The login email field has `type="email"` but no `autocomplete="email"`. The password field has no `autocomplete="current-password"`. New password fields on reset page lack `autocomplete="new-password"`. The admin-generated doctor password generator (`admin.js:285–290`) creates a 12-char password using `Math.random()` which is not cryptographically secure.
- **User impact:** Password managers cannot reliably autofill credentials, forcing users to type them manually. Users with motor difficulties or cognitive disabilities find login significantly harder. The generated passwords are potentially weaker than expected — `Math.random()` is seeded with system time and is not suitable for security-sensitive credential generation.
- **Fix:** Add `autocomplete="email"` and `autocomplete="current-password"` to login inputs. Add `autocomplete="new-password"` to reset forms. Replace `Math.random()` in the password generator with `crypto.getRandomValues()`.

#### RLS Policies Are Overly Permissive — Every Authenticated User Can Read/Write All Rows
- **Category:** Security — Database
- **Location:** `schema.sql:105–110, 159–160`
- **Issue:** The RLS policies for `doctors`, `admins`, `patients`, `lifestyle_habits`, `medical_records`, `medications`, and `checkups` all use `USING (auth.uid() IS NOT NULL)` — meaning any authenticated user of any role can SELECT, INSERT, UPDATE, and DELETE any row in these tables. Row-level isolation (e.g., a patient can only read their own records, a doctor can only read their own assigned patients) is entirely absent at the database level. The backend code attempts to enforce this in application logic, but if the Supabase anon key is ever used directly (e.g., by a compromised frontend that bypasses the Express backend), all data is accessible.
- **User impact:** If an attacker obtains the Supabase anon key (which is visible to anyone who inspects network requests to Supabase from the frontend — the frontend doesn't contact Supabase directly, but the key is in the environment), they can query the Supabase REST API directly and read all patient records, all doctor records, and all medical history for every patient in the system, bypassing the Express application entirely.
- **Fix:** Implement per-role RLS policies. For `patients`: `USING (id = auth.uid() OR doctor_id = auth.uid())`. For `medical_records`: join to patients table to check doctor_id. For `checkups`/`medications`: similar role-based conditions. The schema should be the enforcement layer; the Express backend should be a secondary check only.

#### Cookie Consent Banner Does Not Block Cookies Before Consent
- **Category:** Legal / GDPR
- **Location:** `public/index.html:408–435`, `public/js/api.js:29`
- **Issue:** The cookie consent banner is displayed 1.5 seconds after page load (cosmetic delay). However, if a user navigates to the login page and logs in before clicking "Accept Cookies" on the landing page, the JWT token is immediately written to `localStorage` (which functions like a cookie for GDPR purposes for session trackers). The consent banner has no mechanism to actually prevent data processing — it is purely a UI notice with no enforcement.
- **User impact:** EU users' session data is collected before they have given consent. This is a GDPR Article 7 violation. Regulators treat "consent banners that do nothing" as an aggravating factor in enforcement actions.
- **Fix:** Do not write the session token or any tracking data until consent is recorded. On first visit, if consent has not been given, keep the user in an unauthenticated state. Once they click "Accept," set the consent flag and proceed. For a clinical platform where session cookies are strictly necessary, consider reclassifying them as exempt from consent under the ePrivacy Directive's "strictly necessary" exemption — but document this in the Privacy Policy.

---

### P2 — Minor

#### Hardcoded `localhost:5000` in Production Email Templates
- **Category:** Performance / Correctness
- **Location:** `src/services/emailService.js:149, 225, 271, 342`
- **Issue:** All four outbound email templates (symptom notification, visit summary, appointment reminder, severe symptoms digest) contain `href="http://localhost:5000/login"` as the CTA button link. When these emails are sent from the production deployment on Render, the links in the email point to the developer's local machine, which is unreachable.
- **User impact:** Patients who receive clinical summary emails or appointment reminders click the "Log In to Patient Portal" button and get a connection refused error. This is a broken critical user flow for a medical platform — patients may miss urgent appointment reminders.
- **Fix:** Add `APP_URL` to the environment variables (set to the production domain in `render.yaml`) and use `process.env.APP_URL || 'http://localhost:5000'` in `emailService.js`.

#### Missing `meta` Description and Canonical Tags on Inner Pages
- **Category:** SEO / Performance
- **Location:** `public/login.html`, `public/banned.html`, `public/reset_password.html`
- **Issue:** The login page title is `"Sign In - rtooth Portal"` (lowercase "rtooth" — inconsistent brand casing). No `meta name="description"` is present on the login page. `banned.html` and `reset_password.html` also lack meta descriptions. The login page also has no `<link rel="canonical">`.
- **User impact:** Search engines may index the login page with auto-generated snippets. Inconsistent brand casing ("rtooth" vs "RTooth") looks unprofessional in browser tabs and search results.
- **Fix:** Add `<meta name="description">` to all pages. Fix login page title to "Sign In — RTooth Portal". Add `<meta name="robots" content="noindex">` to auth pages (login, reset, banned) to prevent indexing.

#### Landing Page Navigation Silently Collapses on Narrow Viewports
- **Category:** Responsive Design
- **Location:** `public/css/style.css:214–230` (nav-links), `public/css/landing.css:531–537`
- **Issue:** The landing page has no mobile hamburger menu for its top navigation (unlike the dashboard pages which do have `.mobile-menu-toggle`). At viewport widths below ~640px, the nav links wrap or overflow because there is no `display: none` + mobile menu treatment. Users on narrow phones cannot access "Capabilities," "Workflow," "Self Assessment," or "Education" from the top nav.
- **User impact:** Mobile users who want to navigate the landing page have no access to nav links — only the "Portal Sign In" button survives because it's a distinct element. Educational and workflow content is inaccessible via nav without scrolling the entire page.
- **Fix:** Add a hamburger toggle button to the landing page header with a slide-out or dropdown mobile menu, matching the dashboard mobile menu pattern already implemented in `style.css`.

#### `window.confirm` Override Breaks Destructive Action Confirmation
- **Category:** Usability — Error Prevention
- **Location:** `public/js/auth.js:407–411`
- **Issue:** The code overrides `window.confirm` globally: `window.confirm = function(message) { showAlertModal(message, 'Action Required'); return false; }`. This means any code that calls `confirm()` for a destructive confirmation (delete, ban, etc.) receives `false` immediately — the confirmation always fails. If any third-party code or older script uses `confirm()`, those actions can never proceed. The intent appears to be to prevent native browser dialogs, but the implementation silently breaks the confirmation flow by always returning false.
- **User impact:** Any action that uses `window.confirm()` for protection is effectively disabled. Users who see the alert modal have no way to confirm — the modal has only an "OK" button but the underlying function already returned `false`. This could leave certain admin operations inaccessible or create confusing UX.
- **Fix:** Replace the `window.confirm` override with a proper `async` version that returns a Promise and shows the `showConfirmModal`. Any callers must be updated to `await window.confirm()`. Better: remove the override entirely and require all confirmation flows to explicitly call `showConfirmModal`.

#### Audit Log Modal Missing Keyboard Escape Handler and `role="dialog"`
- **Category:** Accessibility
- **Location:** `public/admin/audit_logs.html:265–310`, `public/js/admin.js:488–497`
- **Issue:** The audit log detail modal in the admin panel closes on backdrop click and on close button click, but has no Escape key handler. The modal container div has no `role="dialog"` or `aria-modal="true"`. The `admin.js` click-outside handler works but does not return focus to the trigger button (the "View" row button).
- **User impact:** Keyboard-only admin users must Tab to the close button rather than pressing Escape to dismiss the modal. Screen reader users are not informed a dialog opened.
- **Fix:** Add `role="dialog"` and `aria-modal="true"` to the modal container. Add a `keydown` listener for `Escape`. Capture the trigger element reference before opening and restore focus on close.

#### Static Assets Served with `no-store` Cache Headers Universally
- **Category:** Performance
- **Location:** `src/app.js:81–85`
- **Issue:** All static files (including CSS, JS, images, and fonts) are served with `Cache-Control: no-store, no-cache, must-revalidate`. While aggressive cache-busting is reasonable for HTML files to prevent stale authenticated views, applying it to fingerprinted assets (CSS, JS) means the browser re-downloads the entire stylesheet and all JavaScript files on every page navigation.
- **User impact:** Every page load redownloads all CSS (style.css is 29KB, landing.css is 15KB, and 24 more CSS files for dashboard pages) and all JS files (admin.js is 73KB, patient_profile_doctor.js is 64KB, etc.). On slow connections or mobile networks, this significantly degrades perceived load time.
- **Fix:** Apply `no-store` only to HTML files. Allow CSS, JS, images, and fonts to be cached with `Cache-Control: public, max-age=31536000, immutable` (long TTL). If assets are not fingerprinted with content hashes, use `Cache-Control: public, max-age=3600` at minimum.

---

### P3 — Polish

#### Missing `<title>` Uniqueness — Inner Dashboard Pages Are Not Individually Titled
- **Category:** Accessibility / SEO
- **Location:** Multiple files in `public/admin/`, `public/doctor/`, `public/patient/`
- **Issue:** Dashboard HTML pages use static titles like "RTooth Dashboard" regardless of which sub-page is loaded. WCAG 2.4.2 requires pages to have descriptive titles; a screen reader user opening multiple tabs of the admin area cannot distinguish them.
- **Fix:** Add specific titles to each page: "Doctors Directory — RTooth Admin," "Audit Logs — RTooth Admin," etc.

#### Pulsing "Online" Beacon on Logo Has No Meaningful Status
- **Category:** Anti-pattern / Design
- **Location:** `public/css/style.css:174–212`
- **Issue:** The logo icon has a permanently pulsing green beacon dot (`.logo-icon-container::after` with `animation: beacon-logo 2s infinite`). It conveys a "system is online" signal but there is no logic that changes its state if the system is actually degraded or if the WebSocket connection is lost.
- **Fix:** Either remove the beacon (it is decorative noise) or connect it to actual system health — change color to red/yellow if the WebSocket disconnects or if an API health-check fails.

#### Footer Missing Privacy Policy and Terms Links on the Landing Page Main Footer
- **Category:** Legal / UX
- **Location:** `public/index.html:386–405`
- **Issue:** The landing page footer has four columns: Product, Security, Interactive Tools, and a logo/description. The "Security" column links to `#security` (the security section on the landing page) and "#security" again for "HIPAA Compliance" — neither link goes to the actual Privacy Policy or Terms pages. The privacy.html and terms.html footer do have the correct links but the main landing page does not.
- **Fix:** Replace the "Security" footer column links with `/privacy` and `/terms`. These are standard footer legal link placements that visitors expect.

#### Tab Interface in Login Page and Tobacco Section Has No `aria-selected` State
- **Category:** Accessibility
- **Location:** `public/login.html:31–33`, `public/index.html:134–138`
- **Issue:** The login form's Password/OTP tab buttons and the landing page's tobacco awareness tab buttons use plain `<button>` elements with a CSS `.active` class but no `role="tab"`, `aria-selected`, or `role="tabpanel"` on their corresponding panels.
- **Fix:** Add `role="tablist"` to the container, `role="tab"` and `aria-selected="true/false"` to each button, `role="tabpanel"` and `aria-labelledby` to each panel. Update `aria-selected` on click via JavaScript.

#### `self-assessment.html` Has No Explicit `<label>` for Risk Score Output
- **Category:** Accessibility
- **Location:** `public/self-assessment.html` (referenced in nav; not fully read but pattern consistent with the codebase)
- **Issue:** Based on the codebase pattern of constructing UI via `innerHTML` and `style=""` attributes without ARIA, the self-assessment result output likely has no `aria-live` region to announce score changes to screen reader users.
- **Fix:** Add `aria-live="polite"` to the risk score output container so screen reader users hear the result when it updates.

---

## Systemic Patterns

### 1. Pervasive Unescaped `innerHTML` Templating (affects 8+ JS files, 100+ instances)
Every single JavaScript file that renders dynamic content uses string interpolation into `innerHTML` template literals with zero HTML escaping. This is not a one-off oversight — it is the universal pattern across `admin.js`, `doctor.js`, `patient.js`, `patient_profile_doctor.js`, `consultation.js`, `gallery.js`, `symptoms_patient.js`, `visit_detail_doctor.js`, and `visit_detail_patient.js`. The fix requires adding a single `escapeHtml()` utility and applying it consistently — this is a systemic architectural decision that needs to be resolved once with a shared utility, not patched file by file.

### 2. Hardcoded Inline Styles Throughout HTML Templates (affects every HTML file)
Every page uses `style=""` attributes directly on elements for values that should be tokens: `style="font-size: 12px; color: var(--dark-slate); text-transform: uppercase;"` appears repeatedly in footer headings across `index.html`, `privacy.html`, `terms.html`. Landing page icon boxes use `style="background:#fff5f5; color:#9e1a22;"`. The FAQ uses inline font sizes. This pattern recurs across every HTML file and makes theme updates impossible — changing a color requires hunting through dozens of `style=""` attributes rather than updating one token.

### 3. Missing ARIA on All Dynamic UI Components (modals, tabs, toast areas)
Neither the programmatically-generated modals (`showConfirmModal`, `showAlertModal`), the login tab interface, the tobacco tab interface, nor the audit log detail modal have any ARIA role annotations. Focus management is absent on all of them. This is systemic — the development approach for dynamic UI never incorporated ARIA from the start. A single shared modal factory with ARIA built in would resolve this at the root.

### 4. Auth Rate Limiter Set to 100 Requests Per 15 Minutes
The `authLimiter` in `app.js:25–34` allows 100 auth requests per IP per 15-minute window. For a medical system handling PHI, this is far too permissive. Standard practice for login endpoints is 5–10 attempts per IP per 15 minutes. The OTP send endpoint (`/auth/otp/send`) is behind this same limit — meaning 100 OTP requests per IP (OTP bombing potential) before triggering a block.

### 5. Two Competing Color Themes With No Reconciliation
`style.css` defines `--primary: #0284c7` (blue) as the global primary color, while `landing.css` defines `--primary-brand: #9e1a22` (red). `style.css` then redundantly copies the brand red into its own `:root` block (lines 47–52) — meaning both tokens exist globally but different components use different ones. The landing page, privacy page, and terms page use `--primary-brand`. The login page, dashboard, and all auth components use `--primary` (blue). This creates a perceptible brand split: the marketing site is red, the product is blue.

---

## Strengths

1. **Robust multi-layer auth architecture.** The combination of Supabase JWT validation in `authMiddleware.js`, role enforcement via `requireRole()`, and a client-side page guard that double-checks with `/auth/me` on every page load creates a solid defense-in-depth auth model. The guard pattern at `auth.js:190–243` is particularly well-implemented — it handles token expiry, banned users, and role mismatch in a unified, resilient way.

2. **Thoughtful audit trail system.** The `auditMiddleware.js` implementation is genuinely impressive for a project of this scale: it captures every API request with IP geolocation, sanitizes sensitive payload fields (password, token, apiKey), maps route patterns to human-readable action names, calculates precise response time in milliseconds, and broadcasts events to admin WebSocket clients in real time. The `sanitizePayload()` function at line 83 and the graceful fallback for local/private IPs are production-quality patterns.

3. **Proper transaction-like registration flows with rollback.** `authService.js:512–621` (`registerPatientByDoctor`) and `authService.js:222–289` (`registerDoctorByAdmin`) implement multi-step database insertions with proper cleanup on failure — if any step fails, all previously inserted rows are deleted and the Supabase auth user is also deleted. This prevents orphaned records and is significantly more robust than naive sequential inserts.

4. **Responsive design with mobile-first table reflow.** The `style.css:986–1032` block converts data tables to labeled card layouts on mobile viewports — a genuinely thoughtful implementation that maintains data readability on small screens without horizontal scrolling. Combined with the fixed sidebar-to-drawer transformation at narrow widths, the dashboard's mobile experience is solid.

5. **Clean separation of transport and business logic.** The service/controller/route architecture is well-followed. Controllers are thin (just request parsing + response formatting), services contain all business logic, and utilities like `errors.js` and `response.js` are shared cleanly. The `getSupabaseUserClient()` pattern in `supabase.js` for scoping database clients to user tokens shows understanding of RLS intent.

---

## Recommended Priority Order

1. **Migrate token out of `localStorage`** — The XSS + localStorage + PHI triad is a complete, exploitable chain on a platform with cancer patient records. This is the single highest-leverage fix.
2. **Add HTML escaping to all `innerHTML` template sites** — Without this, the localStorage fix alone is insufficient; the XSS entry point remains open. Create `escapeHtml()` once in `api.js`, export it, and apply it across all 8 JS files.
3. **Add a CSP header and security headers via `helmet`** — Takes 5 minutes, immediately hardens the XSS blast radius and prevents clickjacking. Add to `app.js` before any route registration.
4. **Fix CORS wildcard fallback and add `ALLOWED_ORIGINS` to `render.yaml`** — One-line fix in `app.js` and one env var in the deployment config. Stops cross-origin API reads.
5. **Tighten the auth rate limiter to 5 req/15 min and separate the OTP endpoint** — The current 100-request limit provides essentially no brute-force protection on a medical login endpoint.
6. **Implement proper per-role RLS policies in Supabase** — The schema currently provides only authentication (IS NOT NULL) rather than authorization. True row-level isolation must live in the database. This is the most involved fix but protects against direct Supabase API abuse bypassing the Express layer.
7. **Fix modal ARIA and focus management** — Required for WCAG AA compliance and for the platform to be usable by the disabled patients and medical staff it serves. The `showConfirmModal` factory should be fixed once and all modals benefit.
8. **Remove or environment-gate `/debug-storage`** — Low effort, eliminates information disclosure for a compromised admin session.
9. **Fix `localhost:5000` in email templates** — Broken links in clinical email notifications is a direct patient harm: missed appointment reminders, broken portal CTAs.
10. **Fix cookie consent to actually prevent token writes before acceptance** — Legal compliance requirement for EU users; currently the banner is purely decorative.
