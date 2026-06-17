import { apiRequest, getUserProfile, logoutUser, getSessionToken } from './api.js';

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
      renderCheckups(patient.checkups, patientId);
      renderMedications(patient.medications);
      await fetchAndRenderSymptomLogs(patientId);
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
  const initials = (patient.first_name?.[0] || '') + (patient.last_name?.[0] || '');

  // ── Hero card ──
  const heroAvatar = document.getElementById('hero-avatar');
  if (heroAvatar) heroAvatar.textContent = initials.toUpperCase();

  const heroName = document.getElementById('pat-full-name');
  if (heroName) heroName.textContent = name;

  const breadcrumb = document.getElementById('breadcrumb-name');
  if (breadcrumb) breadcrumb.textContent = name;

  // Status badge
  const statusPill = document.getElementById('patient-status-pill');
  if (statusPill) {
    if (patient.status === 'draft') {
      statusPill.textContent = 'Draft';
      statusPill.className = 'status-badge badge-draft';
    } else {
      statusPill.textContent = 'Active';
      statusPill.className = 'status-badge badge-active';
    }
  }

  // Meta chips (clear skeleton spans, set text)
  const age = patient.date_of_birth ? calcAge(patient.date_of_birth) : 'N/A';
  const metaCode = document.getElementById('meta-code');
  if (metaCode) metaCode.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
    ${patient.patient_code || '—'}`;

  const metaAge = document.getElementById('meta-age');
  if (metaAge) metaAge.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a7 7 0 0 1 13 0"/></svg>
    ${patient.gender || ''} ${age !== 'N/A' ? '· ' + age + ' yrs' : ''}`.trim();

  const metaStage = document.getElementById('meta-stage');
  if (metaStage) {
    const stageColor = getStageColor(patient.cancer_stage);
    metaStage.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ${patient.cancer_stage || 'Suspicious Lesion'}`;
    metaStage.style.color = stageColor;
    metaStage.style.borderColor = stageColor + '44';
    metaStage.style.backgroundColor = stageColor + '10';
  }

  const metaLoc = document.getElementById('meta-location');
  if (metaLoc) metaLoc.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    ${patient.lesion_location || '—'}`;

  // Avatar color by stage
  const stageColor = getStageColor(patient.cancer_stage);
  if (heroAvatar) {
    heroAvatar.style.backgroundColor = stageColor + '18';
    heroAvatar.style.color = stageColor;
  }

  // Demographic fields
  document.getElementById('pat-email').textContent     = patient.email || '—';
  document.getElementById('pat-phone').textContent     = patient.phone || '—';
  document.getElementById('pat-address').textContent   = patient.address || '—';
  document.getElementById('pat-dob').textContent       = patient.date_of_birth ? formatDate(patient.date_of_birth) : '—';
  document.getElementById('pat-gender').textContent    = patient.gender || '—';
  document.getElementById('pat-lesion-location').textContent = patient.lesion_location || '—';
  document.getElementById('pat-cancer-stage').textContent   = patient.cancer_stage || 'Suspicious Lesion';
  document.getElementById('pat-risk-factors').textContent   = patient.risk_factors || '—';
}

function calcAge(dob) {
  try {
    const d = new Date(dob);
    if (isNaN(d)) return 'N/A';
    return Math.abs(new Date(Date.now() - d).getUTCFullYear() - 1970);
  } catch { return 'N/A'; }
}

function getStageColor(stage) {
  const s = (stage || '').toLowerCase();
  if (s.includes('stage iv') || s.includes('stage iii')) return '#dc2626';
  if (s.includes('stage ii')) return '#ea580c';
  if (s.includes('stage i')) return '#0d9488';
  if (s.includes('dysplasia')) return '#d97706';
  return '#64748b';
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
function renderCheckups(checkups, patientId) {
  const container = document.getElementById('checkups-list-container');
  if (checkups.length === 0) {
    container.innerHTML = `
      <div style="color:#8a94a6; font-size:13.5px; text-align:center; padding:32px;">
        No consultation visits logged for this patient yet.
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

    const followupHtml = c.next_checkup_date
      ? `<div style="margin-top:10px;">
           <div class="followup-box">
             <div style="font-weight:600; color:#0d9488; font-size:11.5px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
               <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5;flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               Next Follow-up
             </div>
             <div><strong>Date:</strong> ${formatDate(c.next_checkup_date)}</div>
             ${c.followup_interval ? `<div><strong>Interval:</strong> ${escapeHtml(c.followup_interval)}</div>` : ''}
             ${c.followup_notes   ? `<div><strong>Notes:</strong> ${escapeHtml(c.followup_notes)}</div>` : ''}
           </div>
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
            <button class="btn btn-secondary btn-view-visit-popup" data-visit-id="${c.id}" style="font-size: 11px; padding: 2px 8px; height: auto; font-weight: 500;">View Full Record</button>
          </div>
        </div>
        <div class="checkup-findings">
          <strong>Clinical Findings:</strong> ${escapeHtml(c.findings)}
        </div>
        ${notesHtml}
        ${recsHtml}
        ${followupHtml}
        ${medsHtml}
        ${reportsHtml}
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
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No active medication prescriptions found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = medications.map(med => {
    const endDateFormatted = med.end_date ? formatDate(med.end_date) : 'Ongoing';
    const rawStart = med.start_date ? med.start_date.split('T')[0] : '';
    const rawEnd = med.end_date ? med.end_date.split('T')[0] : '';
    return `
      <tr>
        <td data-label="Medication Name"><strong>${escapeHtml(med.medication_name)}</strong></td>
        <td data-label="Dosage">${escapeHtml(med.dosage)}</td>
        <td data-label="Frequency">${escapeHtml(med.frequency)}</td>
        <td data-label="Start Date">${formatDate(med.start_date)}</td>
        <td data-label="End Date">${endDateFormatted}</td>
        <td data-label="Actions">
          <button class="btn btn-secondary btn-edit-med" style="padding: 4px 8px; font-size: 11.5px; height: auto;" 
                  data-med-id="${med.id}"
                  data-med-name="${escapeHtml(med.medication_name)}"
                  data-med-dosage="${escapeHtml(med.dosage)}"
                  data-med-freq="${escapeHtml(med.frequency)}"
                  data-med-start="${rawStart}"
                  data-med-end="${rawEnd}">
            Modify
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind click delegation handler once on medications table body
  if (tableBody && !tableBody.dataset.listenerAttached) {
    tableBody.dataset.listenerAttached = 'true';
    tableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-med');
      if (editBtn) {
        openEditMedicationModal(editBtn.dataset);
      }
    });
  }
}

/**
 * Open modify medication modal and prefill data
 */
function openEditMedicationModal(data) {
  const modal = document.getElementById('edit-med-modal');
  const errorAlert = document.getElementById('edit-med-error-alert');
  if (errorAlert) errorAlert.style.display = 'none';

  document.getElementById('edit_med_id').value = data.medId;
  document.getElementById('edit_med_name').value = data.medName;
  document.getElementById('edit_med_dosage').value = data.medDosage;
  document.getElementById('edit_med_freq').value = data.medFreq;
  document.getElementById('edit_med_start').value = data.medStart;
  document.getElementById('edit_med_end').value = data.medEnd || '';

  if (modal) modal.classList.add('visible');
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
  if (openCheckupBtn && checkupModal) {
    openCheckupBtn.addEventListener('click', () => {
      if (checkupError) checkupError.style.display = 'none';
      if (checkupForm) checkupForm.reset();
      
      // Restore default date
      if (checkupDateInput) {
        const now = new Date();
        const tzoffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
        checkupDateInput.value = localISOTime;
      }
      
      checkupModal.classList.add('visible');
    });
  }

  // Close Checkup Modal
  const closeCheckup = () => checkupModal && checkupModal.classList.remove('visible');
  if (closeCheckupBtn) closeCheckupBtn.addEventListener('click', closeCheckup);
  if (cancelCheckupBtn) cancelCheckupBtn.addEventListener('click', closeCheckup);

  // Open Medication Modal
  if (openMedBtn && medModal) {
    openMedBtn.addEventListener('click', () => {
      if (medError) medError.style.display = 'none';
      if (medForm) medForm.reset();
      if (medStartInput) {
        medStartInput.value = new Date().toISOString().split('T')[0];
      }
      medModal.classList.add('visible');
    });
  }

  // Close Medication Modal
  const closeMed = () => medModal && medModal.classList.remove('visible');
  if (closeMedBtn) closeMedBtn.addEventListener('click', closeMed);
  if (cancelMedBtn) cancelMedBtn.addEventListener('click', closeMed);

  // Submit Checkup Form
  if (checkupForm) {
    checkupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (checkupError) checkupError.style.display = 'none';

      const findings = document.getElementById('checkup_findings').value.trim();
      const notes = document.getElementById('checkup_notes').value.trim();
      const recommendations = document.getElementById('checkup_recs').value.trim();
      const checkupDateVal = document.getElementById('checkup_date').value;

      const submitBtn = document.getElementById('btn-submit-checkup');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';
      }

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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save Record';
        }
      }
    });
  }

  // Submit Medication Form
  if (medForm) {
    medForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (medError) medError.style.display = 'none';

      const medicationName = document.getElementById('med_name').value.trim();
      const dosage = document.getElementById('med_dosage').value.trim();
      const frequency = document.getElementById('med_freq').value.trim();
      const startDate = document.getElementById('med_start').value;
      const endDate = document.getElementById('med_end').value;

      const submitBtn = document.getElementById('btn-submit-med');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Adding...';
      }

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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Add Prescription';
        }
      }
    });
  }

  // Edit Medication Modal Controls
  const editMedModal = document.getElementById('edit-med-modal');
  const closeEditMedBtn = document.getElementById('btn-close-edit-med-modal');
  const cancelEditMedBtn = document.getElementById('btn-cancel-edit-med');
  const editMedForm = document.getElementById('edit-med-form');
  const deleteMedActionBtn = document.getElementById('btn-delete-med-action');
  const editMedError = document.getElementById('edit-med-error-alert');

  const closeEditMed = () => editMedModal && editMedModal.classList.remove('visible');
  if (closeEditMedBtn) closeEditMedBtn.addEventListener('click', closeEditMed);
  if (cancelEditMedBtn) cancelEditMedBtn.addEventListener('click', closeEditMed);

  // Submit Edit Medication Form
  if (editMedForm) {
    editMedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editMedError) editMedError.style.display = 'none';

      const medId = document.getElementById('edit_med_id').value;
      const medicationName = document.getElementById('edit_med_name').value.trim();
      const dosage = document.getElementById('edit_med_dosage').value.trim();
      const frequency = document.getElementById('edit_med_freq').value.trim();
      const startDate = document.getElementById('edit_med_start').value;
      const endDate = document.getElementById('edit_med_end').value;

      const submitBtn = document.getElementById('btn-submit-edit-med');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Saving...';
      }

      try {
        const response = await apiRequest(`/patients/${patientId}/medications/${medId}`, {
          method: 'PUT',
          body: {
            medication_name: medicationName,
            dosage,
            frequency,
            start_date: startDate,
            end_date: endDate || null
          }
        });

        if (response.success) {
          closeEditMed();
          await fetchAndRenderProfile(patientId);
        }
      } catch (err) {
        console.error(err);
        if (editMedError) {
          editMedError.innerText = err.message || 'Failed to update medication prescription.';
          editMedError.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save Changes';
        }
      }
    });
  }

  // Delete Prescription Action
  if (deleteMedActionBtn) {
    deleteMedActionBtn.addEventListener('click', async () => {
      const medId = document.getElementById('edit_med_id').value;
      if (!confirm('Are you sure you want to permanently delete this medication prescription?')) {
        return;
      }

      deleteMedActionBtn.disabled = true;
      deleteMedActionBtn.innerText = 'Deleting...';

      try {
        const response = await apiRequest(`/patients/${patientId}/medications/${medId}`, {
          method: 'DELETE'
        });

        if (response.success) {
          closeEditMed();
          await fetchAndRenderProfile(patientId);
        }
      } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to delete medication prescription.');
      } finally {
        deleteMedActionBtn.disabled = false;
        deleteMedActionBtn.innerText = 'Delete Prescription';
      }
    });
  }

  // ----------------- VISIT MODAL LOGIC -----------------
  const visitModal = document.getElementById('visit-modal');
  const openVisitBtn = document.getElementById('btn-open-visit-modal');
  const closeVisitBtn = document.getElementById('btn-close-visit-modal');
  const cancelVisitBtn = document.getElementById('btn-cancel-visit');
  const visitForm = document.getElementById('visit-form');
  const visitError = document.getElementById('visit-error-alert');

  const addMedBtn = document.getElementById('btn-add-visit-med');
  const addReportBtn = document.getElementById('btn-add-visit-report');
  const medsContainer = document.getElementById('visit-meds-container');
  const reportsContainer = document.getElementById('visit-reports-container');
  const noMedsText = document.getElementById('no-meds-text');
  const noReportsText = document.getElementById('no-reports-text');

  // Prefill visit date
  const visitDateInput = document.getElementById('visit_date');
  if (visitDateInput) {
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    visitDateInput.value = localISOTime;
  }

  // Open Visit Modal
  const openModal = () => {
    if (visitError) visitError.style.display = 'none';
    if (visitForm) {
      visitForm.reset();
      // Clear dynamic meds
      const medRows = medsContainer.querySelectorAll('.dynamic-row');
      medRows.forEach(row => row.remove());
      if (noMedsText) noMedsText.style.display = 'block';

      // Clear dynamic report uploads
      const reportRows = reportsContainer.querySelectorAll('.dynamic-report-row');
      reportRows.forEach(row => row.remove());
      if (noReportsText) noReportsText.style.display = 'block';

      // Prefill date time
      if (visitDateInput) {
        const now = new Date();
        const tzoffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
        visitDateInput.value = localISOTime;
      }
    }
    if (visitModal) visitModal.classList.add('visible');
  };

  if (openVisitBtn)  openVisitBtn.addEventListener('click', openModal);

  // Second "Record Visit" button inside the tab toolbar
  const openVisitBtn2 = document.getElementById('btn-open-visit-modal-2');
  if (openVisitBtn2) openVisitBtn2.addEventListener('click', openModal);


  // Close Visit Modal
  const closeVisit = () => {
    if (visitModal) visitModal.classList.remove('visible');
  };
  if (closeVisitBtn) closeVisitBtn.addEventListener('click', closeVisit);
  if (cancelVisitBtn) cancelVisitBtn.addEventListener('click', closeVisit);

  // Add Prescription Row Dynamically
  if (addMedBtn) {
    addMedBtn.addEventListener('click', () => {
      if (noMedsText) noMedsText.style.display = 'none';

      const row = document.createElement('div');
      row.className = 'dynamic-row';

      const todayStr = new Date().toISOString().split('T')[0];

      row.innerHTML = `
        <input type="text" class="form-input med-name" placeholder="Medication Name" required style="padding: 8px 10px;">
        <input type="text" class="form-input med-dosage" placeholder="e.g. 500mg" required style="padding: 8px 10px;">
        <input type="text" class="form-input med-freq" placeholder="e.g. Daily" required style="padding: 8px 10px;">
        <input type="date" class="form-input med-start" required style="padding: 8px 10px;" value="${todayStr}">
        <input type="date" class="form-input med-end" style="padding: 8px 10px;" placeholder="End Date">
        <button type="button" class="btn-delete-row" title="Remove Prescription">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;

      // Bind delete button
      row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
        if (medsContainer.querySelectorAll('.dynamic-row').length === 0) {
          if (noMedsText) noMedsText.style.display = 'block';
        }
      });

      medsContainer.appendChild(row);
    });
  }

  // Add Report Upload Row Dynamically
  if (addReportBtn) {
    addReportBtn.addEventListener('click', () => {
      if (noReportsText) noReportsText.style.display = 'none';

      const row = document.createElement('div');
      row.className = 'dynamic-report-row';

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
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;

      // Bind delete button
      row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
        if (reportsContainer.querySelectorAll('.dynamic-report-row').length === 0) {
          if (noReportsText) noReportsText.style.display = 'block';
        }
      });

      reportsContainer.appendChild(row);
    });
  }

  // Submit Visit Form (Multipart Form Data)
  if (visitForm) {
    visitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (visitError) visitError.style.display = 'none';

      const findings = document.getElementById('visit_findings').value.trim();
      const notes = document.getElementById('visit_notes').value.trim();
      const recommendations = document.getElementById('visit_recs').value.trim();
      const visitDateVal = document.getElementById('visit_date').value;
      const nextCheckupDate = document.getElementById('visit_next_date').value;
      const followupInterval = document.getElementById('visit_followup_interval').value;
      const followupNotes = document.getElementById('visit_followup_notes').value.trim();

      const submitBtn = document.getElementById('btn-submit-visit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Recording Visit...';

      try {
        const formData = new FormData();
        formData.append('findings', findings);
        formData.append('notes', notes || '');
        formData.append('recommendations', recommendations || '');
        formData.append('checkup_date', visitDateVal ? new Date(visitDateVal).toISOString() : new Date().toISOString());
        formData.append('next_checkup_date', nextCheckupDate || '');
        formData.append('followup_interval', followupInterval || '');
        formData.append('followup_notes', followupNotes || '');

        // Extract prescriptions
        const prescriptionsList = [];
        const medRows = medsContainer.querySelectorAll('.dynamic-row');
        medRows.forEach(row => {
          prescriptionsList.push({
            medication_name: row.querySelector('.med-name').value.trim(),
            dosage: row.querySelector('.med-dosage').value.trim(),
            frequency: row.querySelector('.med-freq').value.trim(),
            start_date: row.querySelector('.med-start').value,
            end_date: row.querySelector('.med-end').value || null
          });
        });
        formData.append('prescriptions', JSON.stringify(prescriptionsList));

        // Extract files and types
        const reportRows = reportsContainer.querySelectorAll('.dynamic-report-row');
        const reportTypesList = [];
        reportRows.forEach(row => {
          const fileInput = row.querySelector('.report-file');
          if (fileInput.files && fileInput.files[0]) {
            formData.append('report_files', fileInput.files[0]);
            reportTypesList.push(row.querySelector('.report-type').value);
          }
        });
        formData.append('report_types', JSON.stringify(reportTypesList));

        // Send Multipart Request using token
        const token = getSessionToken();
        const fetchResponse = await fetch(`/api/v1/patients/${patientId}/visits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const result = await fetchResponse.json();
        if (!fetchResponse.ok || !result.success) {
          throw new Error(result.message || 'Failed to record visit.');
        }

        closeVisit();
        await fetchAndRenderProfile(patientId);
      } catch (err) {
        console.error(err);
        if (visitError) {
          visitError.innerText = err.message || 'Failed to save visit record.';
          visitError.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Record Consultation Visit';
      }
    });
  }

  // ----------------- VISIT DETAILS MODAL LOGIC -----------------
  const visitDetailsModal = document.getElementById('visit-details-modal');
  const closeVisitDetailsBtn = document.getElementById('btn-close-visit-details-modal');
  const popupUploadForm = document.getElementById('popup-upload-reports-form');
  const popupAddRowBtn = document.getElementById('btn-popup-add-more-rows');
  const popupRowsContainer = document.getElementById('popup-upload-rows-container');

  // Event Delegation for View Full Record button on checkups list
  const checkupsContainer = document.getElementById('checkups-list-container');
  if (checkupsContainer && !checkupsContainer.dataset.listenerAttached) {
    checkupsContainer.dataset.listenerAttached = 'true';
    checkupsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view-visit-popup');
      if (btn) {
        const visitId = btn.dataset.visitId;
        openVisitDetailsPopup(visitId, patientId);
      }
    });
  }

  // Close details modal
  if (closeVisitDetailsBtn) {
    closeVisitDetailsBtn.addEventListener('click', () => {
      if (visitDetailsModal) visitDetailsModal.classList.remove('visible');
    });
  }

  // Popup open helper
  const openVisitDetailsPopup = (visitId, patId) => {
    // Reset modal content to loading state
    document.getElementById('popup-visit-date-time').innerText = 'Loading...';
    document.getElementById('popup-visit-doctor-name').innerText = 'Loading...';
    document.getElementById('popup-visit-findings').innerText = 'Loading...';
    document.getElementById('popup-visit-notes').innerText = 'No notes logged.';
    document.getElementById('popup-visit-recs').innerText = 'Loading...';
    
    const followupContainer = document.getElementById('popup-visit-followup-container');
    if (followupContainer) followupContainer.style.display = 'none';
    
    const medsBody = document.getElementById('popup-meds-body');
    if (medsBody) medsBody.innerHTML = '';
    
    const reportsList = document.getElementById('popup-reports-list');
    if (reportsList) reportsList.innerHTML = '';

    document.getElementById('popup_upload_visit_id').value = visitId;
    
    const errorAlert = document.getElementById('popup-upload-error');
    const successAlert = document.getElementById('popup-upload-success');
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';

    if (popupUploadForm) {
      popupUploadForm.reset();
      // Clear dynamic upload rows
      const allRows = popupRowsContainer.querySelectorAll('.dynamic-report-row');
      allRows.forEach((row, idx) => {
        if (idx > 0) row.remove();
      });
    }

    if (visitDetailsModal) visitDetailsModal.classList.add('visible');

    fetchAndRenderVisitDetailsInPopup(patId, visitId);
  };

  // Popup Upload Form - Add dynamic file row
  if (popupAddRowBtn && popupRowsContainer) {
    popupAddRowBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'dynamic-report-row';
      row.style.gridTemplateColumns = '2.5fr 2fr auto';
      row.style.padding = '6px 8px';
      row.style.alignItems = 'center';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.border = '1px solid var(--border-color)';
      row.style.backgroundColor = 'var(--bg-subtle)';
      row.innerHTML = `
        <input type="file" class="form-input popup-report-file" accept=".pdf,image/*" required style="padding: 4px 8px; font-size: 12.5px; border: none; background: transparent;">
        <select class="form-input popup-report-type" required style="padding: 6px 8px; font-size: 12.5px;">
          <option value="Biopsy">Biopsy Report</option>
          <option value="Histopathology">Histopathology Report</option>
          <option value="Imaging">Imaging Report (X-Ray, MRI, CT)</option>
          <option value="Blood Report">Blood Report</option>
          <option value="Other">Other / Clinical Document</option>
        </select>
        <button type="button" class="btn-delete-row" title="Remove File" style="padding: 2px; background: none; border: none; cursor: pointer; color: var(--danger); display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;
      row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
      });
      popupRowsContainer.appendChild(row);
    });
  }

  // Submit additional files from popup
  if (popupUploadForm) {
    popupUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const visitId = document.getElementById('popup_upload_visit_id').value;
      const errorAlert = document.getElementById('popup-upload-error');
      const successAlert = document.getElementById('popup-upload-success');
      const submitBtn = document.getElementById('btn-popup-submit-upload');

      if (errorAlert) errorAlert.style.display = 'none';
      if (successAlert) successAlert.style.display = 'none';

      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading files...';

      try {
        const formData = new FormData();
        const rows = popupRowsContainer.querySelectorAll('.dynamic-report-row');
        const typesList = [];

        rows.forEach(row => {
          const fileInput = row.querySelector('.popup-report-file');
          const typeSelect = row.querySelector('.popup-report-type');

          if (fileInput && fileInput.files && fileInput.files[0]) {
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

        if (successAlert) {
          successAlert.innerText = 'Clinical reports uploaded successfully!';
          successAlert.style.display = 'block';
        }

        popupUploadForm.reset();
        const allRows = popupRowsContainer.querySelectorAll('.dynamic-report-row');
        allRows.forEach((row, idx) => {
          if (idx > 0) row.remove();
        });

        await fetchAndRenderVisitDetailsInPopup(patientId, visitId);
        await fetchAndRenderProfile(patientId);

      } catch (err) {
        console.error(err);
        if (errorAlert) {
          errorAlert.innerText = err.message || 'Error occurred while uploading.';
          errorAlert.style.display = 'block';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Upload Documents';
      }
    });
  }
}

/**
 * Fetch and Render specific visit details inside the pop-up modal
 */
async function fetchAndRenderVisitDetailsInPopup(patientId, visitId) {
  try {
    const response = await apiRequest(`/patients/${patientId}/visits/${visitId}`);
    if (response.success) {
      const { visit, prescriptions, reports } = response.data;

      const checkupDate = new Date(visit.checkup_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      document.getElementById('popup-visit-date-time').innerText = checkupDate;
      document.getElementById('popup-visit-doctor-name').innerText = visit.doctor_name || 'Unknown Specialist';
      document.getElementById('popup-visit-findings').innerText = visit.findings;
      document.getElementById('popup-visit-notes').innerText = visit.notes || 'No clinic notes recorded.';
      document.getElementById('popup-visit-recs').innerText = visit.recommendations || 'No clinical recommendations provided.';

      // Populate next check-up scheduling details
      const followupContainer = document.getElementById('popup-visit-followup-container');
      if (followupContainer) {
        if (visit.next_checkup_date) {
          document.getElementById('popup-visit-next-date').innerText = formatDate(visit.next_checkup_date);
          
          const intervalEl = document.getElementById('popup-visit-interval');
          const intervalWrapper = document.getElementById('popup-visit-interval-wrapper');
          if (visit.followup_interval) {
            intervalEl.innerText = visit.followup_interval;
            intervalWrapper.style.display = 'block';
          } else {
            intervalWrapper.style.display = 'none';
          }

          const notesEl = document.getElementById('popup-visit-followup-notes');
          const notesWrapper = document.getElementById('popup-visit-followup-notes-wrapper');
          if (visit.followup_notes) {
            notesEl.innerText = visit.followup_notes;
            notesWrapper.style.display = 'block';
          } else {
            notesWrapper.style.display = 'none';
          }

          followupContainer.style.display = 'block';
        } else {
          followupContainer.style.display = 'none';
        }
      }

      // Render medications in popup table
      const medsBody = document.getElementById('popup-meds-body');
      if (medsBody) {
        if (!prescriptions || prescriptions.length === 0) {
          medsBody.innerHTML = `
            <tr>
              <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">
                No medications prescribed during this visit.
              </td>
            </tr>
          `;
        } else {
          medsBody.innerHTML = prescriptions.map(med => {
            const endStr = med.end_date ? formatDate(med.end_date) : 'Ongoing';
            return `
              <tr>
                <td style="padding: 8px 12px;"><strong>${escapeHtml(med.medication_name)}</strong></td>
                <td style="padding: 8px 12px;">${escapeHtml(med.dosage)}</td>
                <td style="padding: 8px 12px;">${escapeHtml(med.frequency)}</td>
                <td style="padding: 8px 12px;">${formatDate(med.start_date)} to ${endStr}</td>
              </tr>
            `;
          }).join('');
        }
      }

      // Render reports in popup
      const reportsContainer = document.getElementById('popup-reports-list');
      if (reportsContainer) {
        reportsContainer.innerHTML = '';
        if (!reports || reports.length === 0) {
          reportsContainer.innerHTML = `
            <div style="color: var(--text-muted); font-size: 13px; padding: 8px 12px; border: 1px dashed var(--border-color); text-align: center; border-radius: var(--radius-sm); width: 100%;">
              No reports attached to this visit.
            </div>
          `;
        } else {
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
            reportsContainer.appendChild(badge);
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch details:', err);
    alert('Error loading visit details.');
  }
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

/**
 * Fetch and Render past symptom logs for the patient
 */
async function fetchAndRenderSymptomLogs(patientId) {
  const container = document.getElementById('symptoms-list-container');
  if (!container) return;

  try {
    const response = await apiRequest(`/patients/${patientId}/symptoms`);
    if (response.success) {
      const logs = response.data.logs || [];
      renderSymptomLogs(logs);
    }
  } catch (err) {
    console.error('Error fetching symptom logs:', err);
    container.innerHTML = `
      <div style="color: var(--danger); font-size: 14px; text-align: center; padding: 24px;">
        Failed to load symptom records.
      </div>
    `;
  }
}

/**
 * Render symptom logs list for doctor visibility
 */
function renderSymptomLogs(logs) {
  const container = document.getElementById('symptoms-list-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
        No symptoms logged by the patient yet.
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map(l => {
    const dateStr = new Date(l.logged_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Pain level badge color
    let painColor = 'var(--success)';
    if (l.pain_scale >= 7) painColor = 'var(--danger)';
    else if (l.pain_scale >= 4) painColor = 'var(--warning)';

    // Burning & Mouth Opening colors
    const getSeverityColor = (sev) => {
      if (sev === 'Severe') return 'var(--danger)';
      if (sev === 'Moderate') return 'var(--warning)';
      return 'var(--text-dark)';
    };

    return `
      <div class="checkup-node" style="padding: 14px; margin-bottom: 12px; border-left: 3px solid var(--primary); background-color: var(--bg-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
        <div class="checkup-meta" style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px;">
          <strong>Logged on:</strong> ${dateStr}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 13px;">
          <div>
            <strong>Pain Level:</strong> 
            <span class="status-pill" style="background-color: ${painColor}22; color: ${painColor}; border: 1px solid ${painColor}44; font-weight: 700; font-size: 11px; padding: 2px 6px; display: inline-block;">
              ${l.pain_scale} / 10
            </span>
          </div>
          <div>
            <strong>Burning Sensation:</strong> 
            <span style="color: ${getSeverityColor(l.burning_sensation)}; font-weight: 600;">
              ${l.burning_sensation}
            </span>
          </div>
          <div>
            <strong>Difficulty Opening Mouth:</strong> 
            <span style="color: ${getSeverityColor(l.difficulty_opening_mouth)}; font-weight: 600;">
              ${l.difficulty_opening_mouth}
            </span>
          </div>
          <div>
            <strong>Ulcer Duration:</strong> 
            <span>${l.ulcer_duration} Days</span>
          </div>
          <div>
            <strong>Bleeding:</strong> 
            ${l.bleeding 
              ? `<span class="status-pill" style="background-color: var(--danger)22; color: var(--danger); border: 1px solid var(--danger)44; font-weight: 700; font-size: 11px; padding: 2px 6px; display: inline-block;">Active</span>` 
              : `<span class="status-pill" style="background-color: var(--success)22; color: var(--success); border: 1px solid var(--success)44; font-weight: 600; font-size: 11px; padding: 2px 6px; display: inline-block;">None</span>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}
