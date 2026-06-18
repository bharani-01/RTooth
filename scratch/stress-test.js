/**
 * ============================================================
 * RTooth - Concurrent API Stress Test (50-100 sessions)
 * ============================================================
 * Simulates 50-100 simultaneous authenticated user sessions
 * all hammering the production API at the same time.
 *
 * Each session independently:
 *   - Logs in as a doctor OR patient
 *   - Runs a realistic sequence of API calls in a loop
 *   - Reports per-request latency + errors
 *
 * Target: https://rtooth-wn3z.onrender.com
 * ============================================================
 */

const BASE_URL = 'https://rtooth-wn3z.onrender.com/api/v1';
const DURATION_SECONDS = 120; // Run for 2 minutes

// ── Session pools (mix of real seeded users) ─────────────────

const DOCTOR_SESSIONS = [];
for (let i = 1001; i <= 1050; i++) {
  DOCTOR_SESSIONS.push({ email: `chn_doc_${i}@rtooth.in`, password: 'DoctorPassword123', role: 'doctor' });
}
// Also include original doctors
DOCTOR_SESSIONS.push({ email: 'emily@rtooth.in', password: 'DoctorPassword123', role: 'doctor' });
DOCTOR_SESSIONS.push({ email: 'amit@rtooth.in', password: 'DoctorPassword123', role: 'doctor' });

const PATIENT_SESSIONS = [];
for (let i = 1; i <= 30; i++) {
  PATIENT_SESSIONS.push({ email: `seeded_pat_${i}@rtooth.in`, password: 'PatientPassword123', role: 'patient' });
}
PATIENT_SESSIONS.push({ email: 'rahul@rtooth.in', password: 'PatientPassword123', role: 'patient' });
PATIENT_SESSIONS.push({ email: 'priya@rtooth.in', password: 'PatientPassword123', role: 'patient' });

const ADMIN_SESSION = { email: 'admin@rtooth.in', password: 'AdminPassword123', role: 'admin' };

// ── Metrics tracker ──────────────────────────────────────────

const metrics = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  latencies: [],
  errors: {},
  endpoints: {},
  sessionStats: []
};

// ── HTTP helper ──────────────────────────────────────────────

async function apiCall(method, path, body, token) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    const latency = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    metrics.totalRequests++;
    metrics.latencies.push(latency);
    metrics.endpoints[`${method} ${path.split('?')[0]}`] = (metrics.endpoints[`${method} ${path.split('?')[0]}`] || 0) + 1;

    if (res.ok) {
      metrics.successRequests++;
    } else {
      metrics.failedRequests++;
      const errKey = `${res.status} ${path.split('/')[2] || path}`;
      metrics.errors[errKey] = (metrics.errors[errKey] || 0) + 1;
    }

    return { ok: res.ok, status: res.status, data, latency };
  } catch (e) {
    const latency = Date.now() - start;
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.latencies.push(latency);
    const errKey = `TIMEOUT/ERR ${path.split('/')[2] || path}`;
    metrics.errors[errKey] = (metrics.errors[errKey] || 0) + 1;
    return { ok: false, status: 0, data: {}, latency, error: e.message };
  }
}

async function login(email, password) {
  const r = await apiCall('POST', '/auth/login', { email, password }, null);
  return r.ok ? r.data?.data?.session?.access_token : null;
}

// ── Session workers ──────────────────────────────────────────

// Doctor session: login → list patients → get patient profile → create checkup
async function runDoctorSession(cred, sessionId, endTime) {
  let token = null;
  let callCount = 0;
  let patientIds = [];

  const sessionMetrics = { id: sessionId, role: 'doctor', email: cred.email, calls: 0, errors: 0 };

  while (Date.now() < endTime) {
    try {
      // Login (or re-login if token expired)
      if (!token) {
        token = await login(cred.email, cred.password);
        if (!token) { await sleep(3000); continue; }
      }

      // 1. List patients
      const pList = await apiCall('GET', '/patients', null, token);
      callCount++;
      if (!pList.ok) { token = null; await sleep(2000); continue; }

      // Extract patient IDs for subsequent calls
      if (patientIds.length === 0 && pList.data?.data?.patients?.length > 0) {
        patientIds = pList.data.data.patients.slice(0, 10).map(p => p.id);
      }

      if (patientIds.length > 0) {
        // 2. Get random patient profile
        const patId = patientIds[Math.floor(Math.random() * patientIds.length)];
        await apiCall('GET', `/patients/${patId}`, null, token);
        callCount++;

        // 3. Get patient symptoms
        await apiCall('GET', `/patients/${patId}/symptoms`, null, token);
        callCount++;

        // 4. Create a checkup (write traffic)
        if (Math.random() > 0.5) {
          await apiCall('POST', `/patients/${patId}/checkups`, {
            findings: `Stress test visit — oral mucosa reviewed. Session ${sessionId}.`,
            notes: 'Routine monitoring under stress test conditions.',
            recommendations: 'Continue prescribed medications. Review in 4 weeks.',
            checkup_date: new Date().toISOString(),
            prescriptions: [
              { medication_name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'BD',
                start_date: new Date().toISOString().split('T')[0] }
            ]
          }, token);
          callCount++;
        }

        // 5. Get follow-up scheduling
        await apiCall('GET', '/patients/scheduling/followups', null, token);
        callCount++;
      }

      // 6. Get recent symptom logs
      await apiCall('GET', '/patients/symptoms/recent', null, token);
      callCount++;

      sessionMetrics.calls = callCount;
      await sleep(200 + Math.random() * 300); // 200-500ms between cycles

    } catch (e) {
      sessionMetrics.errors++;
      token = null;
      await sleep(2000);
    }
  }

  sessionMetrics.calls = callCount;
  metrics.sessionStats.push(sessionMetrics);
  return sessionMetrics;
}

// Patient session: login → get my profile → log symptoms → get visit details
async function runPatientSession(cred, sessionId, endTime) {
  let token = null;
  let callCount = 0;

  const sessionMetrics = { id: sessionId, role: 'patient', email: cred.email, calls: 0, errors: 0 };

  while (Date.now() < endTime) {
    try {
      if (!token) {
        token = await login(cred.email, cred.password);
        if (!token) { await sleep(3000); continue; }
      }

      // 1. Get my profile
      const profile = await apiCall('GET', '/patients/me', null, token);
      callCount++;
      if (!profile.ok) { token = null; await sleep(2000); continue; }

      // 2. Get my symptoms
      await apiCall('GET', '/patients/me/symptoms', null, token);
      callCount++;

      // 3. Log a new symptom (write traffic)
      if (Math.random() > 0.6) {
        await apiCall('POST', '/patients/me/symptoms', {
          burning_sensation: ['None', 'Mild', 'Moderate', 'Severe'][Math.floor(Math.random() * 4)],
          pain_scale: Math.floor(Math.random() * 8),
          difficulty_opening_mouth: ['None', 'Mild', 'Moderate'][Math.floor(Math.random() * 3)],
          ulcer_duration: Math.floor(Math.random() * 20),
          bleeding: Math.random() > 0.7
        }, token);
        callCount++;
      }

      sessionMetrics.calls = callCount;
      await sleep(400 + Math.random() * 600); // Patients slower pace

    } catch (e) {
      sessionMetrics.errors++;
      token = null;
      await sleep(2000);
    }
  }

  sessionMetrics.calls = callCount;
  metrics.sessionStats.push(sessionMetrics);
  return sessionMetrics;
}

// Admin session: login → list doctors → get audit logs → list patients
async function runAdminSession(sessionId, endTime) {
  let token = null;
  let callCount = 0;

  const sessionMetrics = { id: sessionId, role: 'admin', email: ADMIN_SESSION.email, calls: 0, errors: 0 };

  while (Date.now() < endTime) {
    try {
      if (!token) {
        token = await login(ADMIN_SESSION.email, ADMIN_SESSION.password);
        if (!token) { await sleep(3000); continue; }
      }

      await apiCall('GET', '/doctors', null, token); callCount++;
      await apiCall('GET', '/patients', null, token); callCount++;
      await apiCall('GET', '/doctors/audit-logs?limit=50', null, token); callCount++;
      await apiCall('GET', '/patients/symptoms/recent', null, token); callCount++;

      sessionMetrics.calls = callCount;
      await sleep(500 + Math.random() * 500);

    } catch (e) {
      sessionMetrics.errors++;
      token = null;
      await sleep(2000);
    }
  }

  sessionMetrics.calls = callCount;
  metrics.sessionStats.push(sessionMetrics);
  return sessionMetrics;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Live progress display ─────────────────────────────────────

function printProgress(elapsed, total) {
  const pct = Math.floor((elapsed / total) * 100);
  const clampedPct = Math.min(100, Math.max(0, pct));
  const bar = '█'.repeat(Math.floor(clampedPct / 5)) + '░'.repeat(20 - Math.floor(clampedPct / 5));
  const rps = elapsed > 0 ? (metrics.totalRequests / elapsed).toFixed(1) : 0;
  const successRate = metrics.totalRequests > 0
    ? ((metrics.successRequests / metrics.totalRequests) * 100).toFixed(1)
    : '0.0';
  const p50 = percentile(metrics.latencies, 50);
  const p95 = percentile(metrics.latencies, 95);
  const p99 = percentile(metrics.latencies, 99);

  process.stdout.write(
    `\r[${bar}] ${pct}% | ` +
    `Req: ${metrics.totalRequests} | ` +
    `RPS: ${rps} | ` +
    `OK: ${successRate}% | ` +
    `p50: ${p50}ms p95: ${p95}ms p99: ${p99}ms   `
  );
}

// ── Orchestrator ─────────────────────────────────────────────

async function main() {
  const CONCURRENT_SESSIONS = 75; // 75 simultaneous sessions
  const DOC_SESSIONS = 50;
  const PAT_SESSIONS = 20;
  const ADMIN_SESSIONS = 5;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       RTooth Production Concurrent Stress Test            ║');
  console.log('║       Target: https://rtooth-wn3z.onrender.com            ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Sessions: ${CONCURRENT_SESSIONS} concurrent (${DOC_SESSIONS} doctors + ${PAT_SESSIONS} patients + ${ADMIN_SESSIONS} admins)   ║`);
  console.log(`║  Duration: ${DURATION_SECONDS} seconds                                     ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log('Launching all sessions simultaneously...\n');

  const endTime = Date.now() + DURATION_SECONDS * 1000;
  const sessionPromises = [];

  // Doctor sessions
  for (let i = 0; i < DOC_SESSIONS; i++) {
    const cred = DOCTOR_SESSIONS[i % DOCTOR_SESSIONS.length];
    sessionPromises.push(runDoctorSession(cred, `DOC-${i + 1}`, endTime));
  }

  // Patient sessions
  for (let i = 0; i < PAT_SESSIONS; i++) {
    const cred = PATIENT_SESSIONS[i % PATIENT_SESSIONS.length];
    sessionPromises.push(runPatientSession(cred, `PAT-${i + 1}`, endTime));
  }

  // Admin sessions
  for (let i = 0; i < ADMIN_SESSIONS; i++) {
    sessionPromises.push(runAdminSession(`ADMIN-${i + 1}`, endTime));
  }

  // Progress display loop
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - (endTime - DURATION_SECONDS * 1000)) / 1000;
    printProgress(elapsed, DURATION_SECONDS);
  }, 1000);

  // Wait for all sessions to complete
  await Promise.allSettled(sessionPromises);
  clearInterval(progressInterval);

  // ── Final Report ─────────────────────────────────────────
  const p50 = percentile(metrics.latencies, 50);
  const p75 = percentile(metrics.latencies, 75);
  const p95 = percentile(metrics.latencies, 95);
  const p99 = percentile(metrics.latencies, 99);
  const avgLatency = metrics.latencies.length
    ? Math.floor(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length)
    : 0;
  const maxLatency = metrics.latencies.length ? Math.max(...metrics.latencies) : 0;
  const rps = (metrics.totalRequests / DURATION_SECONDS).toFixed(2);
  const successRate = ((metrics.successRequests / metrics.totalRequests) * 100).toFixed(2);
  const totalCalls = metrics.sessionStats.reduce((a, s) => a + s.calls, 0);

  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                   STRESS TEST RESULTS                    ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:           ${DURATION_SECONDS}s                                    ║`);
  console.log(`║  Concurrent Sessions:${CONCURRENT_SESSIONS}                                    ║`);
  console.log(`║  Total Requests:     ${String(metrics.totalRequests).padEnd(10)}                         ║`);
  console.log(`║  Successful:         ${String(metrics.successRequests).padEnd(10)} (${successRate}%)               ║`);
  console.log(`║  Failed:             ${String(metrics.failedRequests).padEnd(10)}                         ║`);
  console.log(`║  Requests/sec (RPS): ${String(rps).padEnd(10)}                         ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║                    LATENCY (ms)                          ║');
  console.log(`║  Average:  ${String(avgLatency).padEnd(8)}  p50: ${String(p50).padEnd(8)}  Max: ${String(maxLatency).padEnd(8)} ║`);
  console.log(`║  p75:      ${String(p75).padEnd(8)}  p95: ${String(p95).padEnd(8)}  p99: ${String(p99).padEnd(8)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║                  ENDPOINT BREAKDOWN                      ║');
  const endpointsSorted = Object.entries(metrics.endpoints).sort((a, b) => b[1] - a[1]);
  for (const [ep, count] of endpointsSorted.slice(0, 8)) {
    const line = `${ep.substring(0, 35).padEnd(35)} ${String(count).padStart(6)} calls`;
    console.log(`║  ${line.padEnd(57)}║`);
  }
  console.log('╠═══════════════════════════════════════════════════════════╣');
  if (Object.keys(metrics.errors).length > 0) {
    console.log('║                     ERRORS                               ║');
    for (const [err, count] of Object.entries(metrics.errors).slice(0, 5)) {
      const line = `${err.substring(0, 40).padEnd(40)} ×${count}`;
      console.log(`║  ${line.padEnd(57)}║`);
    }
    console.log('╠═══════════════════════════════════════════════════════════╣');
  }
  console.log('║                 TOP SESSION PERFORMERS                   ║');
  const topSessions = metrics.sessionStats.sort((a, b) => b.calls - a.calls).slice(0, 5);
  for (const s of topSessions) {
    const line = `[${s.role.toUpperCase()}] ${s.email.substring(0, 25).padEnd(25)} ${s.calls} calls`;
    console.log(`║  ${line.padEnd(57)}║`);
  }
  console.log('╚═══════════════════════════════════════════════════════════╝');
}

main().catch(e => {
  console.error('\n💥 Fatal:', e.message);
  console.log('Partial metrics:', JSON.stringify(metrics, null, 2));
});
