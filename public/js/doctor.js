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
  if (path.endsWith('/doctor') || path.endsWith('/doctor/') || path.endsWith('index.html')) {
    await loadDashboardData();
  } else if (path.endsWith('/patients') || path.endsWith('patients.html')) {
    loadPatientsDirectory();
  } else if (path.endsWith('/register_patient') || path.endsWith('register_patient.html')) {
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
    const cleanPath = path.replace(/\/$/, '').replace(/\.html$/, '');
    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      const cleanHref = href.replace(/\/$/, '').replace(/\.html$/, '');
      if (cleanPath === cleanHref || cleanPath.endsWith(cleanHref) || (cleanHref === '/doctor' && cleanPath === '/doctor')) {
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
    const response = await apiRequest('/patients', {
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
 * Helper to generate clinical screening slot times (9:00 AM start, 1.5h spacing)
 */
function getSimulatedSlotTime(index) {
  const startHour = 9; // 9:00 AM
  const minutesPerSlot = 90; // 1.5 hours
  const totalMinutes = startHour * 60 + index * minutesPerSlot;
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Fetch and display the count of registered patients, calculate oncology statistics, and render the screening queue
 */
async function loadDashboardData() {
  const patientCountStat = document.getElementById('stat-cases-count');
  const pendingBiopsiesStat = document.getElementById('stat-pending-biopsies');
  const highRiskStat = document.getElementById('stat-high-risk');
  const queueBody = document.getElementById('screening-queue-body');

  if (patientCountStat) patientCountStat.innerText = 'Loading...';
  if (pendingBiopsiesStat) pendingBiopsiesStat.innerText = 'Loading...';
  if (highRiskStat) highRiskStat.innerText = 'Loading...';

  if (queueBody) {
    queueBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 32px;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
            <div class="spinner"></div>
            <div style="color: var(--text-muted); font-size: 14px; font-weight: 500;">Retrieving oncology queue...</div>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await apiRequest('/patients');
    if (response.success) {
      const patients = response.data.patients;

      // Calculate statistics
      const totalCases = patients.length;
      
      const pendingBiopsies = patients.filter(p => {
        const stage = (p.cancer_stage || '').toLowerCase();
        return p.status === 'draft' || stage.includes('suspicious') || stage.includes('dysplasia');
      }).length;

      const highRisk = patients.filter(p => {
        const stage = (p.cancer_stage || '').toLowerCase();
        return stage.includes('stage iii') || stage.includes('stage iv') || stage.includes('high-risk dysplasia');
      }).length;

      // Update UI stats cards
      if (patientCountStat) patientCountStat.innerText = totalCases;
      if (pendingBiopsiesStat) pendingBiopsiesStat.innerText = pendingBiopsies;
      if (highRiskStat) highRiskStat.innerText = highRisk;

      // Update Queue Table
      if (queueBody) {
        if (patients.length === 0) {
          queueBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No patients currently in the screening queue.</td>
            </tr>
          `;
          return;
        }

        queueBody.innerHTML = patients.map((pat, idx) => {
          const slotTime = getSimulatedSlotTime(idx);
          const isPending = pat.status === 'draft' || 
            (pat.cancer_stage && (pat.cancer_stage.toLowerCase().includes('suspicious') || pat.cancer_stage.toLowerCase().includes('dysplasia')));
          
          const statusClass = isPending ? 'status-pending' : 'status-confirmed';
          const statusText = isPending ? 'Pending Biopsy' : 'Confirmed';

          let stageColor = 'var(--text-muted)';
          const stage = (pat.cancer_stage || '').toLowerCase();
          if (stage.includes('stage iv') || stage.includes('stage iii') || stage.includes('stage ii')) {
            stageColor = 'var(--danger)';
          } else if (stage.includes('stage i')) {
            stageColor = 'var(--accent-teal)';
          } else if (stage.includes('dysplasia')) {
            stageColor = 'var(--warning)';
          }

          return `
            <tr>
              <td data-label="Patient">
                <strong><a href="/doctor/patient_profile?id=${pat.patient_code}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${pat.first_name} ${pat.last_name}</a></strong>
              </td>
              <td data-label="Time">${slotTime}</td>
              <td data-label="Lesion Site">${pat.lesion_location || 'Not Specified'}</td>
              <td data-label="Staging"><span style="font-weight: 600; color: ${stageColor};">${pat.cancer_stage || 'Suspicious Lesion'}</span></td>
              <td data-label="Pathology Status"><span class="status-pill ${statusClass}">${statusText}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (error) {
    console.error('Error loading doctor dashboard data:', error.message);
    if (patientCountStat) patientCountStat.innerText = 'Error';
    if (pendingBiopsiesStat) pendingBiopsiesStat.innerText = 'Error';
    if (highRiskStat) highRiskStat.innerText = 'Error';
    
    if (queueBody) {
      queueBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger); padding: 24px;">Failed to load screening queue.</td>
        </tr>
      `;
    }
  }
}

/**
 * Query the backend for all registered patients and populate the table
 */
async function loadPatientsDirectory() {
  const tableBody = document.getElementById('patients-table-body');
  if (!tableBody) return;

  try {
    const response = await apiRequest('/patients');
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
        const stage = (pat.cancer_stage || '').toLowerCase();
        if (stage.includes('stage iv') || stage.includes('stage iii') || stage.includes('stage ii')) {
          stageColor = 'var(--danger)';
        } else if (stage.includes('stage i')) {
          stageColor = 'var(--accent-teal)';
        } else if (stage.includes('dysplasia')) {
          stageColor = 'var(--warning)';
        }

        return `
          <tr>
            <td data-label="Patient">
              <div style="display: flex; align-items: center;">
                <strong><a href="/doctor/patient_profile?id=${pat.patient_code}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${pat.first_name} ${pat.last_name}</a></strong>
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
