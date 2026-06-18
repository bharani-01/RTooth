/**
 * ============================================================
 * RTooth Chennai Hospital - Production API Stress Test Seeder
 * ============================================================
 * Target: https://rtooth-wn3z.onrender.com
 * 
 * Simulates 3-6 months of real hospital data for a Chennai
 * oral oncology centre handling 5000+ patients daily.
 * 
 * Flow:
 *  1. Admin login → Register 50 doctors
 *  2. Each doctor logs in → Registers 40 patients
 *  3. Each doctor creates visits (checkups + medications + reports)
 *     distributed over 180 days
 *  4. Patients log monthly symptoms
 * 
 * Total target:
 *   - 50 doctors
 *   - 2000 patients
 *   - ~12,000 visits (6 visits/patient avg over 6 months)
 *   - ~24,000 medications
 *   - ~4000 symptom logs
 * ============================================================
 */

const BASE_URL = 'https://rtooth-wn3z.onrender.com';
const API = `${BASE_URL}/api/v1`;

const ADMIN_EMAIL = 'admin@rtooth.in';
const ADMIN_PASSWORD = 'AdminPassword123';

// ── Data pools (Chennai / Tamil Nadu realistic) ──────────────

const TAMIL_FIRST_NAMES = [
  'Murugan', 'Selvam', 'Rajendran', 'Venkatesan', 'Subramaniam',
  'Kamala', 'Meenakshi', 'Lakshmi', 'Sundaram', 'Annamalai',
  'Palani', 'Tamilarasi', 'Kavitha', 'Prabhakaran', 'Senthil',
  'Vijayalakshmi', 'Thangam', 'Krishnamoorthy', 'Parvathy', 'Natarajan',
  'Arumugam', 'Chellamuthu', 'Duraisamy', 'Eswaran', 'Ganesan',
  'Hema', 'Indira', 'Jayaraman', 'Kokila', 'Loganathan',
  'Muthusamy', 'Nalini', 'Padmavathi', 'Ramachandran', 'Saraswathi',
  'Thilaga', 'Uma', 'Vasantha', 'Yamuna', 'Aarathi',
  'Balaji', 'Chandran', 'Dinesh', 'Ezhilarasi', 'Fathima',
  'Govindasamy', 'Harini', 'Ilango', 'Jeyarani', 'Karthik',
  'Lalitha', 'Manikandan', 'Nithya', 'Ponraj', 'Rajalakshmi',
  'Sathishkumar', 'Thilagavathi', 'Umarani', 'Valliammai', 'Zahir'
];

const TAMIL_LAST_NAMES = [
  'Murugesan', 'Krishnan', 'Rajan', 'Venkatesh', 'Pillai',
  'Naidu', 'Iyer', 'Iyengar', 'Chettiar', 'Nair',
  'Gounder', 'Thevar', 'Pandian', 'Arumugam', 'Selvam',
  'Sundarajan', 'Muthukumar', 'Ramasamy', 'Palanisamy', 'Subramanian',
  'Anandan', 'Balasubramanian', 'Chandrasekaran', 'Durai', 'Elumalai',
  'Ganesh', 'Hariharan', 'Ilayaraja', 'Jeyaraj', 'Kandan',
  'Lakshmanan', 'Manickam', 'Nagarajan', 'Perumal', 'Rajasekaran',
  'Sankar', 'Thirumalai', 'Udayakumar', 'Vadivel', 'Veluswamy'
];

const CHENNAI_AREAS = [
  'Anna Nagar', 'T. Nagar', 'Velachery', 'Adyar', 'Tambaram',
  'Porur', 'Chromepet', 'Perambur', 'Villivakkam', 'Ambattur',
  'Avadi', 'Pallavaram', 'Madipakkam', 'Sholinganallur', 'OMR',
  'ECR', 'Mogappair', 'Korattur', 'Guindy', 'K.K. Nagar',
  'West Mambalam', 'Kodambakkam', 'Mylapore', 'Nungambakkam', 'Egmore'
];

const SPECIALIZATIONS = [
  'Oral Oncology', 'Oral Pathology', 'Maxillofacial Surgery',
  'Oral Medicine', 'Radiation Oncology', 'General Dentistry',
  'Periodontics', 'Prosthodontics', 'Orthodontics', 'Endodontics',
  'Pedodontics', 'Oral Surgery', 'Oral Radiology', 'Oral Biology',
  'Head & Neck Oncology'
];

const LESION_LOCATIONS = [
  'Lateral Tongue', 'Floor of Mouth', 'Buccal Mucosa',
  'Hard Palate', 'Soft Palate', 'Gingiva',
  'Retromolar Trigone', 'Lip', 'Alveolar Ridge', 'Oropharynx'
];

const CANCER_STAGES = [
  'Stage I', 'Stage II', 'Stage III', 'Stage IV',
  'High-Risk Dysplasia', 'Suspicious Lesion',
  'Carcinoma In Situ', 'None'
];

const TOBACCO_HABITS = ['none', 'smoking', 'smokeless', 'both'];
const ALCOHOL_HABITS = ['none', 'occasional', 'habitual'];

// Real Chennai oral oncology medications
const MEDICATIONS_POOL = [
  { name: 'Amoxicillin', dosages: ['250mg', '500mg'], freqs: ['TDS', 'BD'] },
  { name: 'Metronidazole', dosages: ['200mg', '400mg'], freqs: ['TDS', 'BD'] },
  { name: 'Ibuprofen', dosages: ['200mg', '400mg', '600mg'], freqs: ['TDS', 'BD', 'SOS'] },
  { name: 'Paracetamol', dosages: ['500mg', '650mg'], freqs: ['QID', 'TDS', 'SOS'] },
  { name: 'Chlorhexidine Mouthwash', dosages: ['0.12%', '0.2%'], freqs: ['BD', 'TDS'] },
  { name: 'Diclofenac Sodium', dosages: ['50mg', '75mg'], freqs: ['BD', 'TDS'] },
  { name: 'Prednisolone', dosages: ['5mg', '10mg', '20mg'], freqs: ['OD', 'BD'] },
  { name: 'Nystatin Oral Suspension', dosages: ['100,000 IU/mL'], freqs: ['QID'] },
  { name: 'Fluconazole', dosages: ['50mg', '150mg'], freqs: ['OD'] },
  { name: 'Cetirizine', dosages: ['5mg', '10mg'], freqs: ['OD', 'BD'] },
  { name: 'Omeprazole', dosages: ['20mg', '40mg'], freqs: ['OD', 'BD'] },
  { name: 'Vitamin B Complex', dosages: ['1 tablet'], freqs: ['OD'] },
  { name: 'Zinc Sulphate', dosages: ['45mg', '220mg'], freqs: ['OD', 'BD'] },
  { name: 'Lycopene', dosages: ['2mg', '4mg', '8mg'], freqs: ['OD', 'BD'] },
  { name: 'Antifungal Gel (Miconazole)', dosages: ['20mg/g'], freqs: ['TDS', 'QID'] },
  { name: 'Clindamycin', dosages: ['150mg', '300mg'], freqs: ['TDS', 'QID'] },
  { name: 'Acyclovir', dosages: ['200mg', '400mg'], freqs: ['5x/day', 'TDS'] },
  { name: 'Dexamethasone', dosages: ['0.5mg', '1mg', '4mg'], freqs: ['OD', 'BD'] },
  { name: 'Curcumin', dosages: ['500mg', '1000mg'], freqs: ['OD', 'BD', 'TDS'] },
  { name: 'Benzydamine Hydrochloride', dosages: ['0.15%'], freqs: ['TDS', 'QID'] },
];

const REPORT_TYPES = ['Biopsy', 'Histopathology', 'Imaging', 'Blood Report', 'Other'];

const FINDINGS_POOL = [
  'Persistent white patch (leukoplakia) noted on buccal mucosa, non-scrapable, 1.5 × 1cm. Borders irregular. No induration.',
  'Ulcerative lesion on lateral border of tongue, 2 × 1.5cm. Indurated margins. Patient reports pain on swallowing.',
  'Erythroplakia on floor of mouth. Bright red, velvety. 0.8 × 0.6cm. Biopsy recommended urgently.',
  'Verrucous lesion on gingiva, cauliflower-like surface, slow-growing per history. No regional lymphadenopathy.',
  'Submucous fibrosis noted bilaterally on buccal mucosa. Interincisal opening reduced to 28mm.',
  'Post-surgical review. Surgical site healing well. No signs of recurrence on clinical examination.',
  'Leukoplakia resolving with antifungal therapy. Lesion reduced by 40% compared to previous visit.',
  'Stage II squamous cell carcinoma on lateral tongue. Referred for radiotherapy planning.',
  'New onset of ulcer on soft palate, 1cm diameter. History of betel nut use. Biopsy taken.',
  'Follow-up post radiation therapy. Mucositis grade 2. Salivary gland hypofunction noted.',
  'Nodular lesion on retromolar trigone. Firm consistency. CT scan ordered.',
  'Healing on track after glossectomy. Flap viable. Speech therapy initiated.',
  'Candidal stomatitis superimposed on existing leukoplakia. Antifungal therapy started.',
  'Red and white mixed lesion on hard palate. Erythroleukoplakia. PET scan recommended.',
  'Patient reviewed post chemotherapy cycle 3. Oral mucositis under control. Continue supportive care.',
  'Normal oral mucosa. Routine surveillance visit. No new lesions detected.',
  'Suspicious pigmentation on gingiva. Melanocytic lesion, benign appearance. Photographed for records.',
  'Mandibular torus bilateral, asymptomatic. Patient reassured. No intervention needed.',
  'Parulis noted on upper left quadrant. Periapical abscess confirmed on radiograph.',
  'Angular cheilitis and glossitis. Iron deficiency anaemia suspected. Bloodwork ordered.',
];

const NOTES_POOL = [
  'Patient counselled on tobacco cessation. NRT patch recommended.',
  'Dietary modifications advised. Soft diet for 2 weeks. Avoid spicy food.',
  'Biopsy report awaited. Patient to return in 10 days.',
  'Patient compliant with previous prescription. Lesion shows improvement.',
  'Referred to oncology board for multidisciplinary review.',
  'Family history of oral cancer noted. Genetic counselling discussed.',
  'Patient anxious. Supportive counselling provided. Follow-up in 4 weeks.',
  'Saliva substitutes prescribed for xerostomia post-radiotherapy.',
  'Lymph node palpation — submandibular nodes mildly enlarged. Ultrasound ordered.',
  'Nutritional supplement advised. BMI low at 18.2.',
  'Patient arrived with family member. Interpreter aided in Tamil communication.',
  'Swab sent for culture. Candida suspected clinically.',
  'Pain well-controlled. VAS score reduced from 7 to 3.',
  'Next chemotherapy cycle in 3 weeks. Dental clearance given.',
  'Dry socket management done. Alvogyl placed. Antibiotics continued.',
];

const RECOMMENDATIONS_POOL = [
  'Return for biopsy report review in 10 days. Continue chlorhexidine rinse BD.',
  'Follow up in 6 weeks. Avoid tobacco and alcohol completely.',
  'Radiotherapy planning appointment at GH Chennai. Report to oncology OPD.',
  'Maintain oral hygiene diligently. Use soft-bristle toothbrush.',
  'Continue antifungal gel TDS for 14 days. Review if no improvement.',
  'Schedule MRI next visit. Carry all previous biopsy reports.',
  'Dietary supplement daily. Protein intake to be increased.',
  'Physiotherapy for trismus — jaw opening exercises 3×/day.',
  'Blood report review next visit. Check CBC and iron studies.',
  'Apply topical steroid (Kenacort in Orabase) BD for 7 days.',
  'Referral letter generated for Adyar Cancer Institute.',
  'Speech therapy sessions — 2x per week. Progress to be reviewed monthly.',
  'Salivary flow stimulants prescribed. Chew sugar-free gum.',
  'Repeat PAN radiograph in 3 months. Maintain dental records.',
  'Monthly surveillance recommended given high-risk profile.',
];

// ── Utility helpers ──────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randName() {
  return { first: rand(TAMIL_FIRST_NAMES), last: rand(TAMIL_LAST_NAMES) };
}
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}
function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// HTTP helpers
async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${data.message}`);
  return data;
}

// Login and get token
async function login(email, password) {
  const data = await post(`${API}/auth/login`, { email, password });
  return data.data.session.access_token;
}

// ── Main seeder ──────────────────────────────────────────────

let stats = {
  doctors: 0, patients: 0, visits: 0,
  medications: 0, symptoms: 0, reports: 0, errors: 0
};

async function registerDoctor(adminToken, i) {
  const { first, last } = randName();
  const email = `chn_doc_${i}@rtooth.in`;
  try {
    await post(`${API}/doctors`, {
      email,
      password: 'DoctorPassword123',
      firstName: first,
      lastName: last,
      phone: `+91 98${randInt(10,99)}${String(randInt(100000, 999999))}`,
      specialization: rand(SPECIALIZATIONS),
      licenseNumber: `TN-MDS-${200000 + i}`
    }, adminToken);
    stats.doctors++;
    return { email, password: 'DoctorPassword123', name: `Dr. ${first} ${last}` };
  } catch (e) {
    // Handle already-exists gracefully
    if (e.message.includes('already')) return { email, password: 'DoctorPassword123', name: `Dr. ${first} ${last}` };
    stats.errors++;
    console.error(`  ✗ Doctor ${i}: ${e.message}`);
    return null;
  }
}

async function registerPatient(doctorToken, i, globalIndex) {
  const { first, last } = randName();
  const area = rand(CHENNAI_AREAS);
  const doorNo = randInt(1, 999);
  const birthYear = randInt(1945, 2005);
  const stage = rand(CANCER_STAGES);
  const tobacco = rand(TOBACCO_HABITS);
  const alcohol = rand(ALCOHOL_HABITS);
  const gender = randInt(0, 1) === 0 ? 'Male' : 'Female';
  const email = `chn_pat_${globalIndex}@rtooth.in`;

  try {
    const res = await post(`${API}/patients`, {
      email,
      password: 'PatientPassword123',
      firstName: first,
      lastName: last,
      phone: `+91 99${randInt(10,99)}${String(randInt(100000, 999999))}`,
      dateOfBirth: `${birthYear}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`,
      gender,
      address: `${doorNo}, ${rand(['Gandhi Nagar', 'Nehru Street', 'Anna Salai', 'Kamarajar Road', 'MGR Nagar'])}, ${area}, Chennai - ${randInt(600001, 600130)}`,
      cancerStage: stage,
      lesionLocation: rand(LESION_LOCATIONS),
      riskFactors: `${tobacco !== 'none' ? 'Tobacco use. ' : ''}${alcohol !== 'none' ? 'Alcohol use. ' : ''}${randInt(0,1) ? 'Betel nut chewing. ' : ''}Family history noted.`,
      tobaccoHabit: tobacco,
      tobaccoFrequency: tobacco !== 'none' ? `${randInt(1,10)} times/day` : null,
      tobaccoDuration: tobacco !== 'none' ? `${randInt(1,25)} years` : null,
      alcoholHabit: alcohol,
      alcoholFrequency: alcohol !== 'none' ? `${randInt(1,7)} times/week` : null,
      alcoholDuration: alcohol !== 'none' ? `${randInt(1,20)} years` : null,
      betelNut: randInt(0,1) ? 'yes' : 'no',
      familyHistory: randInt(0,1) ? 'yes' : 'no',
      status: 'active'
    }, doctorToken);

    stats.patients++;
    return res.data?.profile?.id || res.data?.user?.id;
  } catch (e) {
    if (e.message.includes('already')) return null;
    stats.errors++;
    if (!e.message.includes('429')) console.error(`  ✗ Patient ${globalIndex}: ${e.message.substring(0,100)}`);
    return null;
  }
}

async function createVisit(doctorToken, patientId, daysAgo) {
  const checkupDate = pastDate(daysAgo);
  const followupDays = randInt(14, 60);
  const nextCheckup = new Date();
  nextCheckup.setDate(nextCheckup.getDate() + followupDays);

  // Pick 2-3 medications
  const numMeds = randInt(1, 3);
  const prescriptions = [];
  for (let m = 0; m < numMeds; m++) {
    const med = rand(MEDICATIONS_POOL);
    prescriptions.push({
      medication_name: med.name,
      dosage: rand(med.dosages),
      frequency: rand(med.freqs),
      start_date: dateStr(daysAgo),
      end_date: dateStr(daysAgo - randInt(7, 30))
    });
  }

  // Occasionally attach a report type
  const addReport = randInt(1, 5) === 1; // 20% chance

  try {
    // Use POST /api/patients/:id/checkups for visits (simpler, no file upload needed)
    await post(`${API}/patients/${patientId}/checkups`, {
      findings: rand(FINDINGS_POOL),
      notes: rand(NOTES_POOL),
      recommendations: rand(RECOMMENDATIONS_POOL),
      checkup_date: checkupDate,
      next_checkup_date: nextCheckup.toISOString(),
      followup_interval: `${followupDays} days`,
      followup_notes: rand(NOTES_POOL),
      prescriptions
    }, doctorToken);

    stats.visits++;
    stats.medications += prescriptions.length;
    return true;
  } catch (e) {
    stats.errors++;
    if (!e.message.includes('429')) console.error(`  ✗ Visit for ${patientId}: ${e.message.substring(0, 100)}`);
    return false;
  }
}

async function logSymptoms(patientToken, patientId) {
  const levels = ['None', 'Mild', 'Moderate', 'Severe'];
  // Log 3-6 monthly symptom entries spread over 6 months
  const numLogs = randInt(3, 6);
  for (let l = 0; l < numLogs; l++) {
    const daysAgo = l * randInt(25, 35);
    try {
      await post(`${API}/patients/me/symptoms`, {
        burning_sensation: rand(levels),
        pain_scale: randInt(0, 8),
        difficulty_opening_mouth: rand(levels),
        ulcer_duration: randInt(0, 30),
        bleeding: randInt(0, 1) === 1
      }, patientToken);
      stats.symptoms++;
    } catch (e) {
      stats.errors++;
    }
    await sleep(150);
  }
}

// ── Orchestrator ─────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RTooth Chennai Hospital - Production Stress Seeder  ║');
  console.log('║  Target: https://rtooth-wn3z.onrender.com            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── STEP 1: Admin login ──────────────────────────────────
  console.log('🔐 Logging in as IT Admin...');
  let adminToken;
  try {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('  ✓ Admin authenticated\n');
  } catch (e) {
    console.error('  ✗ Admin login failed:', e.message);
    process.exit(1);
  }

  // ── STEP 2: Register 50 doctors ──────────────────────────
  const DOCTOR_COUNT = 50;
  console.log(`👨‍⚕️  Registering ${DOCTOR_COUNT} Chennai doctors via API...`);
  const doctorCreds = [];

  for (let i = 1; i <= DOCTOR_COUNT; i++) {
    const cred = await registerDoctor(adminToken, i + 1000); // offset to avoid collision
    if (cred) doctorCreds.push(cred);
    if (i % 10 === 0) console.log(`  Progress: ${i}/${DOCTOR_COUNT} doctors registered`);
    await sleep(300); // Respect Render free-tier rate limits
  }
  console.log(`  ✓ ${stats.doctors} doctors registered\n`);

  // ── STEP 3: Each doctor registers patients ───────────────
  const PATIENTS_PER_DOCTOR = 40;
  console.log(`🧑‍🤝‍🧑 Registering ~${doctorCreds.length * PATIENTS_PER_DOCTOR} patients (${PATIENTS_PER_DOCTOR}/doctor)...`);

  let globalPatientIndex = 1000; // offset from existing
  const patientBatches = []; // [{doctorCred, patientIds:[]}]

  for (let d = 0; d < doctorCreds.length; d++) {
    const docCred = doctorCreds[d];
    let docToken;

    try {
      docToken = await login(docCred.email, docCred.password);
    } catch (e) {
      console.error(`  ✗ Doctor login failed (${docCred.email}): ${e.message}`);
      stats.errors++;
      continue;
    }

    const patientIds = [];
    for (let p = 0; p < PATIENTS_PER_DOCTOR; p++) {
      globalPatientIndex++;
      const patId = await registerPatient(docToken, p + 1, globalPatientIndex);
      if (patId) patientIds.push(patId);
      await sleep(250);
    }

    patientBatches.push({ docCred, docToken, patientIds });

    if ((d + 1) % 5 === 0) {
      console.log(`  Progress: ${d + 1}/${doctorCreds.length} doctors processed | ${stats.patients} patients registered`);
      await sleep(1000); // Breathe
    }
  }
  console.log(`  ✓ ${stats.patients} patients registered\n`);

  // ── STEP 4: Create visits (6 months of data) ─────────────
  const VISITS_PER_PATIENT = 6; // avg 6 visits over 180 days
  console.log(`📋 Creating ~${stats.patients * VISITS_PER_PATIENT} visits (6 months of history)...`);

  for (const batch of patientBatches) {
    let docToken = batch.docToken;

    // Refresh token if needed
    try {
      docToken = await login(batch.docCred.email, batch.docCred.password);
    } catch (e) { /* use existing */ }

    for (const patId of batch.patientIds) {
      // Distribute visits across 180 days
      const visitDays = [];
      for (let v = 0; v < VISITS_PER_PATIENT; v++) {
        visitDays.push(randInt(v * 30 + 1, (v + 1) * 30));
      }

      for (const day of visitDays) {
        await createVisit(docToken, patId, day);
        await sleep(100);
      }
    }

    if (stats.visits % 500 === 0 && stats.visits > 0) {
      console.log(`  Progress: ${stats.visits} visits | ${stats.medications} medications`);
    }
  }
  console.log(`  ✓ ${stats.visits} visits, ${stats.medications} medications created\n`);

  // ── STEP 5: Patient symptom logs ─────────────────────────
  const SYMPTOM_SAMPLE_SIZE = Math.min(200, globalPatientIndex - 1000);
  console.log(`🩺 Logging symptoms for ${SYMPTOM_SAMPLE_SIZE} sample patients...`);

  // Re-login as a sample of patients
  let sympIndex = 0;
  for (let pi = 1001; pi <= 1000 + SYMPTOM_SAMPLE_SIZE; pi++) {
    const email = `chn_pat_${pi}@rtooth.in`;
    try {
      const patToken = await login(email, 'PatientPassword123');
      await logSymptoms(patToken, null);
      sympIndex++;
      if (sympIndex % 25 === 0) {
        console.log(`  Progress: ${sympIndex}/${SYMPTOM_SAMPLE_SIZE} patients logged symptoms`);
      }
    } catch (e) {
      // Patient may not exist or login failed — skip
      stats.errors++;
    }
    await sleep(200);
  }
  console.log(`  ✓ ${stats.symptoms} symptom log entries created\n`);

  // ── Final Summary ─────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                  SEEDING COMPLETE                    ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Doctors registered:    ${String(stats.doctors).padEnd(27)}║`);
  console.log(`║  ✅ Patients registered:   ${String(stats.patients).padEnd(27)}║`);
  console.log(`║  ✅ Visits created:        ${String(stats.visits).padEnd(27)}║`);
  console.log(`║  ✅ Medications:           ${String(stats.medications).padEnd(27)}║`);
  console.log(`║  ✅ Symptom logs:          ${String(stats.symptoms).padEnd(27)}║`);
  console.log(`║  ⚠️  Errors skipped:        ${String(stats.errors).padEnd(27)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  console.log('\nPartial stats:', stats);
  process.exit(1);
});
