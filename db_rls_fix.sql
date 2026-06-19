-- ============================================================
-- RTooth RLS Remediation — Incremental Policy Fix
-- Run in Supabase Dashboard > SQL Editor
-- Safe: no table drops, no data loss
-- ============================================================

-- ─── DROP all over-permissive authenticated-only policies ────────────────────
DROP POLICY IF EXISTS "Allow doctors read/write" ON public.doctors;
DROP POLICY IF EXISTS "Allow admins read/write" ON public.admins;
DROP POLICY IF EXISTS "Allow patients read/write" ON public.patients;
DROP POLICY IF EXISTS "Allow habits read/write" ON public.lifestyle_habits;
DROP POLICY IF EXISTS "Allow records read/write" ON public.medical_records;
DROP POLICY IF EXISTS "Allow medications read/write" ON public.medications;
DROP POLICY IF EXISTS "Allow checkups read/write" ON public.checkups;

-- ─── DOCTORS ──────────────────────────────────────────────────────────────────
-- Admins can see all; doctors can see only their own profile row
CREATE POLICY "doctors_select"
  ON public.doctors FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can INSERT, UPDATE, DELETE doctor records
CREATE POLICY "doctors_write_admin"
  ON public.doctors FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "doctors_update_admin"
  ON public.doctors FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "doctors_delete_admin"
  ON public.doctors FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── ADMINS ───────────────────────────────────────────────────────────────────
-- Admins can only read and write their own row
CREATE POLICY "admins_select_self"
  ON public.admins FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "admins_insert_self"
  ON public.admins FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── PATIENTS ─────────────────────────────────────────────────────────────────
-- Patient sees own row; doctor sees assigned patients; admin sees all
CREATE POLICY "patients_select"
  ON public.patients FOR SELECT
  USING (
    auth.uid() = id
    OR doctor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Doctors and admins can register new patients
CREATE POLICY "patients_insert"
  ON public.patients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- Doctors update their own assigned patients; admins update any
CREATE POLICY "patients_update"
  ON public.patients FOR UPDATE
  USING (
    doctor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can delete patient records
CREATE POLICY "patients_delete"
  ON public.patients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── LIFESTYLE HABITS ─────────────────────────────────────────────────────────
CREATE POLICY "habits_select"
  ON public.lifestyle_habits FOR SELECT
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "habits_insert"
  ON public.lifestyle_habits FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "habits_update"
  ON public.lifestyle_habits FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── MEDICAL RECORDS ──────────────────────────────────────────────────────────
CREATE POLICY "records_select"
  ON public.medical_records FOR SELECT
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "records_insert"
  ON public.medical_records FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "records_update"
  ON public.medical_records FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── MEDICATIONS ──────────────────────────────────────────────────────────────
CREATE POLICY "medications_select"
  ON public.medications FOR SELECT
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "medications_insert"
  ON public.medications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "medications_update"
  ON public.medications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "medications_delete"
  ON public.medications FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = patient_id AND doctor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── CHECKUPS ─────────────────────────────────────────────────────────────────
CREATE POLICY "checkups_select"
  ON public.checkups FOR SELECT
  USING (
    auth.uid() = patient_id
    OR auth.uid() = doctor_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "checkups_insert"
  ON public.checkups FOR INSERT
  WITH CHECK (
    auth.uid() = doctor_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "checkups_update"
  ON public.checkups FOR UPDATE
  USING (
    auth.uid() = doctor_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "checkups_delete"
  ON public.checkups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
