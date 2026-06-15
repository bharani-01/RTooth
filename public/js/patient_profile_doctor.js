import { apiRequest, getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Dynamically Load Sidebar
  await loadDoctorSidebar();

  // 2. Pre-load doctor profile from localStorage
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'doctor') {
    populateDoctorHeader(initialProfile);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'doctor') {
      populateDoctorHeader(profile);
    }
  });

  // 3. Fetch Patient Clinical Profile
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    console.error('No patient ID provided in query parameters.');
    alert('Invalid Access: No patient ID specified.');
    window.location.href = '/doctor/patients';
    return;
  }

  // Initial fetch
  await fetchAndRenderProfile(patientId);

  // 4. Tab Switching Logic
  initTabs();

  // 5. Modal Controls
  initModals(patientId);
});

/**
 * Load the shared doctor sidebar
 */
async function loadDoctorSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  try {
    const response = await fetch('/shared/doctor_sidebar.html');
    if (!response.ok) throw new Error('Failed to fetch sidebar');
    const html = await response.text();
    sidebarContainer.innerHTML = html;

    // Remove active states from other sidebar elements as we are on a custom detail view
    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      // If we want to highlight 'Patients' directory when in patient profile
      if (href && (href.endsWith('patients') || href.endsWith('patients.html'))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Re-bind Logout Button
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
 * Populate Doctor details in top Navbar
 */
function populateDoctorHeader(profile) {
  const fullName = `Dr. ${profile.first_name} ${profile.last_name}`;
  const nameBadge = document.getElementById('doc-name-badge');
  const avatar = document.getElementById('doc-avatar');
  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
}

/**
 * Fetch and Render the Patient Profile
 */
async function fetchAndRenderProfile(patientId) {
  try {
    const response = await apiRequest(`/patients/${patientId}`);
    if (response.success) {
      const patient = response.data.profile;
      renderDemographics(patient);
      renderLifestyle(patient);
      renderCheckups(patient.checkups);
      renderMedications(patient.medications);
    }
  } catch (error) {
    console.error('Error fetching patient profile:', error.message);
    alert('Failed to load patient clinical profile.');
    window.location.href = '/doctor/patients';
  }
}

/**
 * Render patient demographics card
 */
function renderDemographics(patient) {
  const name = `${patient.first_name} ${patient.last_name}`;
  document.getElementById('patient-profile-title').innerText = `Clinical Profile: ${name}`;
  
  const statusPill = document.getElementById('patient-status-pill');
  if (patient.status === 'draft') {
    statusPill.innerText = 'Draft';
    statusPill.className = 'status-pill status-pending';
    statusPill.style.backgroundColor = '#fef3c7';
    statusPill.style.color = '#d97706';
    statusPill.style.border = '1px solid #fcd34d';
  } else {
    statusPill.innerText = 'Active';
    statusPill.className = 'status-pill status-confirmed';
    statusPill.style.backgroundColor = '#ecfdf5';
    statusPill.style.color = '#059669';
    statusPill.style.border = '1px solid #a7f3d0';
  }

  document.getElementById('pat-full-name').innerText = name;
  document.getElementById('pat-email').innerText = patient.email || 'N/A';
  document.getElementById('pat-phone').innerText = patient.phone || 'Not Provided';
  document.getElementById('pat-address').innerText = patient.address || 'Not Provided';
  document.getElementById('pat-dob').innerText = patient.date_of_birth ? formatDate(patient.date_of_birth) : 'N/A';
  document.getElementById('pat-gender').innerText = patient.gender || 'Not Specified';
  document.getElementById('pat-lesion-location').innerText = patient.lesion_location || 'Not Specified';
  document.getElementById('pat-cancer-stage').innerText = patient.cancer_stage || 'Suspicious Lesion';
  document.getElementById('pat-risk-factors').innerText = patient.risk_factors || 'None';
}

/**
 * Render patient lifestyle details
 */
function renderLifestyle(patient) {
  document.getElementById('pat-tobacco-habit').innerText = patient.tobacco_habit || 'None';
  document.getElementById('pat-tobacco-freq').innerText = patient.tobacco_frequency || 'N/A';
  document.getElementById('pat-tobacco-dur').innerText = patient.tobacco_duration || 'N/A';
  document.getElementById('pat-betel-nut').innerText = patient.betel_nut || 'No';
  document.getElementById('pat-alcohol-habit').innerText = patient.alcohol_habit || 'None';
  document.getElementById('pat-alcohol-freq').innerText = patient.alcohol_frequency || 'N/A';
  document.getElementById('pat-alcohol-dur').innerText = patient.alcohol_duration || 'N/A';
  document.getElementById('pat-family-history').innerText = patient.family_history || 'No';
}

/**
 * Render clinical check-up records timeline
 */
function renderCheckups(checkups) {
  const container = document.getElementById('checkups-list-container');
  if (checkups.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
        No clinical check-up visits logged for this patient yet.
      </div>
    `;
    return;
  }

  container.innerHTML = checkups.map(c => {
    const checkupDate = new Date(c.checkup_date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const notesHtml = c.notes 
      ? `<div class="checkup-findings" style="margin-top: 4px; font-size: 13px; color: var(--text-muted);">
           <strong>Clinic Notes:</strong> ${escapeHtml(c.notes)}
         </div>`
      : '';

    const recsHtml = c.recommendations
      ? `<div style="margin-top: 8px;">
           <span class="checkup-recs">Recommendations: ${escapeHtml(c.recommendations)}</span>
         </div>`
      : '';

    return `
      <div class="checkup-node">
        <div class="checkup-meta">
          <span>${checkupDate}</span>
          <span>Logged by ${escapeHtml(c.doctor_name)}</span>
        </div>
        <div class="checkup-findings">
          <strong>Clinical Findings:</strong> ${escapeHtml(c.findings)}
        </div>
        ${notesHtml}
        ${recsHtml}
      </div>
    `;
  }).join('');
}

/**
 * Render patient medications list
 */
function renderMedications(medications) {
  const tableBody = document.getElementById('medications-table-body');
  if (medications.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No active medication prescriptions found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = medications.map(med => {
    const endDateFormatted = med.end_date ? formatDate(med.end_date) : 'Ongoing';
    return `
      <tr>
        <td data-label="Medication Name"><strong>${escapeHtml(med.medication_name)}</strong></td>
        <td data-label="Dosage">${escapeHtml(med.dosage)}</td>
        <td data-label="Frequency">${escapeHtml(med.frequency)}</td>
        <td data-label="Start Date">${formatDate(med.start_date)}</td>
        <td data-label="End Date">${endDateFormatted}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Tabs Switcher Initializer
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.profile-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all buttons and tabs
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

      // Activate current
      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });
}

/**
 * Modals Open/Close/Submit Controls
 */
function initModals(patientId) {
  // Modal Overlays
  const checkupModal = document.getElementById('checkup-modal');
  const medModal = document.getElementById('med-modal');

  // Open Buttons
  const openCheckupBtn = document.getElementById('btn-open-checkup-modal');
  const openMedBtn = document.getElementById('btn-open-med-modal');

  // Close Buttons
  const closeCheckupBtn = document.getElementById('btn-close-checkup-modal');
  const cancelCheckupBtn = document.getElementById('btn-cancel-checkup');
  const closeMedBtn = document.getElementById('btn-close-med-modal');
  const cancelMedBtn = document.getElementById('btn-cancel-med');

  // Forms
  const checkupForm = document.getElementById('checkup-form');
  const medForm = document.getElementById('med-form');

  // Errors Alerts
  const checkupError = document.getElementById('checkup-error-alert');
  const medError = document.getElementById('med-error-alert');

  // Pre-fill checkup date with current local time
  const checkupDateInput = document.getElementById('checkup_date');
  if (checkupDateInput) {
    const now = new Date();
    // Format to yyyy-MM-ddThh:mm for datetime-local value
    const tzoffset = now.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    checkupDateInput.value = localISOTime;
  }

  // Pre-fill medication start date with today
  const medStartInput = document.getElementById('med_start');
  if (medStartInput) {
    medStartInput.value = new Date().toISOString().split('T')[0];
  }

  // Open Checkup Modal
  openCheckupBtn.addEventListener('click', () => {
    if (checkupError) checkupError.style.display = 'none';
    checkupForm.reset();
    
    // Restore default date
    if (checkupDateInput) {
      const now = new Date();
      const tzoffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
      checkupDateInput.value = localISOTime;
    }
    
    checkupModal.classList.add('visible');
  });

  // Close Checkup Modal
  const closeCheckup = () => checkupModal.classList.remove('visible');
  closeCheckupBtn.addEventListener('click', closeCheckup);
  cancelCheckupBtn.addEventListener('click', closeCheckup);

  // Open Medication Modal
  openMedBtn.addEventListener('click', () => {
    if (medError) medError.style.display = 'none';
    medForm.reset();
    if (medStartInput) {
      medStartInput.value = new Date().toISOString().split('T')[0];
    }
    medModal.classList.add('visible');
  });

  // Close Medication Modal
  const closeMed = () => medModal.classList.remove('visible');
  closeMedBtn.addEventListener('click', closeMed);
  cancelMedBtn.addEventListener('click', closeMed);

  // Submit Checkup Form
  checkupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (checkupError) checkupError.style.display = 'none';

    const findings = document.getElementById('checkup_findings').value.trim();
    const notes = document.getElementById('checkup_notes').value.trim();
    const recommendations = document.getElementById('checkup_recs').value.trim();
    const checkupDateVal = document.getElementById('checkup_date').value;

    const submitBtn = document.getElementById('btn-submit-checkup');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';

    try {
      const response = await apiRequest(`/patients/${patientId}/checkups`, {
        method: 'POST',
        body: {
          findings,
          notes: notes || null,
          recommendations: recommendations || null,
          checkup_date: checkupDateVal ? new Date(checkupDateVal).toISOString() : new Date().toISOString()
        }
      });

      if (response.success) {
        closeCheckup();
        await fetchAndRenderProfile(patientId);
      }
    } catch (err) {
      console.error(err);
      if (checkupError) {
        checkupError.innerText = err.message || 'Failed to save check-up record.';
        checkupError.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Save Record';
    }
  });

  // Submit Medication Form
  medForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (medError) medError.style.display = 'none';

    const medicationName = document.getElementById('med_name').value.trim();
    const dosage = document.getElementById('med_dosage').value.trim();
    const frequency = document.getElementById('med_freq').value.trim();
    const startDate = document.getElementById('med_start').value;
    const endDate = document.getElementById('med_end').value;

    const submitBtn = document.getElementById('btn-submit-med');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Adding...';

    try {
      const response = await apiRequest(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: {
          medication_name: medicationName,
          dosage,
          frequency,
          start_date: startDate,
          end_date: endDate || null
        }
      });

      if (response.success) {
        closeMed();
        await fetchAndRenderProfile(patientId);
      }
    } catch (err) {
      console.error(err);
      if (medError) {
        medError.innerText = err.message || 'Failed to add medication prescription.';
        medError.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Add Prescription';
    }
  });
}

/**
 * Utility: Format Date string to standard readable date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Utility: Escape HTML strings to prevent XSS injection
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
