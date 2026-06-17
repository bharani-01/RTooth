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

  // Pre-load from localStorage if available
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientDetails(initialProfile);
    fetchAndRenderFullProfile(initialProfile.id);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientDetails(profile);
      fetchAndRenderFullProfile(profile.id);
    }
  });

  // Init tabs switching if present
  initTabs();

  if (window.initMobileMenu) {
    window.initMobileMenu();
  }
});

/**
 * Fetch and Render the Patient Profile
 */
async function fetchAndRenderFullProfile(patientId) {
  try {
    const response = await apiRequest('/patients/me');
    if (response.success) {
      const patient = response.data.profile;
      
      // Update UI with latest profile fields
      populatePatientDetails(patient);
      
      // Render timeline checkups and medications if we are on index dashboard
      const checkupsContainer = document.getElementById('checkups-list-container');
      if (checkupsContainer) {
        renderCheckups(patient.checkups);
      }
      
      const medicationsTable = document.getElementById('medications-table-body');
      if (medicationsTable) {
        renderMedications(patient.medications);
      }
      
      // Populate next scheduled review (if any)
      const nextVisitDate = document.getElementById('next-visit-date');
      if (nextVisitDate) {
        if (patient.checkups && patient.checkups.length > 0) {
          // Let's assume the most recent checkup is the last oncology review date
          const lastCheckup = patient.checkups[0];
          const reviewDate = new Date(lastCheckup.checkup_date);
          nextVisitDate.innerText = reviewDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        } else {
          nextVisitDate.innerText = 'None Logged';
        }
      }
    }
  } catch (error) {
    console.error('Error fetching full patient clinical profile:', error.message);
  }
}

/**
 * Populate UI with Patient's profile fields
 */
function populatePatientDetails(profile) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  
  // Set headers & badges
  const nameBadge = document.getElementById('patient-name-badge');
  const avatar = document.getElementById('patient-avatar');
  const welcomeTitle = document.getElementById('patient-welcome-title');

  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  if (welcomeTitle) welcomeTitle.innerText = `Welcome, ${profile.first_name}`;

  // Set Profile section fields
  const pName = document.getElementById('pat-full-name');
  const pEmail = document.getElementById('pat-email');
  const pPhone = document.getElementById('pat-phone');
  const pDob = document.getElementById('pat-dob');
  const pGender = document.getElementById('pat-gender');
  const pAddress = document.getElementById('pat-address');
  
  const pStage = document.getElementById('pat-cancer-stage');
  const statStage = document.getElementById('stat-cancer-stage');
  const pLocation = document.getElementById('pat-lesion-location');
  const statLocation = document.getElementById('stat-lesion-location');
  const pRisks = document.getElementById('pat-risk-factors');

  if (pName) pName.innerText = fullName;
  if (pEmail) pEmail.innerText = profile.email || 'N/A';
  if (pPhone) pPhone.innerText = profile.phone || 'Not Provided';
  if (pAddress) pAddress.innerText = profile.address || 'Not Provided';
  
  // Format Date of Birth for presentation
  if (pDob) {
    if (profile.date_of_birth) {
      pDob.innerText = formatDate(profile.date_of_birth);
    } else {
      pDob.innerText = 'Not Provided';
    }
  }

  if (pGender) pGender.innerText = profile.gender || 'Not Specified';
  
  // Set oncology details
  if (pStage) pStage.innerText = profile.cancer_stage || 'Suspicious Lesion';
  if (statStage) statStage.innerText = profile.cancer_stage || 'Suspicious Lesion';
  if (pLocation) pLocation.innerText = profile.lesion_location || 'Not Specified';
  if (statLocation) statLocation.innerText = profile.lesion_location || 'Under Watch';
  if (pRisks) pRisks.innerText = profile.risk_factors || 'None';

  // Set Attending Doctor details
  const attendingDocName = document.getElementById('attending-doctor-name');
  const attendingDocSpec = document.getElementById('attending-doctor-spec');

  if (profile.doctor) {
    if (attendingDocName) attendingDocName.innerText = `Dr. ${profile.doctor.first_name} ${profile.doctor.last_name}`;
    if (attendingDocSpec) attendingDocSpec.innerText = profile.doctor.specialization || 'Oral Oncology Specialist';
  } else {
    if (attendingDocName) attendingDocName.innerText = 'No Doctor Assigned';
    if (attendingDocSpec) attendingDocSpec.innerText = 'General Oncology Care';
  }

  // Set Lifestyle Habits details
  const pTobaccoHabit = document.getElementById('pat-tobacco-habit');
  const pTobaccoFreq = document.getElementById('pat-tobacco-freq');
  const pTobaccoDur = document.getElementById('pat-tobacco-dur');
  const pAlcoholHabit = document.getElementById('pat-alcohol-habit');
  const pAlcoholFreq = document.getElementById('pat-alcohol-freq');
  const pAlcoholDur = document.getElementById('pat-alcohol-dur');
  const pBetelNut = document.getElementById('pat-betel-nut');
  const pFamilyHist = document.getElementById('pat-family-history');

  if (pTobaccoHabit) pTobaccoHabit.innerText = profile.tobacco_habit || 'None';
  if (pTobaccoFreq) pTobaccoFreq.innerText = profile.tobacco_frequency || 'N/A';
  if (pTobaccoDur) pTobaccoDur.innerText = profile.tobacco_duration || 'N/A';
  if (pAlcoholHabit) pAlcoholHabit.innerText = profile.alcohol_habit || 'None';
  if (pAlcoholFreq) pAlcoholFreq.innerText = profile.alcohol_frequency || 'N/A';
  if (pAlcoholDur) pAlcoholDur.innerText = profile.alcohol_duration || 'N/A';
  if (pBetelNut) pBetelNut.innerText = profile.betel_nut || 'No';
  if (pFamilyHist) pFamilyHist.innerText = profile.family_history || 'No';
}

/**
 * Render clinical check-up records timeline for the patient
 */
function renderCheckups(checkups) {
  const container = document.getElementById('checkups-list-container');
  if (!container) return;
  
  if (!checkups || checkups.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
        No clinical check-up visits logged in your history yet.
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

    // Render Prescriptions if present
    let medsHtml = '';
    if (c.prescriptions && c.prescriptions.length > 0) {
      const medsItems = c.prescriptions.map(m => {
        const endStr = m.end_date ? ` until ${formatDate(m.end_date)}` : ' (Ongoing)';
        return `<li><strong>${escapeHtml(m.medication_name)}</strong> - ${escapeHtml(m.dosage)} (${escapeHtml(m.frequency)})${endStr}</li>`;
      }).join('');
      
      medsHtml = `
        <div class="visit-prescriptions-list">
          <div style="font-weight: 600; font-size: 12.5px; color: var(--text-dark); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; flex-shrink:0;"><path d="M4.5 16.5c-1.5 1.25-2.5 3.16-2.5 5.5h20c0-2.34-1-4.25-2.5-5.5"/><circle cx="12" cy="7" r="4"/><path d="M12 11v5m-2-2h4"/></svg>
            Prescribed Medications:
          </div>
          <ul style="margin-left: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.6; list-style-type: disc;">
            ${medsItems}
          </ul>
        </div>
      `;
    }

    // Render Reports if present
    let reportsHtml = '';
    if (c.reports && c.reports.length > 0) {
      const reportsItems = c.reports.map(r => {
        let typeClass = 'type-other';
        const typeLower = r.report_type.toLowerCase();
        if (typeLower.includes('biopsy')) typeClass = 'type-biopsy';
        else if (typeLower.includes('histopathology')) typeClass = 'type-histopathology';
        else if (typeLower.includes('imaging')) typeClass = 'type-imaging';
        else if (typeLower.includes('blood')) typeClass = 'type-blood';

        return `
          <a href="${r.file_url}" target="_blank" class="report-badge ${typeClass}" title="View ${escapeHtml(r.file_name)}">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; flex-shrink: 0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span><strong>${escapeHtml(r.report_type)}:</strong> ${escapeHtml(r.file_name)}</span>
          </a>
        `;
      }).join('');

      reportsHtml = `
        <div class="visit-reports-list">
          ${reportsItems}
        </div>
      `;
    }

    return `
      <div class="checkup-node">
        <div class="checkup-meta">
          <span>${checkupDate}</span>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <span>Logged by ${escapeHtml(c.doctor_name)}</span>
            <a href="/patient/visit?id=${c.id}" class="btn btn-secondary" style="font-size: 11px; padding: 2px 8px; height: auto; font-weight: 500; text-decoration: none;">View Full Record</a>
          </div>
        </div>
        <div class="checkup-findings">
          <strong>Clinical Findings:</strong> ${escapeHtml(c.findings)}
        </div>
        ${notesHtml}
        ${recsHtml}
        ${medsHtml}
        ${reportsHtml}
      </div>
    `;
  }).join('');
}

/**
 * Render active medications list for patient dashboard
 */
function renderMedications(medications) {
  const tableBody = document.getElementById('medications-table-body');
  if (!tableBody) return;

  if (!medications || medications.length === 0) {
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
