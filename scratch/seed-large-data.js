import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Setup mock data helpers
const FIRST_NAMES = ['Aarav', 'Ananya', 'Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Rajesh', 'Emily', 'David', 'Sarah', 'Michael', 'Jessica', 'James', 'Karan', 'Neha', 'Sanjay', 'Deepika', 'Arjun', 'Meera', 'Rohan', 'Aditi', 'Vijay', 'Kavita', 'Suresh', 'Pooja', 'Abhishek', 'Ritu', 'Manish', 'Jyoti'];
const LAST_NAMES = ['Sharma', 'Patel', 'Verma', 'Kumar', 'Singh', 'Gupta', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Joshi', 'Mehta', 'Reddy', 'Nair', 'Iyer', 'Sen', 'Das', 'Roy', 'Choudhury', 'Rao', 'Pillai', 'Gaur', 'Trivedi', 'Kapoor'];
const SPECIALIZATIONS = ['Oral Oncology', 'Oral Pathology', 'General Dentistry', 'Periodontics', 'Prosthodontics', 'Orthodontics', 'Endodontics', 'Oral Surgery'];
const LESION_LOCATIONS = ['Lateral Tongue', 'Floor of Mouth', 'Buccal Mucosa', 'Hard Palate', 'Soft Palate', 'Gingiva'];
const CANCER_STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'High-Risk Dysplasia', 'Suspicious Lesion', 'None'];
const TOBACCO_HABITS = ['none', 'smoking', 'smokeless', 'both'];
const ALCOHOL_HABITS = ['none', 'occasional', 'habitual'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to delay execution
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper to create or fetch auth user
async function createOrGetAuthUser(email, password, metadata) {
  let attempt = 0;
  while (attempt < 3) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata
      });
      if (error) {
        // If user already exists, retrieve them
        if (error.message.includes('already registered') || error.status === 422) {
          // Check profiles
          const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
          if (profile) return profile.id;
          
          // Otherwise list users
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          if (listData?.users) {
            const u = listData.users.find(x => x.email === email);
            if (u) return u.id;
          }
        }
        throw error;
      }
      return data.user.id;
    } catch (err) {
      attempt++;
      console.warn(`[AUTH] Failed for ${email} (attempt ${attempt}/3): ${err.message}`);
      await sleep(1000 * attempt);
    }
  }
  throw new Error(`Failed to create/get auth user for ${email} after 3 attempts.`);
}

async function runSeeder() {
  console.log("==================================================");
  console.log("Starting large-scale RTooth database seeder...");
  console.log("==================================================");

  // 1. Generate Doctors data
  const doctorsData = [];
  for (let i = 1; i <= 50; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    doctorsData.push({
      email: `seeded_doc_${i}@rtooth.in`,
      password: 'DoctorPassword123',
      firstName,
      lastName,
      phone: `98765${String(i).padStart(5, '0')}`,
      specialization: getRandomElement(SPECIALIZATIONS),
      licenseNumber: `MDS-${100000 + i}`
    });
  }

  // 2. Create Doctors
  console.log(`Seeding 50 Doctors...`);
  const doctorIds = [];
  const batchSize = 10;
  
  for (let i = 0; i < doctorsData.length; i += batchSize) {
    const chunk = doctorsData.slice(i, i + batchSize);
    const promises = chunk.map(async (doc) => {
      const userId = await createOrGetAuthUser(doc.email, doc.password, {
        first_name: doc.firstName,
        last_name: doc.lastName,
        role: 'doctor'
      });
      
      // profiles
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: doc.email,
        role: 'doctor',
        first_name: doc.firstName,
        last_name: doc.lastName,
        phone: doc.phone
      });

      // doctors
      await supabaseAdmin.from('doctors').upsert({
        id: userId,
        specialization: doc.specialization,
        license_number: doc.licenseNumber
      });

      return userId;
    });

    const ids = await Promise.all(promises);
    doctorIds.push(...ids);
    console.log(`  Seeded doctors ${i + chunk.length}/50`);
    await sleep(200); // Prevent hitting rate limits
  }

  console.log(`Successfully seeded ${doctorIds.length} doctors.`);

  // 3. Generate Patients data
  const patientsData = [];
  for (let i = 1; i <= 1000; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const birthYear = getRandomInt(1950, 2010);
    const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
    const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');
    const gender = getRandomInt(0, 1) === 0 ? 'Male' : 'Female';
    const status = getRandomInt(1, 100) <= 5 ? 'draft' : 'active';
    const doctorId = getRandomElement(doctorIds);

    patientsData.push({
      email: `seeded_pat_${i}@rtooth.in`,
      password: 'PatientPassword123',
      firstName,
      lastName,
      phone: `+91 99887 ${String(i).padStart(5, '0')}`,
      dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
      gender,
      address: `${getRandomInt(10, 999)} Clinic Lane, Sector-${getRandomInt(1, 25)}, New Delhi`,
      status,
      doctorId,
      // Habits
      tobaccoHabit: getRandomElement(TOBACCO_HABITS),
      tobaccoFrequency: getRandomInt(1, 10) + ' times/day',
      tobaccoDuration: getRandomInt(1, 20) + ' years',
      alcoholHabit: getRandomElement(ALCOHOL_HABITS),
      alcoholFrequency: getRandomInt(1, 7) + ' times/week',
      alcoholDuration: getRandomInt(1, 15) + ' years',
      betelNut: getRandomInt(0, 1) === 0 ? 'no' : 'yes',
      familyHistory: getRandomInt(0, 1) === 0 ? 'no' : 'yes',
      // Staging
      cancerStage: getRandomElement(CANCER_STAGES),
      lesionLocation: getRandomElement(LESION_LOCATIONS),
      riskFactors: 'Simulated clinical profile'
    });
  }

  // 4. Create Patients
  console.log(`Seeding 1000 Patients (Auth, Profiles, Habits, and Staging)...`);
  const patientIds = [];
  const patientBatchSize = 15;

  for (let i = 0; i < patientsData.length; i += patientBatchSize) {
    const chunk = patientsData.slice(i, i + patientBatchSize);
    const promises = chunk.map(async (pat) => {
      const userId = await createOrGetAuthUser(pat.email, pat.password, {
        first_name: pat.firstName,
        last_name: pat.lastName,
        role: 'patient'
      });

      // profile
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: pat.email,
        role: 'patient',
        first_name: pat.firstName,
        last_name: pat.lastName,
        phone: pat.phone
      });

      // patient detail
      await supabaseAdmin.from('patients').upsert({
        id: userId,
        date_of_birth: pat.dateOfBirth,
        gender: pat.gender,
        address: pat.address,
        doctor_id: pat.doctorId,
        status: pat.status
      });

      // lifestyle habits
      await supabaseAdmin.from('lifestyle_habits').upsert({
        patient_id: userId,
        tobacco_habit: pat.tobaccoHabit,
        tobacco_frequency: pat.tobaccoHabit !== 'none' ? pat.tobaccoFrequency : null,
        tobacco_duration: pat.tobaccoHabit !== 'none' ? pat.tobaccoDuration : null,
        alcohol_habit: pat.alcoholHabit,
        alcohol_frequency: pat.alcoholHabit !== 'none' ? pat.alcoholFrequency : null,
        alcohol_duration: pat.alcoholHabit !== 'none' ? pat.alcoholDuration : null,
        betel_nut: pat.betelNut,
        family_history: pat.familyHistory
      });

      // medical record (staging)
      await supabaseAdmin.from('medical_records').upsert({
        patient_id: userId,
        cancer_stage: pat.cancerStage,
        lesion_location: pat.lesionLocation,
        risk_factors: pat.riskFactors
      });

      return { id: userId, doctorId: pat.doctorId };
    });

    const results = await Promise.all(promises);
    patientIds.push(...results);
    console.log(`  Seeded patients ${i + chunk.length}/1000`);
    await sleep(300); // Prevent hitting rate limits
  }

  console.log(`Successfully seeded ${patientIds.length} patients.`);

  // 5. Generate and Seed 50,000 Checkups (Medical Records)
  console.log(`Generating 50,000 medical checkup records...`);
  const checkups = [];
  const now = new Date();

  // Create ~50 checkups per patient to reach 50,000 total
  for (const pat of patientIds) {
    const checkupCount = getRandomInt(45, 55);
    for (let c = 0; c < checkupCount; c++) {
      // Date distributed over the last 730 days
      const dateOffset = getRandomInt(1, 730);
      const checkupDate = new Date(now.getTime() - dateOffset * 24 * 60 * 60 * 1000);

      checkups.push({
        patient_id: pat.id,
        doctor_id: pat.doctorId,
        checkup_date: checkupDate.toISOString(),
        findings: `Seeded diagnostic review #${c + 1}. Patient shows stable signs. Lesion location inspected.`,
        notes: `Routine follow-up notes. Patient advised to follow guidelines.`,
        recommendations: `Maintain regular scheduling. Brush twice daily. Avoid irritants.`
      });
    }
  }

  // Trim to exactly 50,000 or keep what we generated
  const targetCheckupsCount = 50000;
  const checkupsToInsert = checkups.slice(0, targetCheckupsCount);

  console.log(`Inserting ${checkupsToInsert.length} checkups in batches of 2500...`);
  const dbBatchSize = 2500;
  for (let i = 0; i < checkupsToInsert.length; i += dbBatchSize) {
    const batch = checkupsToInsert.slice(i, i + dbBatchSize);
    const { error } = await supabaseAdmin.from('checkups').insert(batch);
    if (error) {
      console.error(`  Error inserting checkup batch starting at ${i}:`, error.message);
      // Try once more with smaller chunk size if failed
      console.log(`  Retrying checkup batch starting at ${i} in smaller chunks...`);
      const subBatchSize = 500;
      for (let j = 0; j < batch.length; j += subBatchSize) {
        const subBatch = batch.slice(j, j + subBatchSize);
        const { error: subErr } = await supabaseAdmin.from('checkups').insert(subBatch);
        if (subErr) console.error(`    Sub-batch error:`, subErr.message);
      }
    } else {
      console.log(`  Seeded checkups ${i + batch.length}/${checkupsToInsert.length}`);
    }
    await sleep(100);
  }

  console.log(`Successfully seeded medical checkups.`);

  // 6. Upload sample reports and files to Storage and DB
  console.log(`Uploading sample diagnostic files to Supabase Storage...`);
  const fileContents = [
    { name: 'biopsy_report.pdf', type: 'Biopsy', content: 'Biopsy report: negative for malignancy, hyperkeratosis noted.' },
    { name: 'mri_scan.pdf', type: 'MRI', content: 'MRI scan: no deep muscle infiltration detected on tongue border.' },
    { name: 'patient_consent.pdf', type: 'Consent', content: 'Patient clinical consent form: signed for tissue extraction.' },
    { name: 'followup_images.pdf', type: 'Image', content: 'Follow-up images: lesion size remains at 5mm width.' },
    { name: 'blood_test.pdf', type: 'Blood Test', content: 'Hematology report: hemoglobin levels within normal range.' }
  ];

  // Pick 5 random patients and visits to link the files to
  const { data: randomCheckups, error: rcErr } = await supabaseAdmin
    .from('checkups')
    .select('id, patient_id, doctor_id')
    .limit(5);

  if (rcErr || !randomCheckups || randomCheckups.length === 0) {
    console.error("Failed to fetch random checkups for file uploads:", rcErr?.message);
  } else {
    // Ensure bucket exists
    try {
      await supabaseAdmin.storage.createBucket('patient-reports', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
        fileSizeLimit: 10485760
      });
    } catch (e) {
      // Ignore if bucket exists
    }

    for (let f = 0; f < randomCheckups.length; f++) {
      const checkup = randomCheckups[f];
      const mockFile = fileContents[f];
      const patientId = checkup.patient_id;
      const doctorId = checkup.doctor_id;
      const visitId = checkup.id;

      const fileBuffer = Buffer.from(mockFile.content, 'utf-8');
      const uniqueFileName = `${patientId}/SeededPatient-SeededReport-${f + 1}-Visit-${visitId}.pdf`;
      const finalFileName = `SeededPatient-${mockFile.type}-Report-Visit-${visitId.substring(0, 8)}.pdf`;

      // Upload file
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from('patient-reports')
        .upload(uniqueFileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadErr) {
        console.error(`  Error uploading ${mockFile.name}:`, uploadErr.message);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('patient-reports')
        .getPublicUrl(uniqueFileName);

      // Insert database entry
      const { error: dbReportErr } = await supabaseAdmin
        .from('patient_reports')
        .insert([
          {
            patient_id: patientId,
            doctor_id: doctorId,
            checkup_id: visitId,
            report_type: mockFile.type,
            file_name: finalFileName,
            file_url: publicUrl
          }
        ]);

      if (dbReportErr) {
        console.error(`  Error inserting report row for ${finalFileName}:`, dbReportErr.message);
      } else {
        console.log(`  Successfully uploaded and registered file: ${finalFileName}`);
      }
    }
  }

  console.log("==================================================");
  console.log("Database Seeder successfully completed!");
  console.log("==================================================");
}

runSeeder().catch(err => {
  console.error("Unhandled exception during seeding:", err);
});
