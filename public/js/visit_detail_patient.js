import { apiRequest, getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Bind Logout Button
  const logoutBtn = document.getElementById('patient-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to end your patient portal session?')) {
        await logoutUser();
      }
    });
  }

  // Pre-load patient details from localStorage if available
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientHeader(initialProfile);
    initVisitDetails(initialProfile.id);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientHeader(profile);
      initVisitDetails(profile.id);
    }
  });

  if (window.initMobileMenu) {
    window.initMobileMenu();
  }
});

/**
 * Populate Patient Info in navbar
 */
function populatePatientHeader(profile) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const nameBadge = document.getElementById('patient-name-badge');
  const avatar = document.getElementById('patient-avatar');
  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
}

/**
 * Fetch data and populate visit details
 */
async function initVisitDetails(patientId) {
  const urlParams = new URLSearchParams(window.location.search);
  const visitId = urlParams.get('id');

  if (!visitId) {
    alert('Invalid Access: Missing visit reference.');
    window.location.href = '/patient';
    return;
  }

  try {
    const response = await apiRequest(`/patients/me/visits/${visitId}`);
    if (response.success) {
      const { patient, visit, prescriptions, reports } = response.data;

      // Render demographics info
      document.getElementById('pat-full-name').innerText = `${patient.first_name} ${patient.last_name}`;
      document.getElementById('pat-gender').innerText = patient.gender || 'Not Specified';
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
        document.getElementById('visit-notes').innerText = 'No notes logged for this visit.';
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
 * Render medications list
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
 * Render reports list
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
 * Utility: Format Date
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
 * Utility: Escape HTML
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
