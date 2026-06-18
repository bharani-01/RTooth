import { apiRequest, getUserProfile, logoutUser, getSessionToken } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load Sidebar
  await loadDoctorSidebar();

  // Load Header info
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'doctor') {
    populateDoctorHeader(initialProfile);
  }

  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'doctor') {
      populateDoctorHeader(profile);
    }
  });

  // Fetch URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const visitId = urlParams.get('id');
  const patientId = urlParams.get('patient_id');

  if (!visitId || !patientId) {
    alert('Invalid Access: Missing visit or patient reference.');
    window.location.href = '/doctor/patients';
    return;
  }

  // Setup back button URL
  const backBtn = document.getElementById('btn-back-to-patient');
  if (backBtn) {
    backBtn.setAttribute('href', `/doctor/patient_profile?id=${patientId}`);
  }

  // Initial Fetch & Render
  await fetchAndRenderVisitDetails(patientId, visitId);

  // Initialize upload controls
  initUploadForm(patientId, visitId);
});

/**
 * Load doctor sidebar
 */
async function loadDoctorSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  try {
    const response = await fetch('/shared/doctor_sidebar.html');
    if (!response.ok) throw new Error('Failed to fetch sidebar');
    const html = await response.text();
    sidebarContainer.innerHTML = html;

    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href && (href.endsWith('patients') || href.endsWith('patients.html'))) {
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
 * Populate Doctor Info in navbar
 */
function populateDoctorHeader(profile) {
  const fullName = `Dr. ${profile.first_name} ${profile.last_name}`;
  const nameBadge = document.getElementById('doc-name-badge');
  const avatar = document.getElementById('doc-avatar');
  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
}

/**
 * Fetch Patient profile details and render specific visit
 */
async function fetchAndRenderVisitDetails(patientId, visitId) {
  try {
    const response = await apiRequest(`/patients/${patientId}/visits/${visitId}`);
    if (response.success) {
      const { patient, visit, prescriptions, reports } = response.data;
      
      // Demographics Card
      document.getElementById('pat-full-name').innerText = `${patient.first_name} ${patient.last_name}`;
      document.getElementById('pat-gender').innerText = patient.gender || 'Not Specified';
      document.getElementById('pat-dob').innerText = patient.date_of_birth ? formatDate(patient.date_of_birth) : 'N/A';
      document.getElementById('pat-lesion-location').innerText = patient.lesion_location || 'Not Specified';
      document.getElementById('pat-cancer-stage').innerText = patient.cancer_stage || 'Suspicious Lesion';

      // Render observations
      const checkupDate = new Date(visit.checkup_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      document.getElementById('visit-date-time').innerText = checkupDate;
      document.getElementById('visit-doctor-name').innerText = visit.doctor_name || 'Unknown Specialist';
      document.getElementById('visit-findings').innerText = visit.findings;
      
      if (visit.notes) {
        document.getElementById('visit-notes').innerText = visit.notes;
      } else {
        document.getElementById('visit-notes').innerText = 'No clinic notes recorded.';
      }

      if (visit.recommendations) {
        document.getElementById('visit-recs').innerText = visit.recommendations;
      } else {
        document.getElementById('visit-recs').innerText = 'No clinical recommendations provided.';
      }

      // Render medications
      renderMedicationsList(prescriptions);

      // Render reports
      renderReportsList(reports);
    }
  } catch (err) {
    console.error('Failed to load visit details:', err);
    alert('Error loading visit details.');
  }
}

/**
 * Render medications prescribed during this visit
 */
function renderMedicationsList(prescriptions) {
  const tbody = document.getElementById('medications-table-body');
  if (!tbody) return;

  if (!prescriptions || prescriptions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">
          No medications prescribed during this visit.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = prescriptions.map(med => {
    const endStr = med.end_date ? formatDate(med.end_date) : 'Ongoing';
    return `
      <tr>
        <td data-label="Medication Name"><strong>${escapeHtml(med.medication_name)}</strong></td>
        <td data-label="Dosage">${escapeHtml(med.dosage)}</td>
        <td data-label="Frequency">${escapeHtml(med.frequency)}</td>
        <td data-label="Start Date">${formatDate(med.start_date)}</td>
        <td data-label="End Date">${endStr}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Render report files list
 */
function renderReportsList(reports) {
  const listContainer = document.getElementById('visit-reports-list');
  const noReportsText = document.getElementById('no-reports-text');
  if (!listContainer) return;

  // Clear existing badges
  const existingBadges = listContainer.querySelectorAll('.report-badge');
  existingBadges.forEach(b => b.remove());

  if (!reports || reports.length === 0) {
    if (noReportsText) noReportsText.style.display = 'block';
    return;
  }

  if (noReportsText) noReportsText.style.display = 'none';

  reports.forEach(r => {
    let typeClass = 'type-other';
    const typeLower = r.report_type.toLowerCase();
    if (typeLower.includes('biopsy')) typeClass = 'type-biopsy';
    else if (typeLower.includes('histopathology')) typeClass = 'type-histopathology';
    else if (typeLower.includes('imaging')) typeClass = 'type-imaging';
    else if (typeLower.includes('blood')) typeClass = 'type-blood';

    const badge = document.createElement('a');
    badge.href = r.file_url;
    badge.target = '_blank';
    badge.className = `report-badge ${typeClass}`;
    badge.title = `View ${escapeHtml(r.file_name)}`;
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; flex-shrink: 0;">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span><strong>${escapeHtml(r.report_type)}:</strong> ${escapeHtml(r.file_name)}</span>
    `;

    listContainer.appendChild(badge);
  });
}

/**
 * Initialize Direct File Upload Form
 */
function initUploadForm(patientId, visitId) {
  const form = document.getElementById('upload-additional-reports-form');
  const addRowBtn = document.getElementById('btn-add-more-upload-rows');
  const rowsContainer = document.getElementById('reports-upload-rows-container');
  const errorAlert = document.getElementById('upload-error-alert');
  const successAlert = document.getElementById('upload-success-alert');

  if (!form || !addRowBtn || !rowsContainer) return;

  // Add Row button
  addRowBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'dynamic-report-row';
    row.style.gridTemplateColumns = '2.5fr 2fr auto';
    row.innerHTML = `
      <input type="file" class="form-input report-file" accept=".pdf,image/*" required style="padding: 6px 10px;">
      <select class="form-input report-type" required style="padding: 8px 10px;">
        <option value="Biopsy">Biopsy Report</option>
        <option value="Histopathology">Histopathology Report</option>
        <option value="Imaging">Imaging Report (X-Ray, MRI, CT)</option>
        <option value="Blood Report">Blood Report</option>
        <option value="Other">Other / Clinical Document</option>
      </select>
      <button type="button" class="btn-delete-row" title="Remove File">
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    `;

    row.querySelector('.btn-delete-row').addEventListener('click', () => {
      row.remove();
    });

    rowsContainer.appendChild(row);
  });

  // Submit Upload Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';

    const submitBtn = document.getElementById('btn-submit-upload-reports');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Uploading files...';

    try {
      const formData = new FormData();
      const rows = rowsContainer.querySelectorAll('.dynamic-report-row');
      const typesList = [];

      rows.forEach(row => {
        const fileInput = row.querySelector('.report-file');
        const typeSelect = row.querySelector('.report-type');

        if (fileInput.files && fileInput.files[0]) {
          formData.append('report_files', fileInput.files[0]);
          typesList.push(typeSelect.value);
        }
      });

      if (typesList.length === 0) {
        throw new Error('Please select at least one file to upload.');
      }

      formData.append('report_types', JSON.stringify(typesList));

      const token = getSessionToken();
      const response = await fetch(`/api/v1/patients/${patientId}/visits/${visitId}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to upload reports.');
      }

      // Success feedback
      if (successAlert) {
        successAlert.innerText = 'Clinical reports uploaded and attached successfully!';
        successAlert.style.display = 'block';
      }

      // Reset form file list
      form.reset();
      
      // Delete all but first row
      const allRows = rowsContainer.querySelectorAll('.dynamic-report-row');
      allRows.forEach((row, idx) => {
        if (idx > 0) row.remove();
      });

      // Fetch and re-render visit details to show new reports in UI
      await fetchAndRenderVisitDetails(patientId, visitId);

    } catch (err) {
      console.error(err);
      if (errorAlert) {
        errorAlert.innerText = err.message || 'Error occurred while uploading files.';
        errorAlert.style.display = 'block';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Upload & Attach Documents';
    }
  });
}

/**
 * Utility: Format Date string
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
