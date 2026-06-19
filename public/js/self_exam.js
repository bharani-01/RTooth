import { apiRequest, getUserProfile } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  const totalSteps = 6;

  // Header demographic loading
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientHeader(initialProfile);
  }

  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientHeader(profile);
    }
  });

  // Initialize mobile menu
  if (window.initMobileMenu) {
    window.initMobileMenu();
  }

  // UI DOM elements
  const nextBtn = document.getElementById('next-btn');
  const backBtn = document.getElementById('back-btn');
  const warningPanel = document.getElementById('warning-panel');
  const healthyPanel = document.getElementById('healthy-panel');
  const examError = document.getElementById('exam-error');

  const stepsMetadata = {
    2: {
      name: 'Lips & Gums',
      healthy: 'chk-step2-healthy',
      symptoms: {
        'chk-step2-patches': 'White or red patches detected',
        'chk-step2-swelling': 'Swelling or lumps detected'
      }
    },
    3: {
      name: 'Tongue Borders',
      healthy: 'chk-step3-healthy',
      symptoms: {
        'chk-step3-ulcers': 'Non-healing sores or ulcers detected',
        'chk-step3-patches': 'White or red patches detected'
      }
    },
    4: {
      name: 'Cheeks & Palate',
      healthy: 'chk-step4-healthy',
      symptoms: {
        'chk-step4-ulcers': 'Non-healing sores or ulcers detected',
        'chk-step4-swelling': 'Swelling, lumps or texture changes detected'
      }
    },
    5: {
      name: 'Floor of Mouth',
      healthy: 'chk-step5-healthy',
      symptoms: {
        'chk-step5-swelling': 'Swelling, lumps or hard nodes under tongue detected',
        'chk-step5-opening': 'Difficulty opening mouth or pain swallowing reported'
      }
    }
  };

  // ── 1. Wizard Step Navigation & Validation ──
  nextBtn.addEventListener('click', async () => {
    if (currentStep === 1) {
      currentStep++;
      updateWizardUI();
    } else if (currentStep >= 2 && currentStep <= 5) {
      const step = stepsMetadata[currentStep];
      const healthyCb = document.getElementById(step.healthy);
      const symptomIds = Object.keys(step.symptoms);
      const symptomCbs = symptomIds.map(id => document.getElementById(id));
      const anyCheckedInStep = (healthyCb && healthyCb.checked) || symptomCbs.some(cb => cb && cb.checked);

      if (!anyCheckedInStep) {
        showError('Please check at least one finding or select "No abnormal findings" before proceeding.');
        return;
      }
      clearError();
      currentStep++;
      updateWizardUI();
    } else {
      // Step 6: Trigger exam logging
      await submitExamFindings();
    }
  });

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizardUI();
    }
  });

  function updateWizardUI() {
    clearError();
    // Hide all step panels
    for (let i = 1; i <= totalSteps; i++) {
      const panel = document.getElementById(`step-panel-${i}`);
      if (panel) panel.classList.remove('active');
    }
    // Show active step panel
    const currentPanel = document.getElementById(`step-panel-${currentStep}`);
    if (currentPanel) currentPanel.classList.add('active');

    // Update Step Timeline Circles
    document.querySelectorAll('#steps-indicator .step-indicator-item').forEach(item => {
      const stepVal = parseInt(item.getAttribute('data-step'), 10);
      item.classList.remove('active', 'completed');
      if (stepVal === currentStep) {
        item.classList.add('active');
      } else if (stepVal < currentStep) {
        item.classList.add('completed');
      }
    });

    // Update Step Connecting Lines
    for (let i = 1; i < totalSteps; i++) {
      const line = document.getElementById(`line-${i}`);
      if (line) {
        line.classList.remove('active', 'completed');
        if (i < currentStep - 1) {
          line.classList.add('completed');
        } else if (i === currentStep - 1) {
          line.classList.add('active');
        }
      }
    }

    // Configure Navigation Buttons
    backBtn.disabled = currentStep === 1;
    
    if (currentStep === totalSteps) {
      nextBtn.innerText = 'Log Exam Record';
      compileSummaryReport();
    } else {
      nextBtn.innerText = 'Next Step';
    }

    // Scroll to top of wizard on transition
    const wrapper = document.querySelector('.exam-wrapper');
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── 2. Checklist Interaction Logic ──
  Object.keys(stepsMetadata).forEach(stepNum => {
    const step = stepsMetadata[stepNum];
    const healthyCb = document.getElementById(step.healthy);
    const symptomCbs = Object.keys(step.symptoms).map(id => document.getElementById(id));

    if (healthyCb) {
      healthyCb.addEventListener('change', () => {
        if (healthyCb.checked) {
          symptomCbs.forEach(cb => {
            if (cb) {
              cb.checked = false;
              updatePillStyle(cb, false, false);
            }
          });
          updatePillStyle(healthyCb, true, true);
        } else {
          updatePillStyle(healthyCb, false, true);
        }
      });
    }

    symptomCbs.forEach(cb => {
      if (cb) {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (healthyCb) {
              healthyCb.checked = false;
              updatePillStyle(healthyCb, false, true);
            }
            updatePillStyle(cb, true, false);
          } else {
            updatePillStyle(cb, false, false);
          }
        });
      }
    });
  });

  function updatePillStyle(checkbox, isChecked, isHealthy) {
    const pill = checkbox.closest('.step-option-pill');
    if (!pill) return;
    if (isChecked) {
      if (isHealthy) {
        pill.classList.add('selected-healthy');
        pill.classList.remove('selected');
      } else {
        pill.classList.add('selected');
        pill.classList.remove('selected-healthy');
      }
    } else {
      pill.classList.remove('selected', 'selected-healthy');
    }
  }

  function compileSummaryReport() {
    const listStack = document.getElementById('summary-findings-list');
    if (!listStack) return;

    listStack.innerHTML = '';
    let totalSymptomsCount = 0;

    Object.keys(stepsMetadata).forEach(stepNum => {
      const step = stepsMetadata[stepNum];
      const healthyCb = document.getElementById(step.healthy);
      
      if (healthyCb && healthyCb.checked) {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
          <div class="summary-item-icon healthy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/>
            </svg>
          </div>
          <div class="summary-item-text">
            Step ${stepNum}: ${step.name} &mdash; <span style="color: #15803d; font-weight: 500;">No abnormal findings</span>
          </div>
        `;
        listStack.appendChild(item);
      } else {
        Object.keys(step.symptoms).forEach(symId => {
          const cb = document.getElementById(symId);
          if (cb && cb.checked) {
            totalSymptomsCount++;
            const item = document.createElement('div');
            item.className = 'summary-item';
            item.innerHTML = `
              <div class="summary-item-icon warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div class="summary-item-text">
                Step ${stepNum}: ${step.name} &mdash; <span style="color: #b91c1c; font-weight: 600;">${step.symptoms[symId]}</span>
              </div>
            `;
            listStack.appendChild(item);
          }
        });
      }
    });

    if (totalSymptomsCount > 0) {
      warningPanel.classList.add('active');
      healthyPanel.classList.remove('active');
    } else {
      healthyPanel.classList.add('active');
      warningPanel.classList.remove('active');
    }
  }

  // ── 3. Submit Handler & Clinical Auto-Logging ──
  async function submitExamFindings() {
    clearError();

    nextBtn.disabled = true;
    nextBtn.innerText = 'Submitting...';

    try {
      // Map self-exam findings to standard tracker inputs
      let pain = 0;
      let burning = 'None';
      let mouthOpening = 'None';
      let duration = 0;
      let bleeding = false;

      // Determine checked statuses from steps 2-5
      const checkedUlcers = document.getElementById('chk-step3-ulcers').checked || document.getElementById('chk-step4-ulcers').checked;
      const checkedRedPatches = document.getElementById('chk-step2-patches').checked || document.getElementById('chk-step3-patches').checked;
      const checkedWhitePatches = document.getElementById('chk-step2-patches').checked || document.getElementById('chk-step3-patches').checked;
      const checkedSwelling = document.getElementById('chk-step2-swelling').checked || document.getElementById('chk-step4-swelling').checked || document.getElementById('chk-step5-swelling').checked;
      const checkedOpening = document.getElementById('chk-step5-opening').checked;

      const allHealthy = !checkedUlcers && !checkedRedPatches && !checkedWhitePatches && !checkedSwelling && !checkedOpening;

      if (allHealthy) {
        pain = 0;
        burning = 'None';
        mouthOpening = 'None';
        duration = 0;
        bleeding = false;
      } else {
        if (checkedUlcers) {
          pain = 5;
          duration = 14;
          bleeding = true;
          burning = 'Moderate';
        }
        if (checkedRedPatches) {
          if (pain < 4) pain = 4;
          burning = 'Moderate';
        }
        if (checkedWhitePatches) {
          if (pain < 2) pain = 2;
          if (burning === 'None') burning = 'Mild';
        }
        if (checkedSwelling) {
          if (pain < 3) pain = 3;
        }
        if (checkedOpening) {
          mouthOpening = 'Severe';
        }
      }

      const payload = {
        pain_scale: pain,
        burning_sensation: burning,
        difficulty_opening_mouth: mouthOpening,
        ulcer_duration: duration,
        bleeding: bleeding
      };

      const response = await apiRequest('/patients/me/symptoms', {
        method: 'POST',
        body: payload
      });

      if (response.success) {
        window.location.href = '/patient/symptoms';
      } else {
        showError(response.message || 'Failed to submit findings.');
      }
    } catch (err) {
      console.error('Error logging exam findings:', err);
      showError(err.message || 'Failed to save examination records.');
    } finally {
      nextBtn.disabled = false;
      if (currentStep === totalSteps) {
        nextBtn.innerText = 'Log Exam Record';
      } else {
        nextBtn.innerText = 'Next Step';
      }
    }
  }

  function showError(msg) {
    if (examError) {
      examError.innerText = msg;
      examError.style.display = 'block';
    }
    const wrapper = document.querySelector('.exam-wrapper');
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  function clearError() {
    if (examError) {
      examError.style.display = 'none';
      examError.innerText = '';
    }
  }

  function populatePatientHeader(profile) {
    const fullName = `${profile.first_name} ${profile.last_name}`;
    const nameBadge = document.getElementById('patient-name-badge');
    const avatar = document.getElementById('patient-avatar');
    if (nameBadge) nameBadge.innerText = fullName;
    if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  }
});
