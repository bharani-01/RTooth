import { apiRequest, setSessionToken, setUserProfile, getSessionToken, getUserProfile, logoutUser } from './api.js';

// Setup event listeners for forms when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on a guarded page
  initPageGuard();

  // Initialize login page elements
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
    initDemoAccounts();
  }

  // Initialize registration page elements
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
});

/**
 * Initialize Demo Accounts Autofill feature
 */
function initDemoAccounts() {
  const demoItems = document.querySelectorAll('.demo-item');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (!demoItems.length || !emailInput || !passwordInput) return;

  demoItems.forEach(item => {
    item.addEventListener('click', () => {
      const email = item.getAttribute('data-email');
      const password = item.getAttribute('data-password');

      if (email && password) {
        // Set values
        emailInput.value = email;
        passwordInput.value = password;

        // Visual feedback: briefly highlight the inputs
        emailInput.classList.remove('field-highlight');
        passwordInput.classList.remove('field-highlight');
        
        // Force reflow to restart animation
        void emailInput.offsetWidth;
        void passwordInput.offsetWidth;

        emailInput.classList.add('field-highlight');
        passwordInput.classList.add('field-highlight');

        // Remove the classes after animation ends
        setTimeout(() => {
          emailInput.classList.remove('field-highlight');
          passwordInput.classList.remove('field-highlight');
        }, 1200);
      }
    });
  });
}

/**
 * Handle Login Submission
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorAlert = document.getElementById('error-alert');
  const submitBtn = event.target.querySelector('button[type="submit"]');

  hideAlerts();
  setLoading(submitBtn, true, 'Logging in...');

  try {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    if (response.success) {
      const { session, profile } = response.data;
      setSessionToken(session.access_token);
      setUserProfile(profile);

      // Redirect depending on role
      if (profile.role === 'admin') {
        window.location.href = '/admin';
      } else if (profile.role === 'doctor') {
        window.location.href = '/doctor';
      } else {
        window.location.href = '/patient';
      }
    }
  } catch (error) {
    showAlert(errorAlert, error.message);
  } finally {
    setLoading(submitBtn, false, 'Sign In');
  }
}

/**
 * Handle Registration Submission (Doctors Only)
 */
async function handleRegisterSubmit(event) {
  event.preventDefault();

  const firstName = document.getElementById('first_name').value.trim();
  const lastName = document.getElementById('last_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const phone = document.getElementById('phone').value.trim();

  const errorAlert = document.getElementById('error-alert');
  const successAlert = document.getElementById('success-alert');
  const submitBtn = event.target.querySelector('button[type="submit"]');

  hideAlerts();

  const body = {
    email,
    password,
    role: 'admin',
    firstName,
    lastName,
    phone
  };

  setLoading(submitBtn, true, 'Creating Account...');

  try {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body
    });

    if (response.success) {
      showAlert(successAlert, 'Registration successful! Redirecting...');
      
      const { session, profile } = response.data;
      
      if (session?.access_token) {
        setSessionToken(session.access_token);
        setUserProfile(profile);
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1500);
      } else {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    }
  } catch (error) {
    showAlert(errorAlert, error.message);
  } finally {
    setLoading(submitBtn, false, 'Create IT-Admin Account');
  }
}

/**
 * Client-Side Guard to protect routes
 */
async function initPageGuard() {
  const bodyDataset = document.body.dataset;
  const requiresAuth = bodyDataset.authRequired === 'true';
  const allowedRolesString = bodyDataset.allowedRoles;
  
  if (!requiresAuth) return;

  const token = getSessionToken();
  const profile = getUserProfile();

  if (!token || !profile) {
    // Session missing
    window.location.href = '/login';
    return;
  }

  // Check if roles restrictions are defined
  if (allowedRolesString) {
    const allowedRoles = allowedRolesString.split(',');
    if (!allowedRoles.includes(profile.role)) {
      // Access role mismatch -> redirect to their own correct dashboard
      if (profile.role === 'admin') {
        window.location.href = '/admin';
      } else if (profile.role === 'doctor') {
        window.location.href = '/doctor';
      } else {
        window.location.href = '/patient';
      }
      return;
    }
  }

  // Backend session integrity double-check
  try {
    const response = await apiRequest('/auth/me');
    if (!response.success || response.data.profile.role !== profile.role) {
      throw new Error('Session invalid');
    }
    // Update local profile with latest data
    setUserProfile(response.data.profile);
    
    // Dispatch event that user info has been verified & loaded
    document.dispatchEvent(new CustomEvent('auth-verified', { detail: response.data.profile }));
  } catch (error) {
    console.error('Session guard verification failed:', error.message);
    window.location.href = '/login';
  }
}

/* Helper UI Actions */
function showAlert(element, message) {
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

// Apply collapsed state on page load if saved in localStorage
if (localStorage.getItem('sidebar-collapsed') === 'true' && window.innerWidth > 992) {
  document.body.classList.add('sidebar-collapsed');
}

/**
 * Initialize Mobile Menu Toggler & Backdrop
 */
export function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar-container') || document.querySelector('.sidebar');
  if (!toggleBtn || !sidebar) return;

  // Create backdrop overlay dynamically if not exists
  let backdrop = document.getElementById('mobile-sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'mobile-sidebar-backdrop';
    backdrop.className = 'mobile-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  // Toggle events
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth > 992) {
      document.body.classList.toggle('sidebar-collapsed');
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', isCollapsed ? 'true' : 'false');
    } else {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('visible');
    }
  });

  // Close events
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
  });

  // Close when clicking sidebar links on mobile
  const sidebarLinks = sidebar.querySelectorAll('.sidebar-item, .btn');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('visible');
    });
  });
}

// Bind to window for easy global access across modular scripts
window.initMobileMenu = initMobileMenu;

export function showConfirmModal(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    // 1. Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    
    // 2. Create card content
    overlay.innerHTML = `
      <div class="custom-modal-card">
        <div class="custom-modal-icon warning">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="custom-modal-title">${title}</h3>
        <p class="custom-modal-message">${message}</p>
        <div class="custom-modal-actions">
          <button class="btn btn-secondary modal-cancel-btn">Cancel</button>
          <button class="btn btn-primary btn-teal modal-confirm-btn">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (value) => {
      overlay.classList.add('animate-fadeOut');
      overlay.addEventListener('animationend', () => {
        overlay.remove();
      });
      resolve(value);
    };

    overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.modal-confirm-btn').addEventListener('click', () => cleanup(true));
  });
}

export function showAlertModal(message, title = 'Notification') {
  const existing = document.querySelector('.custom-modal-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'custom-modal-overlay';
  
  overlay.innerHTML = `
    <div class="custom-modal-card">
      <div class="custom-modal-icon info">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h3 class="custom-modal-title">${title}</h3>
      <p class="custom-modal-message">${message}</p>
      <div class="custom-modal-actions single">
        <button class="btn btn-primary modal-ok-btn">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cleanup = () => {
    overlay.classList.add('animate-fadeOut');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
    });
  };

  overlay.querySelector('.modal-ok-btn').addEventListener('click', cleanup);
}

window.showConfirmModal = showConfirmModal;
window.showAlertModal = showAlertModal;

// Override native window.alert globally
window.alert = function(message) {
  showAlertModal(message);
};

// Override native window.confirm globally as a fallback to prevent native popups
window.confirm = function(message) {
  showAlertModal(message, 'Action Required');
  return false;
};

// Delegate Logout Button Click Handler globally
document.addEventListener('click', async (e) => {
  const logoutBtn = e.target.closest('#admin-logout-btn, #doctor-logout-btn, #patient-logout-btn');
  if (logoutBtn) {
    e.preventDefault();
    e.stopPropagation();
    const roleName = logoutBtn.id.includes('admin') ? 'IT-Admin' : logoutBtn.id.includes('doctor') ? 'Oncologist' : 'Patient';
    const confirmed = await showConfirmModal(`Are you sure you want to end your ${roleName} session?`, 'Confirm Logout');
    if (confirmed) {
      await logoutUser();
    }
  }
});
