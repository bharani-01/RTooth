// Intercept all fetch requests globally to show the header loading bar
const originalFetch = window.fetch;
let activeRequestsCount = 0;

window.fetch = async function (...args) {
  activeRequestsCount++;
  const header = document.querySelector('header');
  if (header) header.classList.add('loading');
  
  try {
    return await originalFetch(...args);
  } finally {
    activeRequestsCount--;
    if (activeRequestsCount <= 0) {
      activeRequestsCount = 0;
      const header = document.querySelector('header');
      if (header) header.classList.remove('loading');
    }
  }
};

const API_BASE = '/api/v1';

/**
 * Escapes HTML special characters to prevent stored XSS in innerHTML templates.
 * MUST be called on ALL server-supplied strings before inserting into innerHTML.
 */
export const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

export const getSessionToken = () => {
  return sessionStorage.getItem('supabase_auth_token');
};

export const setSessionToken = (token) => {
  sessionStorage.setItem('supabase_auth_token', token);
};

export const clearSessionToken = () => {
  sessionStorage.removeItem('supabase_auth_token');
  sessionStorage.removeItem('user_profile');
};

export const getUserProfile = () => {
  const profile = sessionStorage.getItem('user_profile');
  return profile ? JSON.parse(profile) : null;
};

export const setUserProfile = (profile) => {
  if (!profile) return;
  // Only cache what the client-side guard needs. Never persist PHI client-side.
  const safeProfile = {
    id: profile.id,
    role: profile.role,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    status: profile.status,
    // Doctor-specific (non-sensitive)
    doctor_code: profile.doctor_code || undefined,
    // Patient-specific (non-sensitive)
    patient_code: profile.patient_code || undefined,
    // Admin-specific
    admin_code: profile.admin_code || undefined,
  };
  sessionStorage.setItem('user_profile', JSON.stringify(safeProfile));
};

/**
 * Perform an authenticated API request
 * @param {string} endpoint - API path (e.g. '/auth/me')
 * @param {object} options - Fetch options
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Add token if present
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred during the request.');
  }

  return data;
};

/**
 * Log out user from backend and clean up locally
 */
export const logoutUser = async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout backend sync error:', err.message);
  } finally {
    clearSessionToken();
    window.location.href = '/login';
  }
};
