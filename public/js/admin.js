import { apiRequest, getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Dynamically Load Sidebar
  await loadAdminSidebar();

  // 2. Pre-load admin details from localStorage
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'admin') {
    populateAdminDetails(initialProfile);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'admin') {
      populateAdminDetails(profile);
    }
  });

  // 3. Trigger page-specific logic
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/admin/')) {
    loadDoctorsCount();
  } else if (path.endsWith('doctors.html')) {
    loadDoctorDirectory();
  } else if (path.endsWith('register_doctor.html')) {
    const registerDocForm = document.getElementById('register-doctor-form');
    if (registerDocForm) {
      registerDocForm.addEventListener('submit', handleDoctorRegister);
    }
  }
});

/**
 * Load the shared admin sidebar and highlight the active link
 */
async function loadAdminSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  try {
    const response = await fetch('/shared/admin_sidebar.html');
    if (!response.ok) throw new Error('Failed to fetch sidebar');
    const html = await response.text();
    sidebarContainer.innerHTML = html;

    // Highlight active link based on current path
    const path = window.location.pathname;
    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      // Match path suffix or exact match
      if (path === href || path.endsWith(href) || (href === '/admin/index.html' && path.endsWith('/admin/'))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Re-bind Logout Button since it's dynamically loaded now!
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to end your IT-Admin session?')) {
          await logoutUser();
        }
      });
    }

    if (window.initMobileMenu) {
      window.initMobileMenu();
    }
  } catch (error) {
    console.error('Error loading admin sidebar:', error.message);
  }
}

/**
 * Populate UI with Admin profile details
 */
function populateAdminDetails(profile) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  
  const welcomeBadge = document.getElementById('admin-name-badge');
  const avatarBadge = document.getElementById('admin-avatar');
  
  const welcomeTitle = document.getElementById('admin-full-name');
  const welcomeEmail = document.getElementById('admin-email');

  if (welcomeBadge) welcomeBadge.innerText = fullName;
  if (avatarBadge) avatarBadge.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  
  if (welcomeTitle) welcomeTitle.innerText = fullName;
  if (welcomeEmail) welcomeEmail.innerText = profile.email;
}

/**
 * Fetch and display the count of registered doctors (for the Overview page)
 */
async function loadDoctorsCount() {
  const doctorCountStat = document.getElementById('stat-doctors-count');
  if (!doctorCountStat) return;

  try {
    const response = await apiRequest('/auth/admin/doctors');
    if (response.success) {
      doctorCountStat.innerText = response.data.doctors.length;
    }
  } catch (error) {
    console.error('Error loading doctors count:', error.message);
    doctorCountStat.innerText = 'Error';
  }
}

/**
 * Query the backend for all registered doctors
 */
async function loadDoctorDirectory() {
  const tableBody = document.getElementById('doctors-table-body');
  if (!tableBody) return;

  try {
    const response = await apiRequest('/auth/admin/doctors');
    if (response.success) {
      const doctors = response.data.doctors;
      
      if (doctors.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No doctors registered in the system.</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = doctors.map(doc => `
        <tr>
          <td data-label="Doctor"><strong>Dr. ${doc.first_name} ${doc.last_name}</strong></td>
          <td data-label="Specialization"><span style="font-weight: 500; color: var(--primary);">${doc.specialization}</span></td>
          <td data-label="License Number"><code>${doc.license_number}</code></td>
          <td data-label="Email">${doc.email}</td>
          <td data-label="Phone">${doc.phone || 'N/A'}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading doctor list:', error.message);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--danger); padding: 24px;">Failed to load doctor directory.</td>
      </tr>
    `;
  }
}

/**
 * Handle submission of the Doctor Registration form
 */
async function handleDoctorRegister(event) {
  event.preventDefault();

  const firstName = document.getElementById('doc_first_name').value.trim();
  const lastName = document.getElementById('doc_last_name').value.trim();
  const email = document.getElementById('doc_email').value.trim();
  const password = document.getElementById('doc_password').value;
  const phone = document.getElementById('doc_phone').value.trim();
  const specialization = document.getElementById('doc_specialization').value.trim();
  const licenseNumber = document.getElementById('doc_license_number').value.trim();

  const errorAlert = document.getElementById('error-alert');
  const successAlert = document.getElementById('success-alert');
  const submitBtn = event.target.querySelector('button[type="submit"]');

  hideAlerts();
  setLoading(submitBtn, true, 'Registering Practitioner...');

  const body = {
    email,
    password,
    firstName,
    lastName,
    phone,
    specialization,
    licenseNumber
  };

  try {
    const response = await apiRequest('/auth/admin/register-doctor', {
      method: 'POST',
      body
    });

    if (response.success) {
      showNotification(successAlert, 'Doctor registered successfully!');
      event.target.reset(); // Clear form inputs
    }
  } catch (error) {
    showNotification(errorAlert, error.message);
  } finally {
    setLoading(submitBtn, false, 'Register Oncologist');
  }
}

/* UI Helper functions */
function showNotification(element, message) {
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
