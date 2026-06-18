import { apiRequest, getUserProfile, logoutUser } from './api.js';

let editingDraftId = null;

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
    initComplianceTabs();
  } else if (path.endsWith('/patients') || path.endsWith('patients.html')) {
    loadPatientsDirectory();
  } else if (path.endsWith('/register_patient') || path.endsWith('register_patient.html')) {
    const registerPatientForm = document.getElementById('register-patient-form');
    if (registerPatientForm) {
      registerPatientForm.addEventListener('submit', (e) => {
        handlePatientRegistration(e, 'active').then(() => {
          loadDraftsData();
        });
      });

      const draftBtn = document.getElementById('draft-patient-btn');
      if (draftBtn) {
        draftBtn.addEventListener('click', (e) => {
          if (registerPatientForm.checkValidity()) {
            handlePatientRegistration(e, 'draft').then(() => {
              loadDraftsData();
            });
          } else {
            registerPatientForm.reportValidity();
          }
        });
      }

      initRegisterPatientTabs();
      loadDraftsData();
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

  let url = '/patients';
  let method = 'POST';

  if (editingDraftId) {
    url = `/patients/${editingDraftId}`;
    method = 'PUT';
  }

  try {
    const response = await apiRequest(url, {
      method,
      body
    });

    if (response.success) {
      const msg = status === 'draft' 
        ? 'Patient registry draft saved successfully!' 
        : 'Patient added to registry successfully!';
      showNotification(successAlert, msg);
      
      if (editingDraftId) {
        cancelEditDraft();
      } else {
        const registerPatientForm = document.getElementById('register-patient-form');
        if (registerPatientForm) registerPatientForm.reset();
      }
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
      const casesDesc = document.getElementById('stat-cases-desc');
      if (casesDesc) casesDesc.innerText = 'Total registered cases';

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

          let stageColor = '#8a94a6';
          const stage = (pat.cancer_stage || '').toLowerCase();
          if (stage.includes('stage iv') || stage.includes('stage iii') || stage.includes('stage ii')) {
            stageColor = '#dc2626';
          } else if (stage.includes('stage i')) {
            stageColor = '#0d9488';
          } else if (stage.includes('dysplasia')) {
            stageColor = '#d97706';
          }

          return `
            <tr>
              <td data-label="Patient">
                <a href="/doctor/patient_profile?id=${pat.patient_code}" style="color:#1a1f2e; text-decoration:none; font-weight:600; font-size:13.5px;">${pat.first_name} ${pat.last_name}</a>
                <div style="font-size:11px; color:#8a94a6; margin-top:2px;">${pat.patient_code}</div>
              </td>
              <td data-label="Time" style="font-size:13px; color:#374151;">${slotTime}</td>
              <td data-label="Lesion Site" style="font-size:13px; color:#374151;">${pat.lesion_location || '—'}</td>
              <td data-label="Staging"><span style="font-size:12.5px; font-weight:600; color:${stageColor};">${pat.cancer_stage || 'Suspicious'}</span></td>
              <td data-label="Status"><span class="status-pill ${statusClass}">${statusText}</span></td>
            </tr>
          `;
        }).join('');
      }
      // Load follow-up compliance widget
      await fetchAndRenderComplianceWidget();

      // Load live symptom logs feed
      await fetchAndRenderLiveSymptomFeed();
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

      // If the patients page has registered its own render callback, use it
      if (typeof window.__patientsLoaded === 'function') {
        window.__patientsLoaded(patients);
        return;
      }

      // Fallback: plain table render
      if (patients.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a94a6;padding:32px;font-size:13.5px;">No patients registered in the system.</td></tr>`;
        return;
      }

      tableBody.innerHTML = patients.map(pat => {
        const age = calculateAge(pat.date_of_birth);
        const genderAge = `${pat.gender || '—'} ${age !== 'N/A' ? '/ ' + age + ' yrs' : ''}`;
        const isActive = pat.status !== 'draft';
        let stageColor = '#8a94a6';
        const stage = (pat.cancer_stage || '').toLowerCase();
        if (stage.includes('stage iv') || stage.includes('stage iii') || stage.includes('stage ii')) stageColor = '#dc2626';
        else if (stage.includes('stage i')) stageColor = '#0d9488';
        else if (stage.includes('dysplasia')) stageColor = '#d97706';
        return `
          <tr style="cursor:pointer;" onclick="window.location.href='/doctor/patient_profile?id=${pat.patient_code}'">
            <td><a href="/doctor/patient_profile?id=${pat.patient_code}" style="font-weight:600;color:#1a1f2e;text-decoration:none;">${pat.first_name} ${pat.last_name}</a><div style="font-size:11px;color:#8a94a6;">${pat.patient_code}</div></td>
            <td style="color:#5a6478;font-size:13px;">${genderAge}</td>
            <td><span style="font-size:12px;font-weight:650;color:${stageColor};">${pat.cancer_stage || 'Unknown'}</span></td>
            <td style="color:#5a6478;font-size:13px;">${pat.lesion_location || '—'}</td>
            <td style="font-size:12.5px;color:#5a6478;">${pat.risk_factors || '—'}</td>
            <td style="color:#5a6478;font-size:13px;">${pat.phone || pat.email || '—'}</td>
            <td><span style="font-size:12px;font-weight:600;color:${isActive?'#16a34a':'#d97706'};">${isActive?'Active':'Draft'}</span></td>
          </tr>`;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading patient list:', error.message);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:32px;font-size:13.5px;">Failed to load patient directory.</td></tr>`;
    }
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

/**
 * Initialize tab toggling on Register Patient page
 */
function initRegisterPatientTabs() {
  const tabRegister = document.getElementById('tab-register');
  const tabDrafts = document.getElementById('tab-drafts');
  const contentRegister = document.getElementById('content-register');
  const contentDrafts = document.getElementById('content-drafts');
  const cancelEditBtn = document.getElementById('cancel-edit-draft-btn');

  if (!tabRegister || !tabDrafts || !contentRegister || !contentDrafts) return;

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabDrafts.classList.remove('active');
    contentRegister.classList.add('active');
    contentDrafts.classList.remove('active');
  });

  tabDrafts.addEventListener('click', () => {
    tabDrafts.classList.add('active');
    tabRegister.classList.remove('active');
    contentDrafts.classList.add('active');
    contentRegister.classList.remove('active');
    loadDraftsData(); // Refresh list when switching to drafts tab
  });

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', cancelEditDraft);
  }
}

/**
 * Fetch and render the list of draft patient registrations
 */
async function loadDraftsData() {
  const draftsCountBadge = document.getElementById('drafts-count');
  const draftsTableBody = document.getElementById('drafts-table-body');

  try {
    const response = await apiRequest('/patients');
    if (response.success) {
      const allPatients = response.data.patients || [];
      const drafts = allPatients.filter(p => p.status === 'draft');

      // Update count badge
      if (draftsCountBadge) {
        draftsCountBadge.innerText = drafts.length;
        if (drafts.length === 0) {
          draftsCountBadge.classList.add('empty');
        } else {
          draftsCountBadge.classList.remove('empty');
        }
      }

      // Render table
      if (draftsTableBody) {
        if (drafts.length === 0) {
          draftsTableBody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">No pending draft registrations found.</td>
            </tr>
          `;
          return;
        }

        draftsTableBody.innerHTML = drafts.map(pat => {
          const age = calculateAge(pat.date_of_birth);
          const genderAge = `${pat.gender || 'Not Specified'} ${age !== 'N/A' ? '/ ' + age : ''}`;
          
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
            <tr id="draft-row-${pat.patient_code}">
              <td data-label="Patient">
                <strong>${pat.first_name} ${pat.last_name}</strong>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 2px;">Code: ${pat.patient_code}</div>
              </td>
              <td data-label="Age/Gender">${genderAge}</td>
              <td data-label="Lesion Site">${pat.lesion_location || 'Not Specified'}</td>
              <td data-label="Staging"><span style="font-weight: 600; color: ${stageColor};">${pat.cancer_stage || 'Suspicious Lesion'}</span></td>
              <td data-label="Risk Factors" style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pat.risk_factors || 'None'}">
                ${pat.risk_factors || 'None'}
              </td>
              <td data-label="Actions">
                <div style="display: flex; gap: 8px;">
                  <button class="btn-action-sm btn-primary promote-btn" data-code="${pat.patient_code}" data-id="${pat.id}">
                    Register Now
                  </button>
                  <button class="btn-action-sm btn-secondary edit-btn" data-code="${pat.patient_code}" data-id="${pat.id}">
                    Edit Draft
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Bind event listeners to Promote Buttons
        const promoteButtons = draftsTableBody.querySelectorAll('.promote-btn');
        promoteButtons.forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const patientId = btn.getAttribute('data-id');
            const patientCode = btn.getAttribute('data-code');
            await handlePromoteDraft(patientId, patientCode, btn);
          });
        });

        // Bind event listeners to Edit Buttons
        const editButtons = draftsTableBody.querySelectorAll('.edit-btn');
        editButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const patientId = btn.getAttribute('data-id');
            const patient = drafts.find(p => p.id === patientId);
            if (patient) {
              startEditDraft(patient);
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Error loading draft patients:', error.message);
    if (draftsTableBody) {
      draftsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--danger); padding: 24px;">Failed to load draft registrations.</td>
        </tr>
      `;
    }
  }
}

/**
 * Promote a draft patient to active (register them in the portal)
 */
async function handlePromoteDraft(patientId, patientCode, buttonEl) {
  const confirmed = await showConfirmModal(`Are you sure you want to promote patient ${patientCode} to active? This will allow them to log in to the portal.`);
  if (!confirmed) {
    return;
  }

  const originalText = buttonEl.innerHTML;
  buttonEl.disabled = true;
  buttonEl.innerHTML = 'Registering...';

  try {
    const response = await apiRequest(`/patients/${patientId}/status`, {
      method: 'PATCH',
      body: { status: 'active' }
    });

    if (response.success) {
      alert(`Patient ${patientCode} has been successfully registered and is now active.`);
      await loadDraftsData(); // Refresh drafts list and badge count
    } else {
      throw new Error(response.message || 'Promotion failed');
    }
  } catch (error) {
    alert(`Error promoting patient: ${error.message}`);
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalText;
  }
}

/**
 * Start editing a draft patient (loads data into the form and switches tabs)
 */
function startEditDraft(patient) {
  editingDraftId = patient.id;

  // Populate form fields
  document.getElementById('pat_first_name').value = patient.first_name || '';
  document.getElementById('pat_last_name').value = patient.last_name || '';
  
  const emailInput = document.getElementById('pat_email');
  if (emailInput) {
    emailInput.value = patient.email || '';
    emailInput.disabled = true;
  }

  const passwordInput = document.getElementById('pat_password');
  if (passwordInput) {
    passwordInput.value = ''; // Don't show password
    passwordInput.required = false;
    passwordInput.placeholder = '(Password locked during edit)';
  }

  document.getElementById('pat_phone').value = patient.phone || '';
  document.getElementById('pat_dob').value = patient.date_of_birth ? patient.date_of_birth.substring(0, 10) : '';
  document.getElementById('pat_gender').value = patient.gender || 'Male';
  document.getElementById('pat_address').value = patient.address || '';

  // Habits
  document.getElementById('pat_tobacco').value = patient.tobacco_habit || 'none';
  document.getElementById('pat_tobacco_freq').value = patient.tobacco_frequency || '';
  document.getElementById('pat_tobacco_dur').value = patient.tobacco_duration || '';

  document.getElementById('pat_alcohol').value = patient.alcohol_habit || 'none';
  document.getElementById('pat_alcohol_freq').value = patient.alcohol_frequency || '';
  document.getElementById('pat_alcohol_dur').value = patient.alcohol_duration || '';

  document.getElementById('pat_betel').value = patient.betel_nut || 'no';
  document.getElementById('pat_family').value = patient.family_history || 'no';

  // Staging
  document.getElementById('pat_stage').value = patient.cancer_stage || 'Suspicious Lesion';
  document.getElementById('pat_location').value = patient.lesion_location || '';
  document.getElementById('pat_risks').value = patient.risk_factors || '';

  // Update UI Banner
  const banner = document.getElementById('edit-draft-banner');
  const bannerInfo = document.getElementById('edit-draft-info');
  if (banner && bannerInfo) {
    bannerInfo.innerText = `${patient.patient_code} (${patient.first_name} ${patient.last_name})`;
    banner.style.display = 'flex';
  }

  // Switch tab
  const tabRegister = document.getElementById('tab-register');
  const tabDrafts = document.getElementById('tab-drafts');
  const contentRegister = document.getElementById('content-register');
  const contentDrafts = document.getElementById('content-drafts');

  if (tabRegister && tabDrafts && contentRegister && contentDrafts) {
    tabRegister.classList.add('active');
    tabDrafts.classList.remove('active');
    contentRegister.classList.add('active');
    contentDrafts.classList.remove('active');
  }

  // Scroll to top of the form
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Cancel editing the draft patient (resets form & exits edit mode)
 */
function cancelEditDraft() {
  editingDraftId = null;

  const registerPatientForm = document.getElementById('register-patient-form');
  if (registerPatientForm) registerPatientForm.reset();

  const emailInput = document.getElementById('pat_email');
  if (emailInput) emailInput.disabled = false;

  const passwordInput = document.getElementById('pat_password');
  if (passwordInput) {
    passwordInput.required = true;
    passwordInput.placeholder = 'Choose a temporary password';
  }

  const banner = document.getElementById('edit-draft-banner');
  if (banner) banner.style.display = 'none';
}

/**
 * Fetch live symptom feed from the backend
 */
async function fetchAndRenderLiveSymptomFeed() {
  const container = document.getElementById('live-symptom-feed');
  if (!container) return;

  try {
    const response = await apiRequest('/patients/symptoms/recent');
    if (response.success) {
      const logs = response.data.logs || [];
      renderLiveSymptomFeed(logs);
    }
  } catch (err) {
    console.error('Error fetching live symptom feed:', err);
    container.innerHTML = `
      <div style="color: var(--danger); font-size: 14px; text-align: center; padding: 24px;">
        Failed to load patient symptom logs feed.
      </div>
    `;
  }
}

/**
 * Render live symptom feed logs
 */
function renderLiveSymptomFeed(logs) {
  const container = document.getElementById('live-symptom-feed');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="color: #8a94a6; font-size: 13.5px; text-align: center; padding: 32px;">
        No patient symptom logs submitted recently.
      </div>
    `;
    return;
  }

  const painBg = (s) => s >= 7 ? '#fef2f2' : s >= 4 ? '#fffbeb' : '#f0fdf4';
  const painTxt = (s) => s >= 7 ? '#dc2626' : s >= 4 ? '#d97706' : '#16a34a';
  const sevTxt = (s) => s === 'Severe' ? '#dc2626' : s === 'Moderate' ? '#d97706' : '#374151';

  container.innerHTML = logs.map(l => {
    const dateStr = new Date(l.logged_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="checkup-node">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
          <a href="/doctor/patient_profile?id=${l.patient_code}" style="font-size:13px; font-weight:700; color:#1a1f2e; text-decoration:none;">
            ${escapeHtml(l.patient_name)}
            <span style="color:#8a94a6; font-weight:400; font-size:11.5px; margin-left:4px;">${l.patient_code}</span>
          </a>
          <span style="font-size:11px; color:#8a94a6;">${dateStr}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span style="font-size:11px; padding:2px 8px; border-radius:5px; font-weight:600; background:${painBg(l.pain_scale)}; color:${painTxt(l.pain_scale)}; border:1px solid ${painBg(l.pain_scale)};">Pain ${l.pain_scale}/10</span>
          <span style="font-size:11px; padding:2px 8px; border-radius:5px; font-weight:600; background:#f8fafc; color:${sevTxt(l.burning_sensation)}; border:1px solid #e9ecf0;">Burn: ${l.burning_sensation}</span>
          <span style="font-size:11px; padding:2px 8px; border-radius:5px; font-weight:600; background:#f8fafc; color:${sevTxt(l.difficulty_opening_mouth)}; border:1px solid #e9ecf0;">Mouth: ${l.difficulty_opening_mouth}</span>
          <span style="font-size:11px; padding:2px 8px; border-radius:5px; font-weight:600; background:#f8fafc; color:#374151; border:1px solid #e9ecf0;">Ulcer: ${l.ulcer_duration}d</span>
          ${l.bleeding ? `<span style="font-size:11px; padding:2px 8px; border-radius:5px; font-weight:600; background:#fef2f2; color:#dc2626; border:1px solid #fecaca;">Bleeding</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Fetch and render the Patient Follow-up Compliance Widget
 */
async function fetchAndRenderComplianceWidget() {
  const overdueBody = document.getElementById('compliance-overdue-body');
  const dueSoonBody = document.getElementById('compliance-due-soon-body');
  const compliantBody = document.getElementById('compliance-compliant-body');

  const badgeOverdue = document.getElementById('badge-overdue');
  const badgeDueSoon = document.getElementById('badge-due-soon');
  const badgeCompliant = document.getElementById('badge-compliant');

  if (!overdueBody || !dueSoonBody || !compliantBody) return;

  try {
    const response = await apiRequest('/patients/scheduling/followups');
    if (response.success) {
      const list = response.data.compliance || [];

      // Categorize
      const overdue = list.filter(item => item.status === 'overdue');
      const dueSoon = list.filter(item => item.status === 'due_soon');
      const compliant = list.filter(item => item.status === 'compliant');

      // Update badges
      if (badgeOverdue) badgeOverdue.innerText = overdue.length;
      if (badgeDueSoon) badgeDueSoon.innerText = dueSoon.length;
      if (badgeCompliant) badgeCompliant.innerText = compliant.length;

      // Render Overdue
      if (overdue.length === 0) {
        overdueBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#8a94a6; padding:24px; font-size:13px;">No missed follow-ups.</td></tr>`;
      } else {
        overdueBody.innerHTML = renderComplianceRows(overdue);
      }

      // Render Due Soon
      if (dueSoon.length === 0) {
        dueSoonBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#8a94a6; padding:24px; font-size:13px;">No patients due soon.</td></tr>`;
      } else {
        dueSoonBody.innerHTML = renderComplianceRows(dueSoon);
      }

      // Render Compliant
      if (compliant.length === 0) {
        compliantBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#8a94a6; padding:24px; font-size:13px;">No compliant patients found.</td></tr>`;
      } else {
        compliantBody.innerHTML = renderComplianceRows(compliant);
      }
    }
  } catch (error) {
    console.error('Error loading compliance widget data:', error);
    const errRow = `
      <tr>
        <td colspan="3" style="text-align: center; color: #dc2626; padding: 20px; font-size: 13px;">Failed to load compliance data.</td>
      </tr>
    `;
    overdueBody.innerHTML = errRow;
    dueSoonBody.innerHTML = errRow;
    compliantBody.innerHTML = errRow;
  }
}

/**
 * Render table rows for compliance categories
 */
function renderComplianceRows(items) {
  return items.map(item => {
    const fullName = `${item.first_name} ${item.last_name}`;
    const nextCheckup = item.next_checkup_date 
      ? new Date(item.next_checkup_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const interval = item.followup_interval || '—';

    return `
      <tr>
        <td data-label="Patient">
          <a href="/doctor/patient_profile?id=${item.patient_code}" style="font-weight:600; color:#1a1f2e; text-decoration:none; font-size:13px;">${escapeHtml(fullName)}</a>
          <div style="font-size:11px; color:#8a94a6; margin-top:2px;">${item.patient_code}</div>
        </td>
        <td data-label="Date" style="font-size:13px; color:#374151; font-weight:500;">${nextCheckup}</td>
        <td data-label="Interval" style="font-size:12.5px; color:#8a94a6;">${interval}</td>
      </tr>
    `;
  }).join('');
}

function initComplianceTabs() {
  const tabs = document.querySelectorAll('.compliance-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs
      tabs.forEach(t => t.classList.remove('active'));

      // Activate clicked tab
      tab.classList.add('active');
      const status = tab.getAttribute('data-status');

      // Hide all panels
      document.querySelectorAll('.compliance-panel').forEach(panel => {
        panel.style.display = 'none';
      });

      // Show target panel
      const targetPanelId = status === 'due_soon' ? 'panel-due-soon' : `panel-${status}`;
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.style.display = 'block';
      }
    });
  });
}

