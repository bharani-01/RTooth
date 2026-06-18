-- RTooth Dental Doctor & Patient Management Normalized Schema
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create role enum if not exists
DO $$ 
BEGIN 
  CREATE TYPE user_role AS ENUM ('doctor', 'patient', 'admin');
EXCEPTION 
  WHEN duplicate_object THEN null; 
END $$;

-- 2. Drop existing tables to recreate (in order of dependencies)
DROP TABLE IF EXISTS public.checkups CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;
DROP TABLE IF EXISTS public.medical_records CASCADE;
DROP TABLE IF EXISTS public.lifestyle_habits CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP SEQUENCE IF EXISTS public.patient_code_seq CASCADE;
DROP SEQUENCE IF EXISTS public.doctor_code_seq CASCADE;
DROP SEQUENCE IF EXISTS public.admin_code_seq CASCADE;

-- 3. Create Core Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'banned'))
);

-- 4. Create Doctors table
CREATE SEQUENCE IF NOT EXISTS public.doctor_code_seq START WITH 10001;

CREATE TABLE public.doctors (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  doctor_code TEXT UNIQUE DEFAULT 'DOC-' || nextval('public.doctor_code_seq')::TEXT NOT NULL,
  specialization TEXT NOT NULL,
  license_number TEXT NOT NULL
);

-- 4.5. Create Admins table
CREATE SEQUENCE IF NOT EXISTS public.admin_code_seq START WITH 10001;

CREATE TABLE public.admins (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  admin_code TEXT UNIQUE DEFAULT 'ADM-' || nextval('public.admin_code_seq')::TEXT NOT NULL
);

-- 5. Create Patients table
CREATE SEQUENCE IF NOT EXISTS public.patient_code_seq START WITH 10001;

CREATE TABLE public.patients (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  patient_code TEXT UNIQUE DEFAULT 'PAT-' || nextval('public.patient_code_seq')::TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  address TEXT,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft'))
);

-- 6. Create Lifestyle Habits table
CREATE TABLE public.lifestyle_habits (
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  tobacco_habit TEXT,      -- none / smoking / smokeless / both
  tobacco_frequency TEXT,
  tobacco_duration TEXT,
  alcohol_habit TEXT,      -- none / occasional / habitual
  alcohol_frequency TEXT,
  alcohol_duration TEXT,
  betel_nut TEXT,          -- yes / no
  family_history TEXT      -- yes / no
);

-- 7. Create Medical Records table
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  cancer_stage TEXT NOT NULL,       -- Stage I-IV / High-Risk Dysplasia / Suspicious Lesion
  lesion_location TEXT NOT NULL,    -- Lateral Tongue / Floor of Mouth / Buccal Mucosa
  risk_factors TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- 9. Setup RLS Policies (Allow reads and internal CRUD safely)
CREATE POLICY "Allow profile read for authenticated users" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow profile update for self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow profile insert during registration" ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow doctors read/write" ON public.doctors FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow admins read/write" ON public.admins FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow patients read/write" ON public.patients FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow habits read/write" ON public.lifestyle_habits FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow records read/write" ON public.medical_records FOR ALL USING (auth.uid() IS NOT NULL);

-- 10. Trigger to automatically update the updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 11. Create Medications Table
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Create Checkups Table
CREATE TABLE public.checkups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checkup_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  findings TEXT NOT NULL,
  notes TEXT,
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkups ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies
CREATE POLICY "Allow medications read/write" ON public.medications FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow checkups read/write" ON public.checkups FOR ALL USING (auth.uid() IS NOT NULL);

