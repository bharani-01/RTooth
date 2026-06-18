/**
 * RTooth - Checkup Resume Seeder
 * 
 * Resumes checkup seeding from where it left off (we have 15,008 already).
 * Targets 50,000 total. Also seeds more sample file uploads.
 * 
 * Uses longer delays + smaller batches to avoid Supabase connection timeouts.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Create a fresh client each time we hit connection failures
function makeClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (...args) => fetch(...args)
    }
  });
}

let supabaseAdmin = makeClient();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getCurrentCheckupCount() {
  const { count } = await supabaseAdmin.from('checkups').select('*', { count: 'exact', head: true });
  return count || 0;
}

async function getAllPatientDoctorPairs() {
  // Paginate through all patients since Supabase returns max 1000 per request
  let allPairs = [];
  let from = 0;
  const pageSize = 500;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('id, doctor_id')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error fetching patient-doctor pairs:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    allPairs.push(...data.map(p => ({ id: p.id, doctorId: p.doctor_id })));
    if (data.length < pageSize) break;
    from += pageSize;
    await sleep(200);
  }

  console.log(`Fetched ${allPairs.length} patient-doctor pairs.`);
  return allPairs;
}

async function insertBatchWithRetry(batch, attempt = 1) {
  // Recreate client on retries to clear any stale connection
  if (attempt > 1) {
    supabaseAdmin = makeClient();
    await sleep(2000 * attempt);
  }

  const { error } = await supabaseAdmin.from('checkups').insert(batch);
  if (error) {
    if (attempt < 4) {
      console.warn(`    Retry ${attempt}/3 after error: ${error.message}`);
      return insertBatchWithRetry(batch, attempt + 1);
    }
    throw error;
  }
  return true;
}

async function resumeCheckupSeeding(patientPairs, targetTotal = 50000) {
  const currentCount = await getCurrentCheckupCount();
  console.log(`Current checkup count: ${currentCount}`);
  console.log(`Target: ${targetTotal}`);

  if (currentCount >= targetTotal) {
    console.log(`Already at or above target. Skipping checkup seeding.`);
    return;
  }

  const needed = targetTotal - currentCount;
  console.log(`Need to insert ${needed} more checkups...`);

  const now = new Date();
  const checkups = [];

  // Distribute needed checkups across all patients
  let i = 0;
  while (checkups.length < needed) {
    const pat = patientPairs[i % patientPairs.length];
    const dateOffset = getRandomInt(1, 730);
    const checkupDate = new Date(now.getTime() - dateOffset * 24 * 60 * 60 * 1000);
    checkups.push({
      patient_id: pat.id,
      doctor_id: pat.doctorId,
      checkup_date: checkupDate.toISOString(),
      findings: `Diagnostic review. Patient examination of oral mucosa, tongue, and palate completed. Lesion progression assessment performed.`,
      notes: `Patient compliance noted. Lifestyle advisory provided. Nutritional supplement discussion initiated.`,
      recommendations: `Continue prescribed medications. Maintain follow-up schedule. Reduce tobacco exposure.`
    });
    i++;
  }

  // Insert in small batches of 500 with longer delays to prevent timeouts
  const batchSize = 500;
  let seeded = 0;
  let errorCount = 0;

  for (let b = 0; b < checkups.length; b += batchSize) {
    const batch = checkups.slice(b, b + batchSize);
    try {
      await insertBatchWithRetry(batch);
      seeded += batch.length;
      console.log(`  Inserted ${seeded}/${needed} checkups`);
    } catch (err) {
      errorCount++;
      console.error(`  Skipping batch at offset ${b} after all retries: ${err.message}`);
    }

    // Add longer delay every 5 batches to let the connection breathe
    if (((b / batchSize) + 1) % 5 === 0) {
      console.log(`  Pausing 3s to let DB breathe...`);
      await sleep(3000);
    } else {
      await sleep(500);
    }
  }

  const finalCount = await getCurrentCheckupCount();
  console.log(`Checkup seeding done. Error batches: ${errorCount}. Final total: ${finalCount}`);
}

async function seedMoreFiles(patientPairs) {
  console.log(`\nUploading 20 sample diagnostic files to Supabase Storage...`);

  // Ensure bucket exists
  try {
    await supabaseAdmin.storage.createBucket('patient-reports', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      fileSizeLimit: 10485760
    });
  } catch (e) { /* bucket already exists */ }

  // Fetch 20 random checkups to attach files to
  const { data: randomCheckups, error: rcErr } = await supabaseAdmin
    .from('checkups')
    .select('id, patient_id, doctor_id')
    .limit(20);

  if (rcErr || !randomCheckups || randomCheckups.length === 0) {
    console.error("Failed to fetch checkups for file uploads:", rcErr?.message || 'No data');
    return;
  }

  const reportTypes = ['Biopsy', 'MRI', 'CT Scan', 'Blood Test', 'Consent', 'Pathology', 'X-Ray', 'PET Scan', 'Dermatoscopy', 'Endoscopy'];
  const reportContents = [
    'Biopsy report: negative for malignancy in initial biopsy site. Hyperkeratosis noted. Review recommended.',
    'MRI scan: no deep muscle infiltration detected on tongue border. Margins appear clear.',
    'CT Scan: No bone invasion detected. Lymph node architecture preserved bilaterally.',
    'Hematology report: hemoglobin levels within normal range. WBC elevated at 11,200/µL.',
    'Patient clinical consent form: signed for tissue extraction and biopsy procedures.',
    'Pathology report: carcinoma in situ. Complete margin assessment pending.',
    'Panoramic X-Ray: No periapical lesions or bone loss detected in posterior mandible.',
    'PET Scan: Focal uptake at left lateral tongue, SUV max 4.2. No distant metastases.',
    'Dermatoscopy image: irregular pigmentation pattern on buccal mucosa, benign appearance.',
    'Endoscopy: No pharyngeal or laryngeal involvement detected. Mucosa appears normal.'
  ];

  let uploadedCount = 0;

  for (let f = 0; f < Math.min(randomCheckups.length, 20); f++) {
    const checkup = randomCheckups[f];
    const reportType = reportTypes[f % reportTypes.length];
    const content = reportContents[f % reportContents.length];
    const patientId = checkup.patient_id;
    const doctorId = checkup.doctor_id;
    const visitId = checkup.id;

    const fileBuffer = Buffer.from(
      `%PDF-1.4 RTooth Clinical Report\n\nReport Type: ${reportType}\nVisit ID: ${visitId}\nDate: ${new Date().toISOString()}\n\n${content}`,
      'utf-8'
    );

    const timestamp = Date.now();
    const uniqueFileName = `${patientId}/${reportType.replace(/\s/g, '_')}-Visit-${visitId.substring(0, 8)}-${timestamp}.pdf`;
    const finalFileName = `SeededPatient-${reportType.replace(/\s/g, '_')}-Visit-${visitId.substring(0, 8)}.pdf`;

    try {
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('patient-reports')
        .upload(uniqueFileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadErr) {
        console.error(`  Upload error for ${finalFileName}: ${uploadErr.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('patient-reports')
        .getPublicUrl(uniqueFileName);

      const { error: dbErr } = await supabaseAdmin
        .from('patient_reports')
        .insert([{
          patient_id: patientId,
          doctor_id: doctorId,
          checkup_id: visitId,
          report_type: reportType,
          file_name: finalFileName,
          file_url: publicUrl
        }]);

      if (dbErr) {
        console.error(`  DB insert error for ${finalFileName}: ${dbErr.message}`);
      } else {
        uploadedCount++;
        console.log(`  [${uploadedCount}] Uploaded: ${finalFileName}`);
      }
    } catch (err) {
      console.error(`  Exception uploading ${finalFileName}: ${err.message}`);
    }

    await sleep(300);
  }

  console.log(`File upload complete. Uploaded ${uploadedCount} files.`);
}

async function main() {
  console.log("==================================================");
  console.log("RTooth Resume Seeder - Checkups & File Uploads");
  console.log("==================================================");

  // Fetch all patient-doctor pairs
  const pairs = await getAllPatientDoctorPairs();
  if (pairs.length === 0) {
    console.error("No patients found! Run the main seeder first.");
    process.exit(1);
  }

  // Resume checkup seeding
  await resumeCheckupSeeding(pairs, 50000);

  // Seed file uploads
  supabaseAdmin = makeClient();
  await seedMoreFiles(pairs);

  console.log("\n==================================================");
  console.log("Resume seeding complete!");
  console.log("==================================================");

  // Final counts
  const { count: c } = await supabaseAdmin.from('checkups').select('*', { count: 'exact', head: true });
  const { count: r } = await supabaseAdmin.from('patient_reports').select('*', { count: 'exact', head: true });
  console.log(`Final checkups total: ${c}`);
  console.log(`Final reports total: ${r}`);
}

main().catch(err => console.error("Fatal error:", err));
