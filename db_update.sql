-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/lxjyglysotkyecszuovq/sql)

-- 1. Create patient_reports table
CREATE TABLE IF NOT EXISTS public.patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checkup_id UUID REFERENCES public.checkups(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('Biopsy', 'Histopathology', 'Imaging', 'Blood Report', 'Other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Alter medications table to link with checkups (visits)
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS checkup_id UUID REFERENCES public.checkups(id) ON DELETE SET NULL;

-- 3. Enable RLS and add policies
ALTER TABLE public.patient_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow reports read/write for authenticated users" ON public.patient_reports;
CREATE POLICY "Allow reports read/write for authenticated users" ON public.patient_reports FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. Create symptom_logs table
CREATE TABLE IF NOT EXISTS public.symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  burning_sensation TEXT CHECK (burning_sensation IN ('None', 'Mild', 'Moderate', 'Severe')) NOT NULL,
  pain_scale INTEGER CHECK (pain_scale >= 0 AND pain_scale <= 10) NOT NULL,
  difficulty_opening_mouth TEXT CHECK (difficulty_opening_mouth IN ('None', 'Mild', 'Moderate', 'Severe')) NOT NULL,
  ulcer_duration INTEGER DEFAULT 0 NOT NULL,
  bleeding BOOLEAN DEFAULT FALSE NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS and policies for symptom_logs
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read/write of symptom logs for authenticated users" ON public.symptom_logs;
CREATE POLICY "Allow read/write of symptom logs for authenticated users" ON public.symptom_logs FOR ALL USING (auth.uid() IS NOT NULL);

-- 6. Alter checkups table to support next check-up / follow-up scheduling
ALTER TABLE public.checkups ADD COLUMN IF NOT EXISTS next_checkup_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.checkups ADD COLUMN IF NOT EXISTS followup_interval TEXT;
ALTER TABLE public.checkups ADD COLUMN IF NOT EXISTS followup_notes TEXT;

-- 7. Add status column to profiles table to track account bans and states
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'banned'));

-- 8. Create patient_images table and enable RLS
CREATE TABLE IF NOT EXISTS public.patient_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_type TEXT NOT NULL CHECK (image_type IN ('Lesion Photograph', 'Mouth Opening Image', 'Progression Image')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  description TEXT,
  doctor_notes TEXT,
  doctor_notes_visibility TEXT NOT NULL DEFAULT 'public' CHECK (doctor_notes_visibility IN ('public', 'private')),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.patient_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow patient images read/write for authenticated users" ON public.patient_images;
CREATE POLICY "Allow patient images read/write for authenticated users" ON public.patient_images FOR ALL USING (auth.uid() IS NOT NULL);

-- 9. Create storage bucket SELECT policies (Enables public read/download access via URLs)
-- Run this in your Supabase SQL Editor to allow public access to uploaded files
DROP POLICY IF EXISTS "Allow public SELECT on patient-images" ON storage.objects;
CREATE POLICY "Allow public SELECT on patient-images" ON storage.objects FOR SELECT USING (bucket_id = 'patient-images');

DROP POLICY IF EXISTS "Allow public SELECT on patient-reports" ON storage.objects;
CREATE POLICY "Allow public SELECT on patient-reports" ON storage.objects FOR SELECT USING (bucket_id = 'patient-reports');

-- 10. Add advanced medication details & customizations
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS relation_to_food TEXT;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS times_a_day INTEGER;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS dosage_form TEXT;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

