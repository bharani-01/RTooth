import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const auditDbUrl = process.env.AUDIT_LOG_SUPABASE_URL;
const auditDbAnonKey = process.env.AUDIT_LOG_SUPABASE_ANON_KEY;

if (!auditDbUrl || !auditDbAnonKey) {
  console.warn('[WARNING] Audit Log Supabase credentials are not configured in environment variables.');
}

export const auditSupabase = createClient(auditDbUrl, auditDbAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Inserts a new audit log event record into the secondary database.
 * @param {object} event - Audit log record metadata
 */
export const logAuditEvent = async (event) => {
  try {
    const { error } = await auditSupabase.from('audit_logs').insert([event]);
    if (error) {
      console.error('[AUDIT ERROR] Failed to insert audit log row:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT EXCEPTION] Error writing audit log:', err.message);
  }
};

/**
 * Fetches audit logs from the secondary database with pagination and search filters.
 * @param {object} filters - Search criteria
 */
export const fetchAuditLogs = async (filters = {}) => {
  let query = auditSupabase.from('audit_logs').select('*', { count: 'exact' });

  // Full-text search emulation in columns
  if (filters.search) {
    const term = filters.search.trim();
    query = query.or(`user_email.ilike.%${term}%,action.ilike.%${term}%,ip_address.ilike.%${term}%,accessed_route.ilike.%${term}%`);
  }

  // Filter by success (2xx) or failure (1xx, 3xx, 4xx, 5xx) status codes
  if (filters.status) {
    if (filters.status === 'success') {
      query = query.gte('status_code', 200).lte('status_code', 299);
    } else if (filters.status === 'failure') {
      // In postgrest or conditions, lt.200 or gte.300
      query = query.or('status_code.lt.200,status_code.gte.300');
    }
  }

  // Filter by HTTP Method
  if (filters.method) {
    query = query.eq('method', filters.method.toUpperCase());
  }

  // Order by newest first
  query = query.order('created_at', { ascending: false });

  // Pagination bounds
  const page = parseInt(filters.page, 10) || 1;
  const limit = parseInt(filters.limit, 10) || 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  return { logs: data || [], count: count || 0 };
};
