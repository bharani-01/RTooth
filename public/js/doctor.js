import { apiRequest, getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Dynamically Load Sidebar
  await loadDoctorSidebar();

  // 2. Pre-load doctor profile from localStorage
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'doctor') {
    populateDoctorDetails(initialProfile);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'doctor') {
      populateDoctorDetails(profile);
    }
  });

  // 3. Trigger page-specific logic
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/doctor/')) {
    loadPatientsCount();
  } else if (path.endsWith('patients.html')) {
    loadPatientsDirectory();
  } else if (path.endsWith('register_patient.html')) {
    const registerPatientForm = document.getElementById('register-patient-form');
    if (registerPatientForm) {
      registerPatientForm.addEventListener('submit', (e) => handlePatientRegistration(e, 'active'));

      const draftBtn = document.getElementById('draft-patient-btn');
      if (draftBtn) {
        draftBtn.addEventListener('click', (e) => {
          if (registerPatientForm.checkValidity()) {
            handlePatientRegistration(e, 'draft');
          } else {
            registerPatientForm.reportValidity();
          }
        });
      }
    }
  }
});

/**
 * Load the shared doctor sidebar and highlight the active link
 */
async function loadDoctorSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  try {
    const response = await fetch('/shared/doctor_sidebar.html');
    if (!response.ok) throw new Error('Failed to fetch sidebar');
    const html = await response.text();
    sidebarContainer.innerHTML = html;

    // Highlight active link based on current path
    const path = window.location.pathname;
    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      // Match path suffix or exact match
      if (path === href || path.endsWith(href) || (href === '/doctor/index.html' && path.endsWith('/doctor/'))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Re-bind Logout Button since it's dynamically loaded now!
    const logoutBtn = document.getElementById('doctor-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to end your oncologist portal session?')) {
          await logoutUser();
        }
      });
    }

    if (window.initMobileMenu) {
      window.initMobileMenu();
    }
  } catch (error) {
    console.error('Error loading doctor sidebar:', error.message);
  }
}

/**
 * Populate UI with Doctor's profile fields
 */
function populateDoctorDetails(profile) {
  const fullName = `Dr. ${profile.first_name} ${profile.last_name}`;
  
  // Set headers & badges
  const nameBadge = document.getElementById('doc-name-badge');
  const avatar = document.getElementById('doc-avatar');
  const welcomeTitle = document.getElementById('doc-welcome-title');

  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  if (welcomeTitle) welcomeTitle.innerText = `Welcome Back, ${fullName}`;

  // Set Profile section fields
  const pName = document.getElementById('profile-full-name');
  const pEmail = document.getElementById('profile-email');
  const pPhone = document.getElementById('profile-phone');
  const pLicense = document.getElementById('profile-license');
  const pSpec = document.getElementById('profile-specialization');

  if (pName) pName.innerText = fullName;
  if (pEmail) pEmail.innerText = profile.email || 'N/A';
  if (pPhone) pPhone.innerText = profile.phone || 'Not Provided';
  if (pLicense) pLicense.innerText = profile.license_number || 'N/A';
  if (pSpec) pSpec.innerText = profile.specialization || 'Oral Oncology';
}

/**
 * Handle patient registration form submission
 */
async function handlePatientRegistration(event, status = 'active') {
  event.preventDefault();

  const firstName = document.getElementById('pat_first_name').value.trim();
  const lastName = document.getElementById('pat_last_name').value.trim();
  const email = document.getElementById('pat_email').value.trim();
  const phone = document.getElementById('pat_phone').value.trim();
  const dateOfBirth = document.getElementById('pat_dob').value;
  const gender = document.getElementById('pat_gender').value;
  const password = document.getElementById('pat_password').value;
  const address = document.getElementById('pat_address').value.trim();

  // Habit metrics
  const tobaccoHabit = document.getElementById('pat_tobacco').value;
  const tobaccoFrequency = document.getElementById('pat_tobacco_freq').value.trim();
  const tobaccoDuration = document.getElementById('pat_tobacco_dur').value.trim();

  const alcoholHabit = document.getElementById('pat_alcohol').value;
  const alcoholFrequency = document.getElementById('pat_alcohol_freq').value.trim();
  const alcoholDuration = document.getElementById('pat_alcohol_dur').value.trim();

  const betelNut = document.getElementById('pat_betel').value;
  const familyHistory = document.getElementById('pat_family').value;

  // Staging metrics
  const cancerStage = document.getElementById('pat_stage').value;
  const lesionLocation = document.getElementById('pat_location').value.trim();
  const riskFactors = document.getElementById('pat_risks').value.trim();

  const errorAlert = document.getElementById('error-alert');
  const successAlert = document.getElementById('success-alert');
  
  let submitBtn;
  if (status === 'draft') {
    submitBtn = document.getElementById('draft-patient-btn');
    setLoading(submitBtn, true, 'Saving Draft...');
  } else {
    submitBtn = document.getElementById('register-patient-btn');
    setLoading(submitBtn, true, 'Registering Patient...');
  }

  hideAlerts();

  const body = {
    email,
    password,
    firstName,
    lastName,
    phone,
    dateOfBirth,
    gender,
    address,
    tobaccoHabit,
    tobaccoFrequency,
    tobaccoDuration,
    alcoholHabit,
    alcoholFrequency,
    alcoholDuration,
    betelNut,
    familyHistory,
    cancerStage,
    lesionLocation,
    riskFactors,
    status
  };

  try {
    const response = await apiRequest('/auth/doctor/register-patient', {
      method: 'POST',
      body
    });

    if (response.success) {
      const msg = status === 'draft' 
        ? 'Patient registry draft saved successfully!' 
        : 'Patient added to registry successfully!';
      showNotification(successAlert, msg);
      
      const registerPatientForm = document.getElementById('register-patient-form');
      if (registerPatientForm) registerPatientForm.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    showNotification(errorAlert, error.message);
  } finally {
    if (status === 'draft') {
      setLoading(submitBtn, false, 'Save as Draft');
    } else {
      setLoading(submitBtn, false, 'Add Patient to Registry');
    }
  }
}

/* UI Alert Helpers */
function showNotification(element, message) {
  if (element) {
    element.innerText = message;
    element.style.display = 'flex';
  }
}

function hideAlerts() {
  const errorAlert = document.getElementById('error-alert');
  const successAlert = document.getElementById('success-alert');
  if (errorAlert) errorAlert.style.display = 'none';
  if (successAlert) successAlert.style.display = 'none';
}

function setLoading(button, isLoading, text) {
  if (button) {
    button.disabled = isLoading;
    button.innerHTML = text;
  }
}

/**
 * Fetch and display the count of registered patients (for the Overview page)
 */
async function loadPatientsCount() {
  const patientCountStat = document.getElementById('stat-cases-count');
  if (!patientCountStat) return;

  try {
    const response = await apiRequest('/auth/doctor/patients');
    if (response.success) {
      patientCountStat.innerText = response.data.patients.length;
    }
  } catch (error) {
    console.error('Error loading patients count:', error.message);
    patientCountStat.innerText = 'Error';
  }
}

/**
 * Query the backend for all registered patients and populate the table
 */
async function loadPatientsDirectory() {
  const tableBody = document.getElementById('patients-table-body');
  if (!tableBody) return;

  try {
    const response = await apiRequest('/auth/doctor/patients');
    if (response.success) {
      const patients = response.data.patients;
      
      if (patients.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No patients registered in the system.</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = patients.map(pat => {
        const age = calculateAge(pat.date_of_birth);
        const genderAge = `${pat.gender || 'Not Specified'} ${age !== 'N/A' ? '/ ' + age : ''}`;
        
        const statusBadge = pat.status === 'draft'
          ? `<span class="status-pill status-pending" style="margin-left: 8px; font-size: 11px; padding: 2px 6px; background-color: #fef3c7; color: #d97706; border: 1px solid #fcd34d;">Draft</span>`
          : `<span class="status-pill status-confirmed" style="margin-left: 8px; font-size: 11px; padding: 2px 6px; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">Active</span>`;

        let stageColor = 'var(--text-muted)';
        if (pat.cancer_stage && pat.cancer_stage.toLowerCase().includes('stage iv')) {
          stageColor = 'var(--danger)';
        } else if (pat.cancer_stage && pat.cancer_stage.toLowerCase().includes('stage iii')) {
          stageColor = 'var(--danger)';
        } else if (pat.cancer_stage && pat.cancer_stage.toLowerCase().includes('stage ii')) {
          stageColor = 'var(--danger)';
        } else if (pat.cancer_stage && pat.cancer_stage.toLowerCase().includes('stage i')) {
          stageColor = 'var(--accent-teal)';
        } else if (pat.cancer_stage && pat.cancer_stage.toLowerCase().includes('dysplasia')) {
          stageColor = 'var(--warning)';
        }

        return `
          <tr>
            <td data-label="Patient">
              <div style="display: flex; align-items: center;">
                <strong>${pat.first_name} ${pat.last_name}</strong>
                ${statusBadge}
              </div>
            </td>
            <td data-label="Age/Gender">${genderAge}</td>
            <td data-label="Staging"><span style="font-weight: 600; color: ${stageColor};">${pat.cancer_stage || 'Suspicious Lesion'}</span></td>
            <td data-label="Lesion Site">${pat.lesion_location || 'Not Specified'}</td>
            <td data-label="Risk Factors">${pat.risk_factors || 'None'}</td>
            <td data-label="Contact">${pat.phone || pat.email || 'N/A'}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading patient list:', error.message);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--danger); padding: 24px;">Failed to load patient directory.</td>
      </tr>
    `;
  }
}

/**
 * Helper to calculate age from DOB string
 */
function calculateAge(dobString) {
  if (!dobString) return 'N/A';
  try {
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 'N/A';
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  } catch (e) {
    return 'N/A';
  }
}
