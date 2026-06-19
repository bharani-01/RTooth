import { apiRequest, getUserProfile, logoutUser, getSessionToken } from './api.js';

let patientsList = [];
let selectedPatient = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load Doctor Sidebar
  await loadDoctorSidebar();

  // Load Header Info
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

  // Fetch Patients List for Search Suggest Widget
  await fetchPatients();

  // Set up Search Widget events
  initSearchWidget();

  // Set up Form controls
  initConsultationForm();

  // Parse URL query parameters for pre-selection (e.g. from patient profile view)
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedPatientId = urlParams.get('patient_id');
  const action = urlParams.get('action');

  if (preSelectedPatientId && patientsList.length > 0) {
    const matched = patientsList.find(p => p.id === preSelectedPatientId);
    if (matched) {
      selectPatientItem(matched);
      if (action === 'record') {
        const recordVisitBtn = document.getElementById('option-record-visit');
        if (recordVisitBtn) recordVisitBtn.click();
      }
    }
  }
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
      const id = item.getAttribute('id');
      if (id === 'menu-doctor-consultation') {
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
 * Fetch patient directory
 */
async function fetchPatients() {
  try {
    const response = await apiRequest('/patients');
    if (response.success) {
      patientsList = response.data.patients || [];
    }
  } catch (err) {
    console.error('Error fetching patients for search list:', err);
  }
}

/**
 * Set up Search suggest events
 */
function initSearchWidget() {
  const searchInput = document.getElementById('patient-search-input');
  const searchDropdown = document.getElementById('patient-search-dropdown');
  const selectedPatientCard = document.getElementById('selected-patient-card');
  const deselectBtn = document.getElementById('btn-deselect-patient');
  const recordVisitPanel = document.getElementById('record-visit-panel');

  if (!searchInput || !searchDropdown) return;

  // Filter and show dropdown on input
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      searchDropdown.classList.remove('visible');
      searchDropdown.innerHTML = '';
      return;
    }

    const matches = patientsList.filter(p => {
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      const code = (p.patient_code || '').toLowerCase();
      return fullName.includes(query) || code.includes(query);
    });

    renderDropdownResults(matches);
  });

  // Show dropdown on focus (if text present)
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      searchDropdown.classList.add('visible');
    }
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.remove('visible');
    }
  });

  // Handle deselect button
  if (deselectBtn) {
    deselectBtn.addEventListener('click', () => {
      selectedPatient = null;
      if (selectedPatientCard) selectedPatientCard.style.display = 'none';
      if (recordVisitPanel) recordVisitPanel.style.display = 'none';

      const historyPanel = document.getElementById('clinical-history-panel');
      const detailsPanel = document.getElementById('visit-details-panel');
      if (historyPanel) historyPanel.style.display = 'none';
      if (detailsPanel) detailsPanel.style.display = 'none';

      searchInput.value = '';
      searchInput.disabled = false;
      searchInput.focus();
    });
  }
}

/**
 * Render matched search list
 */
function renderDropdownResults(matches) {
  const searchDropdown = document.getElementById('patient-search-dropdown');
  if (!searchDropdown) return;

  searchDropdown.innerHTML = '';

  if (matches.length === 0) {
    searchDropdown.innerHTML = '<div class="search-no-results">No registered patients found.</div>';
    searchDropdown.classList.add('visible');
    return;
  }

  matches.forEach(p => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'search-result-name';
    nameSpan.innerText = `${p.first_name} ${p.last_name}`;

    const codeSpan = document.createElement('span');
    codeSpan.className = 'search-result-code';
    codeSpan.innerText = p.patient_code || 'N/A';

    item.appendChild(nameSpan);
    item.appendChild(codeSpan);

    // On select
    item.addEventListener('click', () => {
      selectPatientItem(p);
    });

    searchDropdown.appendChild(item);
  });

  searchDropdown.classList.add('visible');
}

/**
 * Set selected patient card
 */
function selectPatientItem(patient) {
  selectedPatient = patient;

  const searchInput = document.getElementById('patient-search-input');
  const searchDropdown = document.getElementById('patient-search-dropdown');
  const selectedPatientCard = document.getElementById('selected-patient-card');
  const recordVisitPanel = document.getElementById('record-visit-panel');

  if (searchDropdown) searchDropdown.classList.remove('visible');
  if (searchInput) {
    searchInput.value = `${patient.first_name} ${patient.last_name} (${patient.patient_code})`;
    searchInput.disabled = true;
  }

  // Populate selected card details
  document.getElementById('selected-pat-name').innerText = `${patient.first_name} ${patient.last_name}`;
  document.getElementById('selected-pat-code').innerText = patient.patient_code || 'N/A';
  document.getElementById('selected-pat-gender').innerText = patient.gender || 'Not Specified';
  document.getElementById('selected-pat-dob').innerText = patient.date_of_birth ? formatDate(patient.date_of_birth) : 'N/A';
  document.getElementById('selected-pat-location').innerText = patient.lesion_location || 'Not Specified';
  document.getElementById('selected-pat-stage').innerText = patient.cancer_stage || 'Suspicious Lesion';

  if (selectedPatientCard) selectedPatientCard.style.display = 'block';
  if (recordVisitPanel) recordVisitPanel.style.display = 'none'; // reset form panel visibility

  const historyPanel = document.getElementById('clinical-history-panel');
  const detailsPanel = document.getElementById('visit-details-panel');
  if (historyPanel) historyPanel.style.display = 'none';
  if (detailsPanel) detailsPanel.style.display = 'none';
}

/**
 * Initialize visit logging form
 */
function initConsultationForm() {
  const viewHistoryBtn = document.getElementById('option-view-history');
  const recordVisitBtn = document.getElementById('option-record-visit');
  const recordVisitPanel = document.getElementById('record-visit-panel');
  const visitForm = document.getElementById('visit-form');
  const visitError = document.getElementById('visit-error-alert');
  const visitSuccess = document.getElementById('visit-success-alert');

  const addMedBtn = document.getElementById('btn-add-visit-med');
  const addReportBtn = document.getElementById('btn-add-visit-report');
  const medsContainer = document.getElementById('visit-meds-container');
  const reportsContainer = document.getElementById('visit-reports-container');
  const noMedsText = document.getElementById('no-meds-text');
  const noReportsText = document.getElementById('no-reports-text');

  // View History click -> renders history inline on the page
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
      if (selectedPatient) {
        if (recordVisitPanel) recordVisitPanel.style.display = 'none';
        const historyPanel = document.getElementById('clinical-history-panel');
        const detailsPanel = document.getElementById('visit-details-panel');
        if (detailsPanel) detailsPanel.style.display = 'none';
        
        document.getElementById('history-patient-name').innerText = `${selectedPatient.first_name} ${selectedPatient.last_name}`;
        if (historyPanel) {
          historyPanel.style.display = 'block';
          historyPanel.scrollIntoView({ behavior: 'smooth' });
        }
        renderHistory(selectedPatient.id);
      }
    });
  }

  // Record Visit click -> reveals visit panel form
  if (recordVisitBtn) {
    recordVisitBtn.addEventListener('click', () => {
      if (!selectedPatient) return;

      const historyPanel = document.getElementById('clinical-history-panel');
      const detailsPanel = document.getElementById('visit-details-panel');
      if (historyPanel) historyPanel.style.display = 'none';
      if (detailsPanel) detailsPanel.style.display = 'none';

      document.getElementById('visit-form-patient-name').innerText = `${selectedPatient.first_name} ${selectedPatient.last_name}`;
      
      // Reset form variables
      visitForm.reset();
      if (visitError) visitError.style.display = 'none';
      if (visitSuccess) visitSuccess.style.display = 'none';

      const medRows = medsContainer.querySelectorAll('.dynamic-med-card, .dynamic-row');
      medRows.forEach(row => row.remove());
      if (noMedsText) noMedsText.style.display = 'block';

      const reportRows = reportsContainer.querySelectorAll('.dynamic-report-row');
      reportRows.forEach(row => row.remove());
      if (noReportsText) noReportsText.style.display = 'block';

      // Prefill date time
      const visitDateInput = document.getElementById('visit_date');
      if (visitDateInput) {
        const now = new Date();
        const tzoffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
        visitDateInput.value = localISOTime;
      }

      if (recordVisitPanel) {
        recordVisitPanel.style.display = 'block';
        recordVisitPanel.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Cancel visit form
  const cancelBtn = document.getElementById('btn-cancel-visit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (recordVisitPanel) recordVisitPanel.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Add drug card
  if (addMedBtn) {
    addMedBtn.addEventListener('click', () => {
      if (noMedsText) noMedsText.style.display = 'none';

      const card = document.createElement('div');
      card.className = 'dynamic-med-card';

      const todayStr = new Date().toISOString().split('T')[0];

      card.innerHTML = `
        <div class="dynamic-med-card-header">
          <span class="dynamic-med-card-title">Medication details</span>
          <button type="button" class="btn-delete-row" title="Remove Prescription">
            <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor; stroke-width:2.5; fill:none; margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Remove
          </button>
        </div>
        <div class="dynamic-med-grid">
          <!-- Row 1: Name and Dosage Form -->
          <div class="dynamic-med-grid-row">
            <div class="dynamic-med-field">
              <label>Medication Name <span class="req">*</span></label>
              <input type="text" class="form-input med-name" placeholder="e.g. Amoxicillin, Curcumin Oral Gel" required style="padding: 8px 10px;">
            </div>
            <div class="dynamic-med-field">
              <label>Dosage Form</label>
              <select class="form-input med-dosage-form">
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Gel">Gel / Ointment</option>
                <option value="Syrup">Syrup</option>
                <option value="Drops">Drops</option>
                <option value="Mouthwash">Mouthwash</option>
                <option value="N/A" selected>N/A</option>
              </select>
            </div>
          </div>
          <!-- Row 2: Dosage and Frequency -->
          <div class="dynamic-med-grid-row-equal">
            <div class="dynamic-med-field">
              <label>Dosage <span class="req">*</span></label>
              <input type="text" class="form-input med-dosage" placeholder="e.g. 500mg" required style="padding: 8px 10px;">
            </div>
            <div class="dynamic-med-field">
              <label>Frequency <span class="req">*</span></label>
              <input type="text" class="form-input med-freq" placeholder="e.g. Twice daily" required style="padding: 8px 10px;">
            </div>
          </div>
          <!-- Row 3: Times a Day, Relation to Food, Route of Administration -->
          <div class="dynamic-med-grid-row-3">
            <div class="dynamic-med-field">
              <label>Times a Day</label>
              <input type="number" class="form-input med-times-a-day" placeholder="e.g. 2" min="1" style="padding: 8px 10px;">
            </div>
            <div class="dynamic-med-field">
              <label>Relation to Food</label>
              <select class="form-input med-relation-to-food">
                <option value="Before Food">Before Food</option>
                <option value="After Food">After Food</option>
                <option value="With Food">With Food</option>
                <option value="Empty Stomach">Empty Stomach</option>
                <option value="N/A" selected>N/A</option>
              </select>
            </div>
            <div class="dynamic-med-field">
              <label>Route of Administration</label>
              <select class="form-input med-route">
                <option value="Oral">Oral</option>
                <option value="Topical">Topical</option>
                <option value="Mouthwash">Mouthwash</option>
                <option value="Inhalation">Inhalation</option>
                <option value="N/A" selected>N/A</option>
              </select>
            </div>
          </div>
          <!-- Row 4: Start Date and End Date -->
          <div class="dynamic-med-grid-row-equal">
            <div class="dynamic-med-field">
              <label>Start Date <span class="req">*</span></label>
              <input type="date" class="form-input med-start" required style="padding: 8px 10px;" value="${todayStr}">
            </div>
            <div class="dynamic-med-field">
              <label>End Date</label>
              <input type="date" class="form-input med-end" style="padding: 8px 10px;">
            </div>
          </div>
          <!-- Row 5: Special Instructions -->
          <div class="dynamic-med-field">
            <label>Special Instructions</label>
            <input type="text" class="form-input med-instructions" placeholder="e.g. Swallow whole with water, avoid dairy" style="padding: 8px 10px;">
          </div>
        </div>
      `;

      card.querySelector('.btn-delete-row').addEventListener('click', () => {
        card.remove();
        if (medsContainer.querySelectorAll('.dynamic-med-card').length === 0) {
          if (noMedsText) noMedsText.style.display = 'block';
        }
      });

      medsContainer.appendChild(card);
    });
  }

  // Add report row
  if (addReportBtn) {
    addReportBtn.addEventListener('click', () => {
      if (noReportsText) noReportsText.style.display = 'none';

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
          <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; stroke-width:2.5; fill:none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;

      row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
        if (reportsContainer.querySelectorAll('.dynamic-report-row').length === 0) {
          if (noReportsText) noReportsText.style.display = 'block';
        }
      });

      reportsContainer.appendChild(row);
    });
  }

  // Submit Visit Form
  if (visitForm) {
    visitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedPatient) return;
      
      if (visitError) visitError.style.display = 'none';
      if (visitSuccess) visitSuccess.style.display = 'none';

      const findings = document.getElementById('visit_findings').value.trim();
      const notes = document.getElementById('visit_notes').value.trim();
      const recommendations = document.getElementById('visit_recs').value.trim();
      const visitDateVal = document.getElementById('visit_date').value;
      const nextCheckupDate = document.getElementById('visit_next_date').value;
      const followupInterval = document.getElementById('visit_followup_interval').value;
      const followupNotes = document.getElementById('visit_followup_notes').value.trim();

      const submitBtn = document.getElementById('btn-submit-visit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Recording Consultation...';

      try {
        const formData = new FormData();
        formData.append('findings', findings);
        formData.append('notes', notes || '');
        formData.append('recommendations', recommendations || '');
        formData.append('checkup_date', visitDateVal ? new Date(visitDateVal).toISOString() : new Date().toISOString());
        formData.append('next_checkup_date', nextCheckupDate || '');
        formData.append('followup_interval', followupInterval || '');
        formData.append('followup_notes', followupNotes || '');

        // Prescriptions
        const prescriptionsList = [];
        const medCards = medsContainer.querySelectorAll('.dynamic-med-card, .dynamic-row');
        medCards.forEach(card => {
          // Supports both old dynamic-row and new dynamic-med-card layouts
          const timesVal = card.querySelector('.med-times-a-day')?.value;
          prescriptionsList.push({
            medication_name: card.querySelector('.med-name').value.trim(),
            dosage: card.querySelector('.med-dosage').value.trim(),
            dosage_form: card.querySelector('.med-dosage-form')?.value || 'N/A',
            frequency: card.querySelector('.med-freq').value.trim(),
            times_a_day: timesVal ? parseInt(timesVal, 10) : null,
            relation_to_food: card.querySelector('.med-relation-to-food')?.value || 'N/A',
            route: card.querySelector('.med-route')?.value || 'N/A',
            start_date: card.querySelector('.med-start').value,
            end_date: card.querySelector('.med-end').value || null,
            instructions: card.querySelector('.med-instructions')?.value.trim() || null
          });
        });
        formData.append('prescriptions', JSON.stringify(prescriptionsList));

        // Files
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

        // Send Request
        const token = getSessionToken();
        const fetchResponse = await fetch(`/api/v1/patients/${selectedPatient.id}/visits`, {
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

        // Show Success Feedback
        if (visitSuccess) {
          visitSuccess.innerText = 'Consultation visit recorded successfully!';
          visitSuccess.style.display = 'block';
        }

        // Hide form and show updated history inline
        setTimeout(() => {
          if (recordVisitPanel) recordVisitPanel.style.display = 'none';
          document.getElementById('history-patient-name').innerText = `${selectedPatient.first_name} ${selectedPatient.last_name}`;
          const historyPanel = document.getElementById('clinical-history-panel');
          if (historyPanel) {
            historyPanel.style.display = 'block';
            historyPanel.scrollIntoView({ behavior: 'smooth' });
          }
          renderHistory(selectedPatient.id);
        }, 1500);

      } catch (err) {
        console.error(err);
        if (visitError) {
          visitError.innerText = err.message || 'Failed to record consultation visit.';
          visitError.style.display = 'block';
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Record Consultation Visit';
      }
    });
  }

  // ----------------- INLINE HISTORY & DETAILS LOGIC -----------------
  const historyPanel = document.getElementById('clinical-history-panel');
  const detailsPanel = document.getElementById('visit-details-panel');
  const backToHistoryBtn = document.getElementById('btn-back-to-history');
  const inlineUploadForm = document.getElementById('inline-upload-reports-form');
  const inlineAddRowBtn = document.getElementById('btn-inline-add-more-rows');
  const inlineRowsContainer = document.getElementById('inline-upload-rows-container');

  // Event Delegation for View Details button on history checkups list
  const historyCheckupsContainer = document.getElementById('history-checkups-list-container');
  if (historyCheckupsContainer && !historyCheckupsContainer.dataset.listenerAttached) {
    historyCheckupsContainer.dataset.listenerAttached = 'true';
    historyCheckupsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view-visit-inline');
      if (btn) {
        const visitId = btn.dataset.visitId;
        openVisitDetailsInline(visitId, selectedPatient.id);
      }
    });
  }

  // Back to history
  if (backToHistoryBtn) {
    backToHistoryBtn.addEventListener('click', () => {
      if (detailsPanel) detailsPanel.style.display = 'none';
      if (historyPanel) {
        historyPanel.style.display = 'block';
        historyPanel.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Inline Upload Form - Add dynamic file row
  if (inlineAddRowBtn && inlineRowsContainer) {
    inlineAddRowBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'dynamic-report-row';
      row.style.gridTemplateColumns = '2.5fr 2fr auto';
      row.style.padding = '6px 8px';
      row.style.alignItems = 'center';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.border = '1px solid var(--border-color)';
      row.style.backgroundColor = 'var(--bg-subtle)';
      row.innerHTML = `
        <input type="file" class="form-input inline-report-file" accept=".pdf,image/*" required style="padding: 4px 8px; font-size: 12.5px; border: none; background: transparent;">
        <select class="form-input inline-report-type" required style="padding: 6px 8px; font-size: 12.5px;">
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
      inlineRowsContainer.appendChild(row);
    });
  }

  // Submit additional files from inline view
  if (inlineUploadForm) {
    inlineUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const visitId = document.getElementById('inline_upload_visit_id').value;
      const errorAlert = document.getElementById('inline-upload-error');
      const successAlert = document.getElementById('inline-upload-success');
      const submitBtn = document.getElementById('btn-inline-submit-upload');

      if (errorAlert) errorAlert.style.display = 'none';
      if (successAlert) successAlert.style.display = 'none';

      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading files...';

      try {
        const formData = new FormData();
        const rows = inlineRowsContainer.querySelectorAll('.dynamic-report-row');
        const typesList = [];

        rows.forEach(row => {
          const fileInput = row.querySelector('.inline-report-file');
          const typeSelect = row.querySelector('.inline-report-type');

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
        const response = await fetch(`/api/v1/patients/${selectedPatient.id}/visits/${visitId}/reports`, {
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

        inlineUploadForm.reset();
        const allRows = inlineRowsContainer.querySelectorAll('.dynamic-report-row');
        allRows.forEach((row, idx) => {
          if (idx > 0) row.remove();
        });

        await fetchAndRenderVisitDetailsInline(selectedPatient.id, visitId);
        await renderHistory(selectedPatient.id);

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
 * Render patient history (timeline and active medications) inline on the Consultation Hub
 */
async function renderHistory(patientId) {
  try {
    const response = await apiRequest(`/patients/${patientId}`);
    if (response.success) {
      const patient = response.data.profile;
      
      // Render medications in history table
      const medsBody = document.getElementById('history-medications-body');
      if (medsBody) {
        if (!patient.medications || patient.medications.length === 0) {
          medsBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">
                No active medication prescriptions found.
              </td>
            </tr>
          `;
        } else {
          medsBody.innerHTML = patient.medications.map(med => {
            const endDateFormatted = med.end_date ? formatDate(med.end_date) : 'Ongoing';
            const detailsList = [];
            if (med.dosage_form && med.dosage_form !== 'N/A') detailsList.push(escapeHtml(med.dosage_form));
            if (med.route && med.route !== 'N/A') detailsList.push(`Route: ${escapeHtml(med.route)}`);
            if (med.times_a_day) detailsList.push(`${med.times_a_day}x daily`);
            if (med.relation_to_food && med.relation_to_food !== 'N/A') detailsList.push(`<span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 5px; border-radius:4px; font-weight:600;">${escapeHtml(med.relation_to_food)}</span>`);
            const detailsStr = detailsList.length > 0 ? `<div style="font-size:11.5px; color:#5a6478; margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${detailsList.join(' · ')}</div>` : '';
            const instructionsHtml = med.instructions ? `<div style="font-size:11.5px; color:#64748b; font-style:italic; margin-top:3px;">Note: ${escapeHtml(med.instructions)}</div>` : '';

            return `
              <tr>
                <td style="padding: 8px 12px; vertical-align:top;">
                  <strong>${escapeHtml(med.medication_name)}</strong>
                  ${detailsStr}
                  ${instructionsHtml}
                </td>
                <td style="padding: 8px 12px; vertical-align:middle;">${escapeHtml(med.dosage)}</td>
                <td style="padding: 8px 12px; vertical-align:middle;">${escapeHtml(med.frequency)}</td>
                <td style="padding: 8px 12px; vertical-align:middle;">${formatDate(med.start_date)}</td>
                <td style="padding: 8px 12px; vertical-align:middle;">${endDateFormatted}</td>
              </tr>
            `;
          }).join('');
        }
      }

      // Render timeline checkups
      const timelineContainer = document.getElementById('history-checkups-list-container');
      if (timelineContainer) {
        if (!patient.checkups || patient.checkups.length === 0) {
          timelineContainer.innerHTML = `
            <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
              No clinical check-up visits logged for this patient yet.
            </div>
          `;
        } else {
          timelineContainer.innerHTML = patient.checkups.map(c => {
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
              ? `<div class="checkup-findings" style="margin-top: 8px; font-size: 12px; border: 1px dashed var(--border-color); padding: 8px; border-radius: var(--radius-sm); background-color: var(--bg-subtle); line-height: 1.4;">
                   <div style="font-weight: 600; color: var(--primary); display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                     <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.5; flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Next Scheduled Follow-up:
                   </div>
                   <div style="color: var(--text-dark);">
                     <div><strong>Scheduled Date:</strong> ${formatDate(c.next_checkup_date)}</div>
                     ${c.followup_interval ? `<div><strong>Interval Repetition:</strong> ${escapeHtml(c.followup_interval)}</div>` : ''}
                     ${c.followup_notes ? `<div><strong>Scheduler Notes:</strong> ${escapeHtml(c.followup_notes)}</div>` : ''}
                   </div>
                 </div>`
              : '';

            let medsHtml = '';
            if (c.prescriptions && c.prescriptions.length > 0) {
              const medsItems = c.prescriptions.map(m => {
                const endStr = m.end_date ? ` until ${formatDate(m.end_date)}` : ' (Ongoing)';
                const detailsList = [];
                if (m.dosage_form && m.dosage_form !== 'N/A') detailsList.push(escapeHtml(m.dosage_form));
                if (m.route && m.route !== 'N/A') detailsList.push(`Route: ${escapeHtml(m.route)}`);
                if (m.times_a_day) detailsList.push(`${m.times_a_day}x/day`);
                if (m.relation_to_food && m.relation_to_food !== 'N/A') detailsList.push(escapeHtml(m.relation_to_food));
                const detailsStr = detailsList.length > 0 ? ` [${detailsList.join(', ')}]` : '';
                const instructionsStr = m.instructions ? ` (Note: ${escapeHtml(m.instructions)})` : '';
                return `<li><strong>${escapeHtml(m.medication_name)}</strong> - ${escapeHtml(m.dosage)} (${escapeHtml(m.frequency)})${detailsStr}${endStr}${instructionsStr}</li>`;
              }).join('');
              
              medsHtml = `
                <div class="visit-prescriptions-list" style="margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                  <div style="font-weight: 600; font-size: 12px; color: var(--text-dark); margin-bottom: 4px;">
                    Prescribed Medications:
                  </div>
                  <ul style="margin-left: 20px; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; list-style-type: disc;">
                    ${medsItems}
                  </ul>
                </div>
              `;
            }

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
                    <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; flex-shrink: 0;">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span><strong>${escapeHtml(r.report_type)}:</strong> ${escapeHtml(r.file_name)}</span>
                  </a>
                `;
              }).join('');

              reportsHtml = `
                <div class="visit-reports-list" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
                  ${reportsItems}
                </div>
              `;
            }

            return `
              <div class="checkup-node" style="padding: 16px; border-left: 3px solid var(--primary); background-color: var(--bg-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 16px; position: relative;">
                <div class="checkup-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--text-muted);">
                  <span>${checkupDate}</span>
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <span>Logged by ${escapeHtml(c.doctor_name)}</span>
                    <button class="btn btn-secondary btn-view-visit-inline" data-visit-id="${c.id}" style="font-size: 11px; padding: 2px 8px; height: auto; font-weight: 500;">View Details</button>
                  </div>
                </div>
                <div class="checkup-findings" style="font-size: 13.5px; line-height: 1.5; color: var(--text-dark);">
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
      }
      // Fetch and render self-reported symptom logs
      await fetchAndRenderSymptomLogs(patientId);
    }
  } catch (error) {
    console.error('Error rendering patient history:', error.message);
    alert('Failed to load patient history.');
  }
}

/**
 * Show inline visit details and fetch records
 */
function openVisitDetailsInline(visitId, patientId) {
  const historyPanel = document.getElementById('clinical-history-panel');
  const detailsPanel = document.getElementById('visit-details-panel');
  const inlineUploadForm = document.getElementById('inline-upload-reports-form');
  const inlineRowsContainer = document.getElementById('inline-upload-rows-container');

  if (historyPanel) historyPanel.style.display = 'none';
  if (detailsPanel) {
    detailsPanel.style.display = 'block';
    detailsPanel.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('inline-visit-date-time').innerText = 'Loading...';
  document.getElementById('inline-visit-doctor-name').innerText = 'Loading...';
  document.getElementById('inline-visit-findings').innerText = 'Loading...';
  document.getElementById('inline-visit-notes').innerText = 'No notes logged.';
  document.getElementById('inline-visit-recs').innerText = 'Loading...';

  const followupContainer = document.getElementById('inline-visit-followup-container');
  if (followupContainer) followupContainer.style.display = 'none';

  const medsBody = document.getElementById('inline-meds-body');
  if (medsBody) medsBody.innerHTML = '';

  const reportsList = document.getElementById('inline-reports-list');
  if (reportsList) reportsList.innerHTML = '';

  document.getElementById('inline_upload_visit_id').value = visitId;

  const errorAlert = document.getElementById('inline-upload-error');
  const successAlert = document.getElementById('inline-upload-success');
  if (errorAlert) errorAlert.style.display = 'none';
  if (successAlert) successAlert.style.display = 'none';

  if (inlineUploadForm) {
    inlineUploadForm.reset();
    const allRows = inlineRowsContainer.querySelectorAll('.dynamic-report-row');
    allRows.forEach((row, idx) => {
      if (idx > 0) row.remove();
    });
  }

  fetchAndRenderVisitDetailsInline(patientId, visitId);
}

/**
 * Fetch and Render specific visit details inline on the page
 */
async function fetchAndRenderVisitDetailsInline(patientId, visitId) {
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
      document.getElementById('inline-visit-date-time').innerText = checkupDate;
      document.getElementById('inline-visit-doctor-name').innerText = visit.doctor_name || 'Unknown Specialist';
      document.getElementById('inline-visit-findings').innerText = visit.findings;
      document.getElementById('inline-visit-notes').innerText = visit.notes || 'No clinic notes recorded.';
      document.getElementById('inline-visit-recs').innerText = visit.recommendations || 'No clinical recommendations provided.';

      // Populate next check-up scheduling details
      const followupContainer = document.getElementById('inline-visit-followup-container');
      if (followupContainer) {
        if (visit.next_checkup_date) {
          document.getElementById('inline-visit-next-date').innerText = formatDate(visit.next_checkup_date);
          
          const intervalEl = document.getElementById('inline-visit-interval');
          const intervalWrapper = document.getElementById('inline-visit-interval-wrapper');
          if (visit.followup_interval) {
            intervalEl.innerText = visit.followup_interval;
            intervalWrapper.style.display = 'block';
          } else {
            intervalWrapper.style.display = 'none';
          }

          const notesEl = document.getElementById('inline-visit-followup-notes');
          const notesWrapper = document.getElementById('inline-visit-followup-notes-wrapper');
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

      // Render medications table
      const medsBody = document.getElementById('inline-meds-body');
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
            const detailsList = [];
            if (med.dosage_form && med.dosage_form !== 'N/A') detailsList.push(escapeHtml(med.dosage_form));
            if (med.route && med.route !== 'N/A') detailsList.push(`Route: ${escapeHtml(med.route)}`);
            if (med.times_a_day) detailsList.push(`${med.times_a_day}x daily`);
            if (med.relation_to_food && med.relation_to_food !== 'N/A') detailsList.push(`<span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 5px; border-radius:4px; font-weight:600;">${escapeHtml(med.relation_to_food)}</span>`);
            const detailsStr = detailsList.length > 0 ? `<div style="font-size:11.5px; color:#5a6478; margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${detailsList.join(' · ')}</div>` : '';
            const instructionsHtml = med.instructions ? `<div style="font-size:11.5px; color:#64748b; font-style:italic; margin-top:3px;">Note: ${escapeHtml(med.instructions)}</div>` : '';

            return `
              <tr>
                <td style="padding: 8px 12px; vertical-align:top;">
                  <strong>${escapeHtml(med.medication_name)}</strong>
                  ${detailsStr}
                  ${instructionsHtml}
                </td>
                <td style="padding: 8px 12px; vertical-align:middle;">${escapeHtml(med.dosage)}</td>
                <td style="padding: 8px 12px; vertical-align:middle;">${escapeHtml(med.frequency)}</td>
                <td style="padding: 8px 12px; vertical-align:middle;">${formatDate(med.start_date)} to ${endStr}</td>
              </tr>
            `;
          }).join('');
        }
      }

      // Render reports list
      const reportsContainer = document.getElementById('inline-reports-list');
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
    console.error('Failed to fetch inline visit details:', err);
    alert('Error loading visit details.');
  }
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
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Fetch self-reported symptom logs for the patient
 */
async function fetchAndRenderSymptomLogs(patientId) {
  const container = document.getElementById('history-symptoms-list-container');
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
 * Render symptom logs in timeline format inside history panel
 */
function renderSymptomLogs(logs) {
  const container = document.getElementById('history-symptoms-list-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
        No daily symptom logs submitted by this patient yet.
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
              ${escapeHtml(l.pain_scale)} / 10
            </span>
          </div>
          <div>
            <strong>Burning Sensation:</strong> 
            <span style="color: ${getSeverityColor(l.burning_sensation)}; font-weight: 600;">
              ${escapeHtml(l.burning_sensation)}
            </span>
          </div>
          <div>
            <strong>Difficulty Opening Mouth:</strong> 
            <span style="color: ${getSeverityColor(l.difficulty_opening_mouth)}; font-weight: 600;">
              ${escapeHtml(l.difficulty_opening_mouth)}
            </span>
          </div>
          <div>
            <strong>Ulcer Duration:</strong> 
            <span>${escapeHtml(l.ulcer_duration)} Days</span>
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
