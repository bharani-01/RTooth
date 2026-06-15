import { apiRequest, setSessionToken, setUserProfile, getSessionToken, getUserProfile } from './api.js';

// Setup event listeners for forms when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on a guarded page
  initPageGuard();

  // Initialize login page elements
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Initialize registration page elements
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
});

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
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('visible');
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
