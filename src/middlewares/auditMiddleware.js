import { logAuditEvent } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';


const localOffices = [
  "London (RTooth UK-LO Office)",
  "Bangalore (RTooth IN-KA Office)",
  "New York (RTooth US-NY Office)",
  "Singapore (RTooth SG-HQ)",
  "Sydney (RTooth AU-NSW Office)"
];

/**
 * Returns a deterministic mock office geolocation based on user email hash.
 */
function getLocalGeoLocation(email) {
  if (!email) return localOffices[1]; // default to Bangalore
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % localOffices.length;
  return localOffices[index];
}

/**
 * Looks up geolocation for public IPs, falls back to simulated MNC offices for local/private loopback.
 */
async function getGeoLocation(ip, email) {
  const cleanIp = ip === '::1' || ip === '127.0.0.1' ? '127.0.0.1' : ip;
  
  if (cleanIp === '127.0.0.1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.16.')) {
    return getLocalGeoLocation(email);
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${cleanIp}`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return `${data.city}, ${data.regionName} (${data.countryCode})`;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }
  return "Unknown Location (Cloudflare CDN)";
}

/**
 * Maps express route paths to clean human-readable audit actions.
 */
function getActionName(method, path) {
  const m = method.toUpperCase();
  const p = path.toLowerCase();

  if (p.startsWith('/api/v1/auth/login')) return "User Login Attempt";
  if (p.startsWith('/api/v1/auth/logout')) return "Session Invalidation";
  if (p.startsWith('/api/v1/auth/me')) return "Fetch Account Info";
  if (p.startsWith('/api/v1/auth/register')) return "IT-Admin Account Creation";
  if (p.startsWith('/api/v1/doctors/audit-logs')) return "Read System Security Audits";
  if (p.startsWith('/api/v1/doctors')) {
    if (m === 'GET') return "List Registered Doctors";
    if (m === 'POST') return "Register Medical Practitioner";
  }
  if (p.includes('/checkups') || p.includes('/visits')) return "Log Consultation Findings";
  if (p.includes('/medications')) return "Prescribe Clinical Medications";
  if (p.startsWith('/api/v1/patients/symptoms/recent')) return "Recent Symptoms Stream Fetch";
  if (p.startsWith('/api/v1/patients')) {
    if (p.match(/\/api\/v1\/patients\/pat-\d+/)) {
      return "Read Patient Clinical Profile";
    }
    if (m === 'GET') return "List Registered Patients";
    if (m === 'POST') return "Onboard Patient Registry";
  }

  return `Resource ${m} [${path}]`;
}

/**
 * Sanitizes request payload by removing sensitive fields.
 */
function sanitizePayload(body) {
  if (!body) return null;
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'confirmPassword', 'token', 'apiKey', 'secret', 'key'];
  for (const k of sensitiveKeys) {
    if (k in sanitized) {
      sanitized[k] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * MNC-Grade Global API request intercepting middleware.
 */
export const auditMiddleware = async (req, res, next) => {
  // Only audit API requests, skip static frontend assets
  if (!req.originalUrl.startsWith('/api/')) {
    return next();
  }

  const startTime = process.hrtime();
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || req.ip;

  // Intercept the finish event of the response to log status and duration
  res.on('finish', async () => {
    try {
      const diff = process.hrtime(startTime);
      const responseTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

      // Determine user credentials from req (populated by requireAuth middleware)
      const userId = req.user?.id || null;
      // If logging in, req.profile is not populated yet, get email from req.body
      const userEmail = req.profile?.email || req.body?.email || req.user?.email || null;
      const userRole = req.profile?.role || (req.body?.role && req.originalUrl.includes('login') ? req.body.role : null) || null;

      const action = getActionName(req.method, req.originalUrl.split('?')[0]);
      const geoLocation = await getGeoLocation(ip, userEmail);

      const event = {
        user_id: userId,
        user_email: userEmail,
        user_role: userRole,
        action,
        method: req.method,
        accessed_route: req.originalUrl,
        status_code: res.statusCode,
        ip_address: ip,
        geo_location: geoLocation,
        user_agent: req.headers['user-agent'] || 'Unknown User-Agent',
        payload: req.method !== 'GET' ? sanitizePayload(req.body) : null,
        response_time_ms: parseFloat(responseTimeMs)
      };

      // Asynchronously log to the separate audit logs database
      await logAuditEvent(event);

      // Broadcast to connected admin consoles in real-time
      broadcastEvent({
        type: 'audit_log',
        data: event
      });
    } catch (err) {
      console.error('[AUDIT MIDDLEWARE ERROR] Failed to log event:', err.message);
    }
  });

  next();
};
