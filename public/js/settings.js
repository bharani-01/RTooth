import { apiRequest, getUserProfile } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load Doctor Sidebar
  await loadDoctorSidebar();

  // Load Header Info
  const profile = getUserProfile();
  if (profile && profile.role === 'doctor') {
    populateDoctorHeader(profile);
  }

  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'doctor') {
      populateDoctorHeader(profile);
    }
  });

  // Initialize Theme Cards UI
  initThemeSettings();
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
      if (id === 'menu-doctor-settings') {
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
 * Initialize theme selection and toggle bindings
 */
function initThemeSettings() {
  const currentTheme = localStorage.getItem('theme') || 'system';
  
  // Set active class on corresponding card
  const activeCard = document.querySelector(`.theme-card[data-value="${currentTheme}"]`);
  if (activeCard) {
    activeCard.classList.add('active');
  }

  // Bind click handlers to cards
  const cards = document.querySelectorAll('.theme-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove active class from all cards
      cards.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked card
      card.classList.add('active');
      
      // Get theme value
      const themeVal = card.getAttribute('data-value');
      
      // Save preference
      localStorage.setItem('theme', themeVal);
      
      // Apply theme immediately
      applyTheme(themeVal);
    });
  });
}

/**
 * Dynamically apply theme variables
 */
function applyTheme(theme) {
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Watch system preference changes to keep "system" setting sync'd live
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const currentTheme = localStorage.getItem('theme') || 'system';
  if (currentTheme === 'system') {
    applyTheme('system');
  }
});
