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
  if (path.endsWith('/admin') || path.endsWith('/admin/') || path.endsWith('index.html') || path.endsWith('/admin/index.html')) {
    loadDoctorsCount();
    initOverviewLiveWidgets();
  } else if (path.endsWith('/doctors') || path.endsWith('doctors.html')) {
    loadDoctorDirectory();
  } else if (path.endsWith('/register_doctor') || path.endsWith('register_doctor.html')) {
    const registerDocForm = document.getElementById('register-doctor-form');
    if (registerDocForm) {
      registerDocForm.addEventListener('submit', handleDoctorRegister);
    }
  } else if (path.endsWith('/audit_logs') || path.endsWith('audit_logs.html')) {
    initAuditLogsPage();
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
    const cleanPath = path.replace(/\/$/, '').replace(/\.html$/, '');
    const sidebarItems = sidebarContainer.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      const cleanHref = href.replace(/\/$/, '').replace(/\.html$/, '');
      if (cleanPath === cleanHref || cleanPath.endsWith(cleanHref) || (cleanHref === '/admin' && cleanPath === '/admin')) {
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
    const response = await apiRequest('/doctors');
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
    const response = await apiRequest('/doctors');
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
    const response = await apiRequest('/doctors', {
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

/* ─────────────────────────────────────────
   SYSTEM AUDIT LOGS FUNCTIONALITY
───────────────────────────────────────── */
let rawAuditLogs = [];
let filteredLogs = [];
let auditPage = 1;
const auditLimit = 15;
let lineChartInstance = null;
let doughnutChartInstance = null;

let currentSortField = 'created_at';
let currentSortOrder = 'desc'; // 'asc' or 'desc'

function initAuditLogsPage() {
  const searchInput = document.getElementById('audit-search-input');
  const methodFilter = document.getElementById('audit-method-filter');
  const statusFilter = document.getElementById('audit-status-filter');
  const roleFilter = document.getElementById('audit-role-filter');
  const latencyFilter = document.getElementById('audit-latency-filter');
  const timeframeFilter = document.getElementById('audit-timeframe-filter');
  
  const refreshBtn = document.getElementById('audit-refresh-btn');
  const prevBtn = document.getElementById('audit-prev-page-btn');
  const nextBtn = document.getElementById('audit-next-page-btn');
  const pageInfo = document.getElementById('audit-page-info');
  const tableBody = document.getElementById('audit-table-body');
  const tableHeaders = document.querySelectorAll('.clinic-table th.sortable');

  const toggleFiltersBtn = document.getElementById('btn-toggle-filters');
  const filtersDrawer = document.getElementById('filters-drawer');

  const modal = document.getElementById('audit-details-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');

  if (!tableBody) return;

  // Toggle advanced filters drawer
  if (toggleFiltersBtn && filtersDrawer) {
    toggleFiltersBtn.addEventListener('click', () => {
      filtersDrawer.classList.toggle('open');
      toggleFiltersBtn.classList.toggle('active');
    });
  }

  // Search Debouncer
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchLogs();
    }, 400); // 400ms typing debounce
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      fetchLogs();
    }
  });

  // Filters that require database re-fetch (search, method, status)
  methodFilter.addEventListener('change', () => fetchLogs());
  statusFilter.addEventListener('change', () => fetchLogs());
  refreshBtn.addEventListener('click', () => fetchLogs());

  // Client-side local pipeline filters (role, latency, timeframe)
  roleFilter.addEventListener('change', () => processData());
  latencyFilter.addEventListener('change', () => processData());
  timeframeFilter.addEventListener('change', () => processData());

  // Table header sorting clicks
  tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort-field');
      handleSort(field);
    });
  });

  prevBtn.addEventListener('click', () => {
    if (auditPage > 1) {
      auditPage--;
      renderLogsTable();
    }
  });

  nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredLogs.length / auditLimit);
    if (auditPage < totalPages) {
      auditPage++;
      renderLogsTable();
    }
  });

  // Modal close handlers
  const closeModal = () => {
    modal.classList.remove('show');
  };
  
  closeModalBtn.addEventListener('click', closeModal);
  closeModalFooterBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Initial Fetch
  fetchLogs();

  async function fetchLogs() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
          <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
            <svg class="loading-spinner" style="width: 16px; height: 16px; animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            <span>Querying security logs...</span>
          </div>
        </td>
      </tr>
    `;

    const searchVal = searchInput.value.trim();
    const methodVal = methodFilter.value;
    const statusVal = statusFilter.value;

    let url = `/doctors/audit-logs?limit=100`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;
    if (methodVal) url += `&method=${encodeURIComponent(methodVal)}`;
    if (statusVal) url += `&status=${encodeURIComponent(statusVal)}`;

    try {
      const response = await apiRequest(url);
      if (response.success) {
        rawAuditLogs = response.data.logs || [];
        processData();
      } else {
        throw new Error(response.message || 'Unknown database retrieval issue');
      }
    } catch (err) {
      console.error('[AUDIT PAGE FETCH ERROR]', err);
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--danger); padding: 32px;">
            <div style="font-weight: 600;">Failed to retrieve audit log cache</div>
            <div style="font-size: 12px; margin-top: 4px;">${err.message || 'Ensure db_audit_logs.sql schema is run.'}</div>
          </td>
        </tr>
      `;
      // Clear charts or show empty state
      updateCharts([]);
      updateMetrics([]);
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      pageInfo.innerText = `Page 1 of 1 (0 total)`;
    }
  }

  // Run filtering and sorting pipeline on rawAuditLogs -> filteredLogs
  function processData() {
    let result = [...rawAuditLogs];

    // 1. Apply client-side role filter
    const roleVal = roleFilter.value;
    if (roleVal) {
      if (roleVal === 'anonymous') {
        result = result.filter(log => !log.user_role || log.user_role === 'anonymous' || !log.user_email);
      } else {
        result = result.filter(log => log.user_role === roleVal);
      }
    }

    // 2. Apply client-side latency filter
    const latencyVal = latencyFilter.value;
    if (latencyVal) {
      if (latencyVal === 'fast') {
        result = result.filter(log => log.response_time_ms < 100);
      } else if (latencyVal === 'medium') {
        result = result.filter(log => log.response_time_ms >= 100 && log.response_time_ms <= 500);
      } else if (latencyVal === 'slow') {
        result = result.filter(log => log.response_time_ms > 500);
      }
    }

    // 3. Apply client-side timeframe filter
    const timeframeVal = timeframeFilter.value;
    if (timeframeVal) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (timeframeVal === 'today') {
        result = result.filter(log => new Date(log.created_at) >= startOfToday);
      } else if (timeframeVal === 'week') {
        result = result.filter(log => new Date(log.created_at) >= startOfWeek);
      } else if (timeframeVal === 'month') {
        result = result.filter(log => new Date(log.created_at) >= startOfMonth);
      }
    }

    // 4. Calculate KPI metrics
    updateMetrics(result);

    // 5. Update Chart.js datasets based on active matching set
    updateCharts(result);

    // 6. Sort dataset based on active sort parameters
    sortData(result);

    filteredLogs = result;
    auditPage = 1;
    renderLogsTable();
  }

  // Handle header sorting click logic
  function handleSort(field) {
    if (currentSortField === field) {
      currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortField = field;
      currentSortOrder = 'desc'; // Default to newest/highest value first
    }

    // Update Header chevron icons
    tableHeaders.forEach(th => {
      const f = th.getAttribute('data-sort-field');
      if (f === currentSortField) {
        th.classList.add('sort-active');
        if (currentSortOrder === 'desc') {
          th.classList.add('sort-desc');
        } else {
          th.classList.remove('sort-desc');
        }
      } else {
        th.classList.remove('sort-active', 'sort-desc');
      }
    });

    sortData(filteredLogs);
    auditPage = 1;
    renderLogsTable();
  }

  // Sorts array in place based on currentSortField and currentSortOrder
  function sortData(arr) {
    arr.sort((a, b) => {
      let valA = a[currentSortField];
      let valB = b[currentSortField];

      // Safe fallback for nulls
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (currentSortField === 'created_at') {
        return (new Date(valA) - new Date(valB)) * (currentSortOrder === 'asc' ? 1 : -1);
      }
      
      if (currentSortField === 'status_code') {
        return (parseInt(valA, 10) - parseInt(valB, 10)) * (currentSortOrder === 'asc' ? 1 : -1);
      }

      // Default string compare
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return strA.localeCompare(strB) * (currentSortOrder === 'asc' ? 1 : -1);
    });
  }

  function renderLogsTable() {
    const totalLogs = filteredLogs.length;
    const totalPages = Math.ceil(totalLogs / auditLimit) || 1;
    
    if (totalLogs === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No audit records match the selected criteria.
          </td>
        </tr>
      `;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      pageInfo.innerText = `Page 1 of 1 (0 total)`;
      return;
    }

    // Client-side slice
    const startIndex = (auditPage - 1) * auditLimit;
    const endIndex = Math.min(startIndex + auditLimit, totalLogs);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    tableBody.innerHTML = paginatedLogs.map((log) => {
      const dateStr = formatAuditTimestamp(log.created_at);
      const methodClass = getMethodBadgeClass(log.method);
      const statusClass = getStatusCodeClass(log.status_code);
      const emailText = log.user_email || '<span style="color:var(--text-light);font-style:italic;">anonymous</span>';
      const roleText = log.user_role ? `<span class="status-pill status-pending" style="padding: 2px 6px; font-size: 10px; margin-left: 4px;">${log.user_role}</span>` : '';

      return `
        <tr>
          <td data-label="Timestamp" style="font-size: 13px;">${dateStr}</td>
          <td data-label="User">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:500;">${emailText}</span>
              <span style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-top:2px;">
                ${log.user_id ? log.user_id.substring(0, 8) + '...' : 'no-session'} ${roleText}
              </span>
            </div>
          </td>
          <td data-label="Action">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="font-weight:600; color:var(--text-dark);">${log.action}</span>
              <span style="font-size:12px; color:var(--text-muted); font-family:monospace;">
                <span class="method-badge ${methodClass}">${log.method}</span> 
                ${log.accessed_route.split('?')[0]}
              </span>
            </div>
          </td>
          <td data-label="Status" style="text-align: center;">
            <div style="display:flex; flex-direction:column; align-items:center;">
              <span class="status-code ${statusClass}">${log.status_code}</span>
              <span style="font-size:11px; color:var(--text-light); margin-top:2px;">${log.response_time_ms ? log.response_time_ms + 'ms' : '-'}</span>
            </div>
          </td>
          <td data-label="Location">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:500;">${log.geo_location}</span>
              <span style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-top:2px;">${log.ip_address}</span>
            </div>
          </td>
          <td data-label="Details" style="text-align: center;">
            <button class="btn-info-action btn-view-audit" data-id="${log.id}">View</button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind click events on View buttons
    tableBody.querySelectorAll('.btn-view-audit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const logEntry = filteredLogs.find(l => l.id === id);
        if (logEntry) {
          showAuditModal(logEntry);
        }
      });
    });

    // Update pagination controls
    prevBtn.disabled = auditPage === 1;
    nextBtn.disabled = auditPage === totalPages;
    pageInfo.innerText = `Page ${auditPage} of ${totalPages} (${totalLogs} total records)`;
  }

  function showAuditModal(log) {
    document.getElementById('modal-action-title').innerText = log.action;
    document.getElementById('modal-log-id').innerHTML = `<code>${log.id}</code>`;
    document.getElementById('modal-timestamp').innerText = new Date(log.created_at).toLocaleString();
    document.getElementById('modal-email').innerText = log.user_email || 'anonymous';
    document.getElementById('modal-role').innerHTML = log.user_role ? `<span class="status-pill status-pending">${log.user_role}</span>` : 'none';
    document.getElementById('modal-route').innerHTML = `<code>${log.method} ${log.accessed_route}</code>`;
    
    const statusClass = getStatusCodeClass(log.status_code);
    const timeText = log.response_time_ms ? ` (Duration: ${log.response_time_ms}ms)` : '';
    document.getElementById('modal-status-dur').innerHTML = `<span class="status-code ${statusClass}">${log.status_code}</span>${timeText}`;
    
    document.getElementById('modal-ip').innerHTML = `<code>${log.ip_address}</code>`;
    document.getElementById('modal-location').innerText = log.geo_location;
    document.getElementById('modal-user-agent').innerText = log.user_agent;

    const payloadCode = document.getElementById('modal-payload-content');
    if (log.payload && Object.keys(log.payload).length > 0) {
      payloadCode.innerText = JSON.stringify(log.payload, null, 2);
    } else {
      payloadCode.innerText = 'No body payload recorded for this request.';
    }

    modal.classList.add('show');
  }
}

// Calculate and render KPI metrics in cards
function updateMetrics(logs) {
  const totalEventsEl = document.getElementById('metric-total-events');
  const avgLatencyEl = document.getElementById('metric-avg-latency');
  const latencyStatusEl = document.getElementById('metric-latency-status');
  const errorRateEl = document.getElementById('metric-error-rate');
  const errorCountEl = document.getElementById('metric-error-count');
  const uniqueClientsEl = document.getElementById('metric-unique-clients');

  if (!totalEventsEl) return;

  const total = logs.length;
  totalEventsEl.innerText = total;

  // Calculate Average Latency, Unique IPs, errors
  let totalLatency = 0;
  let latencyCount = 0;
  const uniqueIps = new Set();
  let errors = 0;

  logs.forEach(log => {
    if (log.response_time_ms) {
      totalLatency += parseFloat(log.response_time_ms);
      latencyCount++;
    }
    if (log.ip_address) {
      uniqueIps.add(log.ip_address);
    }
    const status = parseInt(log.status_code, 10);
    if (status >= 400 || status < 200) {
      errors++;
    }
  });

  const avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(1) : 0;
  avgLatencyEl.innerText = avgLatency > 0 ? `${avgLatency} ms` : '0 ms';

  // Status index for Latency
  if (latencyStatusEl) {
    if (avgLatency === 0) {
      latencyStatusEl.innerText = 'N/A';
      latencyStatusEl.className = 'metric-change neutral';
    } else if (avgLatency < 150) {
      latencyStatusEl.innerText = 'Optimal';
      latencyStatusEl.className = 'metric-change positive';
    } else if (avgLatency < 400) {
      latencyStatusEl.innerText = 'Moderate';
      latencyStatusEl.className = 'metric-change neutral';
    } else {
      latencyStatusEl.innerText = 'Latent';
      latencyStatusEl.className = 'metric-change negative';
    }
  }

  // Error Rate
  const errRate = total > 0 ? ((errors / total) * 100).toFixed(1) : 0;
  errorRateEl.innerText = `${errRate}%`;
  if (errorCountEl) {
    errorCountEl.innerText = `${errors} failure${errors !== 1 ? 's' : ''}`;
    if (errors > 0) {
      errorRateEl.style.color = 'var(--danger)';
    } else {
      errorRateEl.style.color = 'var(--text-dark)';
    }
  }

  // Unique IPs
  uniqueClientsEl.innerText = uniqueIps.size;
}

function updateCharts(logs) {
  // 1. Line Chart: Request Traffic Over Time (HH:MM format)
  const timeBuckets = {};
  
  // Sort chronologically (oldest to newest)
  const sortedLogs = [...logs].reverse();
  
  sortedLogs.forEach(log => {
    try {
      const date = new Date(log.created_at);
      const key = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      timeBuckets[key] = (timeBuckets[key] || 0) + 1;
    } catch (e) {
      // ignore
    }
  });

  const labels = Object.keys(timeBuckets);
  const data = Object.values(timeBuckets);

  const lineCtx = document.getElementById('traffic-line-chart')?.getContext('2d');
  if (lineCtx) {
    if (lineChartInstance) {
      lineChartInstance.destroy();
    }
    
    if (typeof Chart !== 'undefined') {
      lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Requests Rate',
            data: data.length ? data : [0],
            borderColor: '#0066ff',
            backgroundColor: 'rgba(0, 102, 255, 0.05)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#0066ff',
            pointRadius: labels.length > 25 ? 1 : 3,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              top: 5,
              bottom: 5,
              left: 5,
              right: 5
            }
          },
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, precision: 0 },
              grid: { color: 'rgba(226, 232, 240, 0.4)' }
            },
            x: {
              grid: { display: false },
              ticks: { maxTicksLimit: 12 }
            }
          }
        }
      });
    }
  }

  // 2. Doughnut Chart: HTTP Request Methods Distribution
  const methods = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
  logs.forEach(log => {
    const m = (log.method || 'GET').toUpperCase();
    if (m in methods) {
      methods[m]++;
    } else {
      methods[m] = (methods[m] || 0) + 1;
    }
  });

  const doughnutCtx = document.getElementById('methods-doughnut-chart')?.getContext('2d');
  if (doughnutCtx) {
    if (doughnutChartInstance) {
      doughnutChartInstance.destroy();
    }
    
    if (typeof Chart !== 'undefined') {
      const methodLabels = Object.keys(methods);
      const methodData = Object.values(methods);
      const totalMethods = methodData.reduce((a, b) => a + b, 0);

      doughnutChartInstance = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
          labels: methodLabels,
          datasets: [{
            data: totalMethods > 0 ? methodData : [1],
            backgroundColor: totalMethods > 0 ? ['#0284c7', '#10b981', '#f59e0b', '#ef4444'] : ['#e2e8f0'],
            borderWidth: 1,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              top: 10,
              bottom: 15,
              left: 10,
              right: 10
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 10,
                font: { size: 11 }
              }
            }
          },
          cutout: '65%'
        }
      });
    }
  }
}

function formatAuditTimestamp(isoString) {
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${datePart}<br><span style="color:var(--text-muted);font-size:11px;">${timePart}</span>`;
  } catch (e) {
    return isoString;
  }
}

function getMethodBadgeClass(method) {
  const m = (method || '').toUpperCase();
  if (m === 'GET') return 'method-get';
  if (m === 'POST') return 'method-post';
  if (m === 'PUT' || m === 'PATCH') return 'method-put';
  if (m === 'DELETE') return 'method-delete';
  return '';
}

function getStatusCodeClass(code) {
  const c = parseInt(code, 10);
  if (c >= 200 && c <= 299) return 'status-success';
  if (c >= 300 && c <= 399) return 'status-warning';
  return 'status-error';
}

/* ─────────────────────────────────────────
   LIVE WIDGETS & WEBSOCKET SIMULATION
───────────────────────────────────────── */
let liveTrafficChart = null;
let trafficData = Array(15).fill(0);
let trafficLabels = Array(15).fill('');

function initOverviewLiveWidgets() {
  const activeUsersEl = document.getElementById('live-active-users');
  const consoleBody = document.getElementById('live-console-body');
  
  const cpuFill = document.getElementById('gauge-cpu-fill');
  const cpuVal = document.getElementById('gauge-cpu-val');
  const ramFill = document.getElementById('gauge-ram-fill');
  const ramVal = document.getElementById('gauge-ram-val');
  const pingFill = document.getElementById('gauge-ping-fill');
  const pingVal = document.getElementById('gauge-ping-val');

  if (!activeUsersEl || !consoleBody) return;

  // Helper to draw circular gauges
  const setCircleGauge = (fillEl, valEl, value, unit = '%', max = 100) => {
    if (!fillEl || !valEl) return;
    const circ = 201; // Circumference for r=32
    const offset = circ - (circ * Math.min(value, max)) / max;
    fillEl.style.strokeDashoffset = offset;
    valEl.innerText = `${Math.round(value)}${unit}`;
  };

  // Set initial gauges
  setCircleGauge(cpuFill, cpuVal, 0);
  setCircleGauge(ramFill, ramVal, 0);
  setCircleGauge(pingFill, pingVal, 0, 'ms', 150);

  // 1. Initialize Line Chart: Live requests activity ticker
  const ctx = document.getElementById('live-traffic-chart')?.getContext('2d');
  if (ctx && typeof Chart !== 'undefined') {
    // Populate label timestamps (last 15 points)
    const time = new Date();
    for (let i = 14; i >= 0; i--) {
      const t = new Date(time.getTime() - i * 2000);
      trafficLabels[14 - i] = t.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    liveTrafficChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trafficLabels,
        datasets: [{
          label: 'Requests / Sec',
          data: trafficData,
          borderColor: '#0066ff',
          backgroundColor: 'rgba(0, 102, 255, 0.05)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: '#0066ff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 5, bottom: 5, left: 5, right: 5 }
        },
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            ticks: { stepSize: 2 },
            grid: { color: 'rgba(226, 232, 240, 0.4)' }
          },
          x: {
            grid: { display: false },
            ticks: { display: false } // Hide X ticks for clean ticker effect
          }
        }
      }
    });
  }

  // Helper to add terminal line
  const addConsoleLine = (log) => {
    const timestamp = new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour12: false });
    const lineEl = document.createElement('div');
    lineEl.className = 'terminal-line';
    const role = log.user_role || 'anonymous';
    const email = log.user_email || 'anonymous';
    const method = log.method || 'GET';
    const route = log.accessed_route ? log.accessed_route.split('?')[0] : '';
    const action = log.action || 'Unknown Event';
    const office = log.geo_location || 'Unknown Location';

    lineEl.innerHTML = `
      <span class="timestamp">[${timestamp}]</span> 
      <span class="role-badge">${role}</span> 
      <span style="color: #a7f3d0;">${email}</span>: 
      <span class="method ${method}">${method}</span> 
      <span class="route">${route}</span> - 
      <span style="color: #64748b;">${action}</span> 
      <span style="color: var(--accent-teal); font-size: 11px;">(${office})</span>
    `;

    consoleBody.appendChild(lineEl);

    // Limit lines to 25
    while (consoleBody.children.length > 25) {
      consoleBody.removeChild(consoleBody.firstChild);
    }

    // Scroll to bottom
    consoleBody.scrollTop = consoleBody.scrollHeight;
  };

  // 2. Establish WebSocket Connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  let ws = new WebSocket(wsUrl);
  let accumulatedRequests = 0;

  ws.onopen = () => {
    addConsoleLine({
      created_at: new Date().toISOString(),
      user_role: 'system',
      user_email: 'terminal',
      method: 'INF',
      accessed_route: '/secure/websocket',
      action: 'Secure WebSocket Connection Established',
      geo_location: 'Global Gateway'
    });
  };

  ws.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      if (packet.type === 'metrics') {
        const { activeUsers, cpu, ram } = packet.data;
        if (activeUsersEl) activeUsersEl.innerText = activeUsers;
        setCircleGauge(cpuFill, cpuVal, cpu);
        setCircleGauge(ramFill, ramVal, ram);
      } else if (packet.type === 'audit_log') {
        accumulatedRequests++;
        addConsoleLine(packet.data);
      }
    } catch (err) {
      console.error('[WS PARSING ERROR]', err);
    }
  };

  ws.onclose = () => {
    addConsoleLine({
      created_at: new Date().toISOString(),
      user_role: 'system',
      user_email: 'terminal',
      method: 'WRN',
      accessed_route: '/secure/websocket',
      action: 'WebSocket connection lost. Reconnect pending...',
      geo_location: 'Global Gateway'
    });
  };

  // 3. Real Latency Ticker
  const latencyValText = document.getElementById('stat-latency-value');
  const latencyDesc = latencyValText ? latencyValText.nextElementSibling : null;

  const measurePing = async () => {
    const t0 = performance.now();
    try {
      await fetch('/api/v1/auth/me', { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
      const t1 = performance.now();
      const latency = Math.round(t1 - t0);

      // Update Circular gauge
      setCircleGauge(pingFill, pingVal, latency, 'ms', 150);

      // Update Latency card
      if (latencyValText) {
        if (latency < 100) {
          latencyValText.innerText = 'Optimal';
          latencyValText.style.color = 'var(--success)';
        } else if (latency < 300) {
          latencyValText.innerText = 'Moderate';
          latencyValText.style.color = 'var(--warning)';
        } else {
          latencyValText.innerText = 'Latent';
          latencyValText.style.color = 'var(--danger)';
        }
      }
      if (latencyDesc) {
        latencyDesc.innerText = `Avg query speed: ${latency} ms`;
      }
    } catch (err) {
      console.error('Error measuring ping:', err);
    }
  };

  // Run initial latency check and set interval
  measurePing();
  const pingInterval = setInterval(measurePing, 5000);

  // 4. Traffic Ticker (updates rolling chart every 2 seconds)
  const tickerInterval = setInterval(() => {
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Shift arrays
    trafficLabels.shift();
    trafficLabels.push(label);
    trafficData.shift();
    trafficData.push(accumulatedRequests);
    
    // Reset requests accumulator
    accumulatedRequests = 0;

    // Redraw line chart
    if (liveTrafficChart) {
      liveTrafficChart.update('none');
    }
  }, 2000);

  // Clean up timers on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(tickerInterval);
    clearInterval(pingInterval);
    if (ws) {
      ws.close();
    }
  });
}
