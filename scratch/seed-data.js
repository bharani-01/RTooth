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

// Demo Doctors Data
const doctorsToSeed = [
  {
    email: "emily@rtooth.in",
    password: "DoctorPassword123",
    firstName: "Emily",
    lastName: "Smith",
    phone: "9876543210",
    specialization: "Oral Oncology",
    licenseNumber: "MDS-109283"
  },
  {
    email: "amit@rtooth.in",
    password: "DoctorPassword123",
    firstName: "Amit",
    lastName: "Verma",
    phone: "8765432109",
    specialization: "Oral Pathology",
    licenseNumber: "MDS-228391"
  }
];

// Demo Patients Data (mapped to doctor emails)
const patientsToSeed = [
  {
    doctorEmail: "emily@rtooth.in",
    email: "rahul@rtooth.in",
    password: "PatientPassword123",
    firstName: "Rahul",
    lastName: "Sharma",
    phone: "+91 99887 76655",
    dateOfBirth: "1981-06-15",
    gender: "Male",
    address: "123 Green Avenue, Delhi",
    status: "active",
    // Habits
    tobaccoHabit: "smoking",
    tobaccoFrequency: "5 cigarettes/day",
    tobaccoDuration: "5 years",
    alcoholHabit: "occasional",
    alcoholFrequency: "2 times a week",
    alcoholDuration: "3 years",
    betelNut: "no",
    familyHistory: "no",
    // Medical Record
    cancerStage: "Stage II",
    lesionLocation: "Lateral Tongue",
    riskFactors: "Smoking (5 yrs)"
  },
  {
    doctorEmail: "emily@rtooth.in",
    email: "priya@rtooth.in",
    password: "PatientPassword123",
    firstName: "Priya",
    lastName: "Patel",
    phone: "+91 88776 65544",
    dateOfBirth: "1988-11-22",
    gender: "Female",
    address: "45 Lotus Lane, Mumbai",
    status: "active",
    // Habits
    tobaccoHabit: "none",
    tobaccoFrequency: "",
    tobaccoDuration: "",
    alcoholHabit: "none",
    alcoholFrequency: "",
    alcoholDuration: "",
    betelNut: "no",
    familyHistory: "no",
    // Medical Record
    cancerStage: "Stage I",
    lesionLocation: "Floor of Mouth",
    riskFactors: "None"
  },
  {
    doctorEmail: "emily@rtooth.in",
    email: "sneha@rtooth.in",
    password: "PatientPassword123",
    firstName: "Sneha",
    lastName: "Gupta",
    phone: "+91 77665 54433",
    dateOfBirth: "1995-04-10",
    gender: "Female",
    address: "78 Rose Gardens, Bangalore",
    status: "draft", // Saved as DRAFT!
    // Habits
    tobaccoHabit: "smokeless",
    tobaccoFrequency: "3 packets/day",
    tobaccoDuration: "4 years",
    alcoholHabit: "none",
    alcoholFrequency: "",
    alcoholDuration: "",
    betelNut: "yes",
    familyHistory: "yes",
    // Medical Record
    cancerStage: "Suspicious Lesion",
    lesionLocation: "Hard Palate",
    riskFactors: "Betel nut chewing"
  },
  {
    doctorEmail: "amit@rtooth.in",
    email: "rajesh@rtooth.in",
    password: "PatientPassword123",
    firstName: "Rajesh",
    lastName: "Kumar",
    phone: "+91 66554 43322",
    dateOfBirth: "1975-09-30",
    gender: "Male",
    address: "99 Sunrise Heights, Kolkata",
    status: "active",
    // Habits
    tobaccoHabit: "both",
    tobaccoFrequency: "10 cigarettes & 2 packets/day",
    tobaccoDuration: "12 years",
    alcoholHabit: "habitual",
    alcoholFrequency: "Daily",
    alcoholDuration: "8 years",
    betelNut: "yes",
    familyHistory: "no",
    // Medical Record
    cancerStage: "High-Risk Dysplasia",
    lesionLocation: "Buccal Mucosa",
    riskFactors: "Heavy smoking & alcohol intake"
  },
  {
    doctorEmail: "emily@rtooth.in",
    email: "vikram@rtooth.in",
    password: "PatientPassword123",
    firstName: "Vikram",
    lastName: "Singh",
    phone: "+91 99112 23344",
    dateOfBirth: "1960-03-24",
    gender: "Male",
    address: "42 Galaxy Towers, Delhi",
    status: "active",
    // Habits
    tobaccoHabit: "smoking",
    tobaccoFrequency: "2 cigarettes/day",
    tobaccoDuration: "10 years",
    alcoholHabit: "none",
    alcoholFrequency: "",
    alcoholDuration: "",
    betelNut: "no",
    familyHistory: "no",
    // Medical Record
    cancerStage: "Stage III",
    lesionLocation: "Buccal Mucosa",
    riskFactors: "Smoking"
  }
];

async function seedData() {
  console.log("==================================================");
  console.log("Starting RTooth Clinic Seed Script...");
  console.log("==================================================");

  const doctorIdMap = new Map();

  // 1. Seed Doctors
  for (const doc of doctorsToSeed) {
    try {
      console.log(`Seeding Doctor: ${doc.firstName} ${doc.lastName} (${doc.email})...`);
      
      let userId = await getUserIdByEmail(doc.email);
      if (userId) {
        console.log(`  Doctor auth account already exists. Using ID: ${userId}`);
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: doc.email,
          password: doc.password,
          email_confirm: true,
          user_metadata: {
            first_name: doc.firstName,
            last_name: doc.lastName,
            role: 'doctor'
          }
        });

        if (authError) {
          console.error(`  Failed to create Doctor auth: ${authError.message}`);
          continue;
        }
        userId = authData.user?.id;
      }

      if (!userId) continue;
      doctorIdMap.set(doc.email, userId);

      // Create base profile
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: doc.email,
        role: 'doctor',
        first_name: doc.firstName,
        last_name: doc.lastName,
        phone: doc.phone
      });

      // Create doctor details
      await supabaseAdmin.from('doctors').upsert({
        id: userId,
        specialization: doc.specialization,
        license_number: doc.licenseNumber
      });

      console.log(`  Doctor ${doc.firstName} seeded successfully.`);
    } catch (e) {
      console.error(`  Error seeding doctor ${doc.email}:`, e.message);
    }
  }

  // 2. Seed Patients
  for (const pat of patientsToSeed) {
    try {
      console.log(`Seeding Patient: ${pat.firstName} ${pat.lastName} (${pat.email})...`);

      const doctorId = doctorIdMap.get(pat.doctorEmail);
      if (!doctorId) {
        console.error(`  Cannot seed patient: Attending doctor ${pat.doctorEmail} was not seeded.`);
        continue;
      }

      let userId = await getUserIdByEmail(pat.email);
      if (userId) {
        console.log(`  Patient auth account already exists. Using ID: ${userId}`);
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: pat.email,
          password: pat.password,
          email_confirm: true,
          user_metadata: {
            first_name: pat.firstName,
            last_name: pat.lastName,
            role: 'patient'
          }
        });

        if (authError) {
          console.error(`  Failed to create Patient auth: ${authError.message}`);
          continue;
        }
        userId = authData.user?.id;
      }

      if (!userId) continue;

      // Profiles table
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: pat.email,
        role: 'patient',
        first_name: pat.firstName,
        last_name: pat.lastName,
        phone: pat.phone
      });

      // Patients table
      await supabaseAdmin.from('patients').upsert({
        id: userId,
        date_of_birth: pat.dateOfBirth,
        gender: pat.gender,
        address: pat.address,
        doctor_id: doctorId,
        status: pat.status
      });

      // Lifestyle Habits table
      await supabaseAdmin.from('lifestyle_habits').upsert({
        patient_id: userId,
        tobacco_habit: pat.tobaccoHabit,
        tobacco_frequency: pat.tobaccoFrequency || null,
        tobacco_duration: pat.tobaccoDuration || null,
        alcohol_habit: pat.alcoholHabit,
        alcohol_frequency: pat.alcoholFrequency || null,
        alcohol_duration: pat.alcoholDuration || null,
        betel_nut: pat.betelNut,
        family_history: pat.familyHistory
      });

      // Medical Records table
      await supabaseAdmin.from('medical_records').insert([
        {
          patient_id: userId,
          cancer_stage: pat.cancerStage,
          lesion_location: pat.lesionLocation,
          risk_factors: pat.riskFactors
        }
      ]);

      // Clear existing checkups and medications to avoid duplicate seed runs
      await supabaseAdmin.from('medications').delete().eq('patient_id', userId);
      await supabaseAdmin.from('checkups').delete().eq('patient_id', userId);

      if (pat.email === "rahul@rtooth.in") {
        console.log(`  Seeding clinical medications for Rahul...`);
        await supabaseAdmin.from('medications').insert([
          {
            patient_id: userId,
            medication_name: "Amoxicillin",
            dosage: "500mg",
            frequency: "Twice daily",
            start_date: "2026-06-01",
            end_date: "2026-06-07"
          },
          {
            patient_id: userId,
            medication_name: "Curcumin Oral Gel",
            dosage: "1 application",
            frequency: "3 times daily",
            start_date: "2026-06-05",
            end_date: null
          }
        ]);

        console.log(`  Seeding checkups for Rahul...`);
        await supabaseAdmin.from('checkups').insert([
          {
            patient_id: userId,
            doctor_id: doctorId,
            checkup_date: new Date("2026-06-05T10:00:00Z").toISOString(),
            findings: "Initial lesion on lateral border of tongue observed. Advised biopsy.",
            notes: "Patient complained of mild pain while chewing.",
            recommendations: "Schedule biopsy, maintain strict oral hygiene."
          },
          {
            patient_id: userId,
            doctor_id: doctorId,
            checkup_date: new Date("2026-06-12T11:30:00Z").toISOString(),
            findings: "Post-biopsy follow-up. Lesion size stable. Mild discomfort reporting.",
            notes: "Sutures healing well.",
            recommendations: "Follow-up scan in 3 months.",
            next_checkup_date: new Date("2026-06-15T11:30:00Z").toISOString(),
            followup_interval: "3 days",
            followup_notes: "Urgent post-biopsy review for lesion evaluation."
          }
        ]);
      } else if (pat.email === "priya@rtooth.in") {
        console.log(`  Seeding clinical medications for Priya...`);
        await supabaseAdmin.from('medications').insert([
          {
            patient_id: userId,
            medication_name: "Vitamin C Supplements",
            dosage: "500mg",
            frequency: "Once daily",
            start_date: "2026-06-10",
            end_date: null
          }
        ]);

        console.log(`  Seeding checkups for Priya...`);
        await supabaseAdmin.from('checkups').insert([
          {
            patient_id: userId,
            doctor_id: doctorId,
            checkup_date: new Date("2026-06-10T11:30:00Z").toISOString(),
            findings: "Small red area on floor of mouth. Looks like early stage erythroplakia.",
            notes: "Patient is non-smoker, occasional alcohol drinker.",
            recommendations: "Regular follow-up in 2 weeks to check regression.",
            next_checkup_date: new Date("2026-06-20T11:30:00Z").toISOString(),
            followup_interval: "2 weeks",
            followup_notes: "Lesion site status verification."
          }
        ]);
      } else if (pat.email === "vikram@rtooth.in") {
        console.log(`  Seeding checkups for Vikram...`);
        await supabaseAdmin.from('checkups').insert([
          {
            patient_id: userId,
            doctor_id: doctorId,
            checkup_date: new Date("2026-06-15T09:30:00Z").toISOString(),
            findings: "Stage III lesion, stable progress post radiation therapy.",
            notes: "No new lesion boundaries detected.",
            recommendations: "Routine follow-up in 1 month.",
            next_checkup_date: new Date("2026-07-15T09:30:00Z").toISOString(),
            followup_interval: "1 month",
            followup_notes: "Routine post-radiation checkup."
          }
        ]);
      }

      console.log(`  Patient ${pat.firstName} seeded successfully. (Status: ${pat.status.toUpperCase()})`);
    } catch (e) {
      console.error(`  Error seeding patient ${pat.email}:`, e.message);
    }
  }

  console.log("==================================================");
  console.log("Seeding process completed!");
  console.log("==================================================");
}

async function getUserIdByEmail(email) {
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  if (listData) {
    const user = listData.users.find(u => u.email === email);
    return user?.id;
  }
  return null;
}

seedData();
