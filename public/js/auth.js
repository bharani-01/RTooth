import { apiRequest, setSessionToken, setUserProfile, getSessionToken, getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on a guarded page
  initPageGuard();

  // Initialize login page elements
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
    initDemoAccounts();
    initLoginFeatures();
  }

  // Initialize registration page elements
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }

  // Initialize reset password page
  const path = window.location.pathname;
  if (path.includes('/reset_password') || document.getElementById('reset-password-form')) {
    initResetPasswordPage();
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
  const errorAlert = document.getElementById('error-alert');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const isOtpActive = document.getElementById('otp-group').style.display !== 'none';

  hideAlerts();
  setLoading(submitBtn, true, isOtpActive ? 'Verifying OTP...' : 'Logging in...');

  try {
    let response;
    if (isOtpActive) {
      const code = document.getElementById('otp-code').value.trim();
      if (!code) throw new Error('Please enter the 6-digit code sent to your email.');
      response = await apiRequest('/auth/otp/verify', {
        method: 'POST',
        body: { email, token: code }
      });
    } else {
      const password = document.getElementById('password').value;
      response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
    }

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
    setLoading(submitBtn, false, isOtpActive ? 'Verify & Sign In' : 'Sign In');
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

function initLoginFeatures() {
  const tabPassword = document.getElementById('tab-password');
  const tabOtp = document.getElementById('tab-otp');
  const passwordGroup = document.getElementById('password-group');
  const otpGroup = document.getElementById('otp-group');
  const passwordInput = document.getElementById('password');
  const otpInput = document.getElementById('otp-code');
  const sendOtpBtn = document.getElementById('btn-send-otp');
  
  const forgotTrigger = document.getElementById('forgot-password-trigger');
  const loginCard = document.getElementById('login-card');
  const forgotCard = document.getElementById('forgot-password-card');
  const forgotForm = document.getElementById('forgot-password-form');
  const forgotBackBtn = document.getElementById('forgot-back-btn');

  if (tabPassword && tabOtp) {
    tabPassword.style.borderBottom = '2px solid var(--primary)';
    tabPassword.style.color = 'var(--text)';
    tabPassword.style.fontWeight = '600';

    tabPassword.addEventListener('click', () => {
      tabPassword.classList.add('active');
      tabPassword.style.borderBottom = '2px solid var(--primary)';
      tabPassword.style.color = 'var(--text)';
      tabPassword.style.fontWeight = '600';

      tabOtp.classList.remove('active');
      tabOtp.style.borderBottom = '2px solid transparent';
      tabOtp.style.color = 'var(--text-muted)';
      tabOtp.style.fontWeight = '500';

      passwordGroup.style.display = 'block';
      otpGroup.style.display = 'none';
      passwordInput.required = true;
      otpInput.required = false;

      document.getElementById('login-submit-btn').innerText = 'Sign In';
    });

    tabOtp.addEventListener('click', () => {
      tabOtp.classList.add('active');
      tabOtp.style.borderBottom = '2px solid var(--primary)';
      tabOtp.style.color = 'var(--text)';
      tabOtp.style.fontWeight = '600';

      tabPassword.classList.remove('active');
      tabPassword.style.borderBottom = '2px solid transparent';
      tabPassword.style.color = 'var(--text-muted)';
      tabPassword.style.fontWeight = '500';

      passwordGroup.style.display = 'none';
      otpGroup.style.display = 'block';
      passwordInput.required = false;
      otpInput.required = true;

      document.getElementById('login-submit-btn').innerText = 'Verify & Sign In';
    });
  }

  // OTP Sending logic
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
      const email = document.getElementById('email').value.trim();
      const errorAlert = document.getElementById('error-alert');
      if (!email) {
        showAlert(errorAlert, 'Please enter your email address to receive the verification code.');
        return;
      }
      hideAlerts();
      setLoading(sendOtpBtn, true, 'Sending...');
      try {
        const response = await apiRequest('/auth/otp/send', {
          method: 'POST',
          body: { email }
        });
        if (response.success) {
          document.getElementById('otp-sent-help').style.display = 'block';
          // Start a 60s cooldown
          let cooldown = 60;
          sendOtpBtn.disabled = true;
          sendOtpBtn.innerText = `Resend (${cooldown}s)`;
          const interval = setInterval(() => {
            cooldown--;
            if (cooldown <= 0) {
              clearInterval(interval);
              sendOtpBtn.disabled = false;
              sendOtpBtn.innerText = 'Resend Code';
            } else {
              sendOtpBtn.innerText = `Resend (${cooldown}s)`;
            }
          }, 1000);
        }
      } catch (err) {
        showAlert(errorAlert, err.message);
        setLoading(sendOtpBtn, false, 'Send Code');
      }
    });
  }

  // Forgot Password switching
  if (forgotTrigger && loginCard && forgotCard) {
    forgotTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      loginCard.style.display = 'none';
      forgotCard.style.display = 'block';
      hideAlerts();
    });
  }

  if (forgotBackBtn && loginCard && forgotCard) {
    forgotBackBtn.addEventListener('click', () => {
      forgotCard.style.display = 'none';
      loginCard.style.display = 'block';
      hideAlerts();
    });
  }

  // Forgot password form submission
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();
      const errorAlert = document.getElementById('forgot-error-alert');
      const successAlert = document.getElementById('forgot-success-alert');
      const submitBtn = document.getElementById('forgot-submit-btn');

      hideAlerts();
      setLoading(submitBtn, true, 'Sending link...');

      try {
        const response = await apiRequest('/auth/forgot-password', {
          method: 'POST',
          body: { email }
        });
        if (response.success) {
          showAlert(successAlert, 'Recovery link sent! Check your inbox for Supabase email.');
          document.getElementById('forgot-email').value = '';
        }
      } catch (err) {
        showAlert(errorAlert, err.message);
      } finally {
        setLoading(submitBtn, false, 'Send Reset Link');
      }
    });
  }
}

function initResetPasswordPage() {
  const resetForm = document.getElementById('reset-password-form');
  const tokenStatus = document.getElementById('token-status');
  const errorAlert = document.getElementById('reset-error-alert');
  const successAlert = document.getElementById('reset-success-alert');
  const redirectContainer = document.getElementById('login-redirect-container');
  const submitBtn = document.getElementById('reset-submit-btn');

  // Extract access token from URL hash fragment (#access_token=...&refresh_token=...)
  const hash = window.location.hash || '';
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');

  if (!token) {
    if (tokenStatus) {
      tokenStatus.innerText = 'No valid recovery token was found in the URL. Please trigger a new password reset link from the login page.';
      tokenStatus.style.color = 'var(--danger)';
    }
    if (redirectContainer) redirectContainer.style.display = 'block';
    return;
  }

  // Token found, allow updating
  if (tokenStatus) tokenStatus.style.display = 'none';
  if (resetForm) resetForm.style.display = 'block';

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        showAlert(errorAlert, 'Passwords do not match.');
        return;
      }

      if (errorAlert) errorAlert.style.display = 'none';
      if (successAlert) successAlert.style.display = 'none';
      setLoading(submitBtn, true, 'Updating password...');

      try {
        const response = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { token, newPassword }
        });
        if (response.success) {
          showAlert(successAlert, 'Password updated successfully! You can now sign in.');
          resetForm.style.display = 'none';
          if (redirectContainer) redirectContainer.style.display = 'block';
        }
      } catch (err) {
        showAlert(errorAlert, err.message);
      } finally {
        setLoading(submitBtn, false, 'Update Password');
      }
    });
  }
}

