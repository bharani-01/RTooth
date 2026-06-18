-- Run this SQL DDL script in your Supabase SQL Editor for the Audit Database (https://supabase.com)
-- DB URL: https://smwiswcyrkgrstiwiflc.supabase.co

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  method TEXT NOT NULL,
  accessed_route TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  geo_location TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  payload JSONB,
  response_time_ms NUMERIC
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for the secondary client (access via anon-key)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.audit_logs;
CREATE POLICY "Allow anonymous inserts" ON public.audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select" ON public.audit_logs;
CREATE POLICY "Allow anonymous select" ON public.audit_logs FOR SELECT USING (true);
