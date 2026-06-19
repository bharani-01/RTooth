import { apiRequest, getUserProfile, logoutUser, escapeHtml } from './api.js';

document.addEventListener('DOMContentLoaded', () => {


  // Pre-load from localStorage if available
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientHeader(initialProfile);
    fetchAndRenderSymptomLogs();
  }

  // Listen for auth-verified
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientHeader(profile);
      fetchAndRenderSymptomLogs();
    }
  });

  // Bind form submission
  const form = document.getElementById('symptom-log-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  if (window.initMobileMenu) {
    window.initMobileMenu();
  }
});

/**
 * Populate Patient details in header
 */
function populatePatientHeader(profile) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const nameBadge = document.getElementById('patient-name-badge');
  const avatar = document.getElementById('patient-avatar');
  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
}

/**
 * Fetch and Render past logs
 */
async function fetchAndRenderSymptomLogs() {
  const container = document.getElementById('symptoms-timeline-container');
  if (!container) return;

  try {
    const response = await apiRequest('/patients/me/symptoms');
    if (response.success) {
      const logs = response.data.logs || [];
      renderLogsTimeline(logs);
    }
  } catch (err) {
    console.error('Error fetching symptom logs:', err);
    container.innerHTML = `
      <div style="color: var(--danger); font-size: 14px; text-align: center; padding: 24px;">
        Failed to load symptom records history.
      </div>
    `;
  }
}

/**
 * Render logs in timeline format
 */
function renderLogsTimeline(logs) {
  const container = document.getElementById('symptoms-timeline-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">
        No symptoms logged yet. Use the form to submit your first daily record.
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
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
          <div>
            <strong>Pain Level:</strong> 
            <span class="status-pill" style="background-color: ${painColor}22; color: ${painColor}; border: 1px solid ${painColor}44; font-weight: 700; font-size: 11px; padding: 2px 6px;">
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
              ? `<span class="status-pill" style="background-color: var(--danger)22; color: var(--danger); border: 1px solid var(--danger)44; font-weight: 700; font-size: 11px; padding: 2px 6px;">Active</span>` 
              : `<span class="status-pill" style="background-color: var(--success)22; color: var(--success); border: 1px solid var(--success)44; font-weight: 600; font-size: 11px; padding: 2px 6px;">None</span>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handle form submit
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const errorAlert = document.getElementById('symptom-error');
  const successAlert = document.getElementById('symptom-success');
  const submitBtn = document.getElementById('btn-submit-symptom');

  if (errorAlert) errorAlert.style.display = 'none';
  if (successAlert) successAlert.style.display = 'none';

  // Extract selected fields
  const pain_scale_input = document.querySelector('input[name="pain_scale"]:checked');
  const burning_sensation_input = document.querySelector('input[name="burning_sensation"]:checked');
  const difficulty_opening_mouth_input = document.querySelector('input[name="difficulty_mouth"]:checked');
  const ulcer_duration = document.getElementById('ulcer_duration').value;
  const bleeding_input = document.querySelector('input[name="bleeding"]:checked');

  if (!pain_scale_input || !burning_sensation_input || !difficulty_opening_mouth_input) {
    if (errorAlert) {
      errorAlert.innerText = 'Please complete all required symptom parameters.';
      errorAlert.style.display = 'block';
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Logging symptoms...';

  try {
    const payload = {
      pain_scale: parseInt(pain_scale_input.value, 10),
      burning_sensation: burning_sensation_input.value,
      difficulty_opening_mouth: difficulty_opening_mouth_input.value,
      ulcer_duration: parseInt(ulcer_duration, 10),
      bleeding: bleeding_input.value === 'true'
    };

    const response = await apiRequest('/patients/me/symptoms', {
      method: 'POST',
      body: payload
    });

    if (response.success) {
      if (successAlert) {
        successAlert.innerText = 'Daily symptom log saved successfully!';
        successAlert.style.display = 'block';
      }
      
      // Reset form
      document.getElementById('symptom-log-form').reset();
      
      // Refresh past logs list
      await fetchAndRenderSymptomLogs();
    }
  } catch (err) {
    console.error(err);
    if (errorAlert) {
      errorAlert.innerText = err.message || 'Failed to submit symptom records.';
      errorAlert.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'Log Symptom Record';
  }
}
