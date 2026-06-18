/**
 * RTooth - File Upload Seeder (Fixed report types to match DB constraint)
 * Allowed: 'Biopsy', 'Histopathology', 'Imaging', 'Blood Report', 'Other'
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Only the 5 values allowed by the DB check constraint
const ALLOWED_REPORT_TYPES = ['Biopsy', 'Histopathology', 'Imaging', 'Blood Report', 'Other'];

const REPORT_CONTENTS = {
  'Biopsy': 'Biopsy report: no malignancy detected in specimen. Mild hyperkeratosis noted at resection margins. Suggest follow-up in 6 weeks.',
  'Histopathology': 'Histopathology: well-differentiated squamous cell features. No vascular invasion detected. Surgical margins clear.',
  'Imaging': 'Imaging (OPG/MRI): No bony infiltration. Soft tissue borders intact. Lesion measures 8mm x 5mm on axial view.',
  'Blood Report': 'Complete blood count: WBC 10,800/μL, RBC 4.9M/μL, Hemoglobin 13.8 g/dL. Platelet count normal at 215,000/μL.',
  'Other': 'General clinical notes: Patient vitals stable. Blood pressure 120/80 mmHg. Pain score 3/10. Next appointment scheduled.'
};

async function seedFileUploads(targetCount = 50) {
  console.log(`\n🗂️  Uploading ${targetCount} sample report files...`);

  // Ensure bucket
  try {
    await supabaseAdmin.storage.createBucket('patient-reports', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      fileSizeLimit: 10485760
    });
  } catch (e) { /* already exists */ }

  // Fetch checkups to attach files to (get enough to cover targetCount)
  const { data: checkups, error: rcErr } = await supabaseAdmin
    .from('checkups')
    .select('id, patient_id, doctor_id')
    .limit(targetCount);

  if (rcErr || !checkups?.length) {
    console.error('Failed to fetch checkups:', rcErr?.message);
    return;
  }

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < Math.min(checkups.length, targetCount); i++) {
    const checkup = checkups[i];
    const reportType = ALLOWED_REPORT_TYPES[i % ALLOWED_REPORT_TYPES.length];
    const content = REPORT_CONTENTS[reportType];
    const patientId = checkup.patient_id;
    const doctorId = checkup.doctor_id;
    const visitId = checkup.id;

    const fileBuffer = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n\n` +
      `RTooth Clinical Report\n` +
      `Type: ${reportType}\n` +
      `Visit ID: ${visitId}\n` +
      `Generated: ${new Date().toISOString()}\n\n` +
      content,
      'utf-8'
    );

    const timestamp = Date.now() + i;
    const storagePath = `${patientId}/${reportType.replace(/\s/g, '_')}-${timestamp}.pdf`;
    const displayName = `SeededReport-${reportType.replace(/\s/g, '_')}-Visit-${visitId.substring(0, 8)}.pdf`;

    try {
      // Upload to storage
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('patient-reports')
        .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });

      if (uploadErr) {
        console.error(`  ✗ Storage upload failed for #${i + 1}: ${uploadErr.message}`);
        failed++;
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('patient-reports')
        .getPublicUrl(storagePath);

      // Insert DB row
      const { error: dbErr } = await supabaseAdmin
        .from('patient_reports')
        .insert([{
          patient_id: patientId,
          doctor_id: doctorId,
          checkup_id: visitId,
          report_type: reportType,
          file_name: displayName,
          file_url: publicUrl
        }]);

      if (dbErr) {
        console.error(`  ✗ DB insert failed for ${displayName}: ${dbErr.message}`);
        failed++;
      } else {
        uploaded++;
        console.log(`  ✓ [${uploaded}] ${displayName} (${reportType})`);
      }
    } catch (err) {
      console.error(`  ✗ Exception for #${i + 1}: ${err.message}`);
      failed++;
    }

    await sleep(200);
  }

  return { uploaded, failed };
}

async function main() {
  console.log('==================================================');
  console.log('RTooth File Upload Seeder');
  console.log('==================================================');

  const result = await seedFileUploads(50);

  // Final report count
  const { count } = await supabaseAdmin
    .from('patient_reports')
    .select('*', { count: 'exact', head: true });

  console.log('\n==================================================');
  console.log(`✅ Uploads done: ${result?.uploaded} succeeded, ${result?.failed} failed`);
  console.log(`📁 Total patient_reports in DB: ${count}`);
  console.log('==================================================');
}

main().catch(err => console.error('Fatal:', err));
