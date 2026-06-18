import { supabase, supabaseAdmin } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/**
 * Helper function to retrieve and flatten profile details based on role.
 * Queries each table directly to avoid PostgREST relationship join bugs.
 */
async function getResolvedProfile(profileId) {
  const client = supabaseAdmin || supabase;

  // 1. Fetch base profile fields
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new Error('User profile not found. The user account may have been orphaned after a database reset. Please register a new account.');
  }

  // 2. Resolve Doctor specifics
  if (profile.role === 'doctor') {
    const { data: doctor } = await client
      .from('doctors')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    const docData = doctor || {};
    return {
      id: profile.id,
      doctor_code: docData.doctor_code,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      specialization: docData.specialization || 'General Dentistry',
      license_number: docData.license_number || 'N/A'
    };
  } 
  
  // 3. Resolve Patient specifics
  else if (profile.role === 'patient') {
    const { data: patient } = await client
      .from('patients')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    const { data: habits } = await client
      .from('lifestyle_habits')
      .select('*')
      .eq('patient_id', profileId)
      .maybeSingle();

    const { data: records } = await client
      .from('medical_records')
      .select('*')
      .eq('patient_id', profileId)
      .order('created_at', { ascending: false });

    const patData = patient || {};
    const habitsData = habits || {};
    const recordData = records && records.length > 0 ? records[0] : {};

    // Resolve registering doctor details
    let doctor = null;
    if (patData.doctor_id) {
      const { data: docProfile } = await client
        .from('profiles')
        .select('*')
        .eq('id', patData.doctor_id)
        .maybeSingle();

      if (docProfile) {
        const { data: docDetails } = await client
          .from('doctors')
          .select('*')
          .eq('id', patData.doctor_id)
          .maybeSingle();

        doctor = {
          first_name: docProfile.first_name,
          last_name: docProfile.last_name,
          specialization: docDetails?.specialization || 'Oncologist'
        };
      }
    }

    return {
      id: profile.id,
      patient_code: patData.patient_code,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      
      date_of_birth: patData.date_of_birth,
      gender: patData.gender,
      address: patData.address,
      doctor_id: patData.doctor_id,
      status: patData.status || 'active',
      doctor,

      tobacco_habit: habitsData.tobacco_habit,
      tobacco_frequency: habitsData.tobacco_frequency,
      tobacco_duration: habitsData.tobacco_duration,
      alcohol_habit: habitsData.alcohol_habit,
      alcohol_frequency: habitsData.alcohol_frequency,
      alcohol_duration: habitsData.alcohol_duration,
      betel_nut: habitsData.betel_nut,
      family_history: habitsData.family_history,
      
      cancer_stage: recordData.cancer_stage,
      lesion_location: recordData.lesion_location,
      risk_factors: recordData.risk_factors
    };
  }

  // IT-Admin
  const { data: admin } = await client
    .from('admins')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  const adminData = admin || {};
  return {
    id: profile.id,
    admin_code: adminData.admin_code,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role
  };
}

/**
 * Register a new IT-Admin in Supabase Auth and create a profile.
 * Public signup is restricted to IT-Admin accounts.
 */
export const signUpUser = async (email, password, role, profileData) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('User creation failed: No user ID returned.');
  }

  let dbClient = supabaseAdmin;
  
  if (!dbClient) {
    if (authData.session?.access_token) {
      dbClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
      });
    } else {
      dbClient = supabase;
    }
  }
  
  const profileFields = {
    id: userId,
    email,
    role: 'admin', // Enforce IT-Admin role for public registrations
    first_name: profileData.firstName,
    last_name: profileData.lastName,
    phone: profileData.phone || null,
  };

  const { data: profile, error: profileError } = await dbClient
    .from('profiles')
    .insert([profileFields])
    .select()
    .single();

  if (profileError) {
    if (supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    throw profileError;
  }

  // Create admin details (generates admin_code)
  const { error: adminError } = await dbClient
    .from('admins')
    .insert([{ id: userId }]);

  if (adminError) {
    await dbClient.from('profiles').delete().eq('id', userId);
    if (supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    throw adminError;
  }

  return {
    user: authData.user,
    session: authData.session,
    profile,
  };
};

/**
 * Register a doctor by an IT-Admin.
 * Uses admin privileges to create the auth user.
 */
export const registerDoctorByAdmin = async (email, password, doctorData) => {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client is not configured. Service Role key is required to register doctors.');
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: doctorData.firstName,
      last_name: doctorData.lastName,
      role: 'doctor',
    }
  });

  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('User creation failed: No user ID returned for Doctor.');
  }

  try {
    const profileFields = {
      id: userId,
      email,
      role: 'doctor',
      first_name: doctorData.firstName,
      last_name: doctorData.lastName,
      phone: doctorData.phone || null,
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([profileFields])
      .select()
      .single();

    if (profileError) throw profileError;

    const doctorFields = {
      id: userId,
      specialization: doctorData.specialization || 'General Dentistry',
      license_number: doctorData.licenseNumber || 'N/A',
    };

    const { error: docError } = await supabaseAdmin
      .from('doctors')
      .insert([doctorFields]);

    if (docError) throw docError;

    return {
      user: authData.user,
      profile: {
        ...profile,
        specialization: doctorFields.specialization,
        license_number: doctorFields.license_number
      },
    };
  } catch (error) {
    await supabaseAdmin.from('doctors').delete().eq('id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw error;
  }
};

/**
 * List all registered doctors in the clinic database.
 */
export const listDoctors = async () => {
  const client = supabaseAdmin || supabase;
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('*')
    .eq('role', 'doctor')
    .order('last_name', { ascending: true });

  if (profilesError) throw profilesError;

  const docIds = profiles.map(p => p.id);
  const { data: doctors, error: docError } = await client
    .from('doctors')
    .select('*')
    .in('id', docIds);

  if (docError) throw docError;

  const docMap = new Map((doctors || []).map(d => [d.id, d]));

  // 1. Fetch patient counts per doctor
  const { data: patients, error: patientError } = await client
    .from('patients')
    .select('id, doctor_id');
  
  if (patientError) throw patientError;
  
  const patientCountMap = new Map();
  (patients || []).forEach(p => {
    if (p.doctor_id) {
      patientCountMap.set(p.doctor_id, (patientCountMap.get(p.doctor_id) || 0) + 1);
    }
  });

  // 2. Fetch precise file sizes per doctor
  const { data: reports, error: reportsError } = await client
    .from('patient_reports')
    .select('patient_id, doctor_id, file_url');
  
  if (reportsError) throw reportsError;
  
  const doctorSizeMap = new Map(); // doctor_id -> size in bytes
  
  if (reports && reports.length > 0) {
    // Collect all unique patient folders
    const patientFilesMap = new Map();
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      if (!patientFilesMap.has(pid)) {
        patientFilesMap.set(pid, new Set());
      }
      patientFilesMap.get(pid).add(fileName);
    });

    const patientIds = Array.from(patientFilesMap.keys());
    const listPromises = patientIds.map(pid => 
      supabaseAdmin.storage.from('patient-reports').list(pid)
    );
    
    const listResults = await Promise.all(listPromises);
    
    // Map filename to size for each patient
    const fileSizeMap = new Map(); // "patient_id/filename" -> size
    patientIds.forEach((pid, index) => {
      const res = listResults[index];
      const allowedNames = patientFilesMap.get(pid);
      if (res.data) {
        res.data.forEach(file => {
          if (allowedNames.has(file.name) && file.metadata && file.metadata.size) {
            fileSizeMap.set(`${pid}/${file.name}`, file.metadata.size);
          }
        });
      }
    });

    // Sum sizes per doctor
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];
      
      const size = fileSizeMap.get(`${pid}/${fileName}`) || 0;
      if (r.doctor_id) {
        doctorSizeMap.set(r.doctor_id, (doctorSizeMap.get(r.doctor_id) || 0) + size);
      }
    });
  }

  return profiles.map(p => {
    const docData = docMap.get(p.id) || {};
    return {
      id: p.id,
      doctor_code: docData.doctor_code,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      specialization: docData.specialization || 'General Dentistry',
      license_number: docData.license_number || 'N/A',
      patient_count: patientCountMap.get(p.id) || 0,
      total_file_size_bytes: doctorSizeMap.get(p.id) || 0
    };
  });
};

/**
 * Sign in user and retrieve their session + profile details.
 */
export const signInUser = async (email, password) => {
  const client = supabaseAdmin || supabase;
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;

  const profile = await getResolvedProfile(authData.user.id);

  if (profile.role === 'patient' && profile.status === 'draft') {
    throw new Error('Your portal registration is currently pending completion (Draft status).');
  }

  return {
    session: authData.session,
    user: authData.user,
    profile,
  };
};

/**
 * Sign out user by invalidating the refresh token on Supabase.
 */
export const signOutUser = async (token) => {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { error } = await client.auth.signOut();
  if (error) throw error;
  return true;
};

/**
 * Get user and profile details from an access token.
 */
export const getCurrentUserProfile = async (token) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw authError || new Error('Invalid or expired authentication session.');
  }

  const profile = await getResolvedProfile(user.id);

  return {
    user,
    profile,
  };
};

/**
 * Register a patient by an authorized doctor.
 * Uses admin privileges to create the auth user.
 */
export const registerPatientByDoctor = async (email, password, profileData) => {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client is not configured. Service Role key is required to register patients.');
  }

  // 1. Create user in Supabase Auth via admin client
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: profileData.firstName,
      last_name: profileData.lastName,
      role: 'patient',
    }
  });

  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('User creation failed: No user ID returned from Supabase Auth.');
  }

  try {
    // 2. Insert base fields into profiles
    const profileFields = {
      id: userId,
      email,
      role: 'patient',
      first_name: profileData.firstName,
      last_name: profileData.lastName,
      phone: profileData.phone || null,
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([profileFields])
      .select()
      .single();

    if (profileError) throw profileError;

    // 3. Insert into patients
    const patientFields = {
      id: userId,
      date_of_birth: profileData.dateOfBirth || null,
      gender: profileData.gender || 'Not Specified',
      address: profileData.address || null,
      doctor_id: profileData.doctor_id || null,
      status: profileData.status || 'active',
    };

    const { error: patientError } = await supabaseAdmin
      .from('patients')
      .insert([patientFields]);

    if (patientError) throw patientError;

    // 4. Insert into lifestyle habits
    const habitsFields = {
      patient_id: userId,
      tobacco_habit: profileData.tobaccoHabit || 'none',
      tobacco_frequency: profileData.tobaccoFrequency || null,
      tobacco_duration: profileData.tobaccoDuration || null,
      alcohol_habit: profileData.alcoholHabit || 'none',
      alcohol_frequency: profileData.alcoholFrequency || null,
      alcohol_duration: profileData.alcoholDuration || null,
      betel_nut: profileData.betelNut || 'no',
      family_history: profileData.familyHistory || 'no',
    };

    const { error: habitsError } = await supabaseAdmin
      .from('lifestyle_habits')
      .insert([habitsFields]);

    if (habitsError) throw habitsError;

    // 5. Insert into medical records
    const recordsFields = {
      patient_id: userId,
      cancer_stage: profileData.cancerStage || 'Suspicious Lesion',
      lesion_location: profileData.lesionLocation || 'Not Specified',
      risk_factors: profileData.riskFactors || null,
    };

    const { error: recordsError } = await supabaseAdmin
      .from('medical_records')
      .insert([recordsFields]);

    if (recordsError) throw recordsError;

    return {
      user: authData.user,
      profile: {
        ...profile,
        ...patientFields,
        ...habitsFields,
        ...recordsFields
      },
    };
  } catch (error) {
    await supabaseAdmin.from('medical_records').delete().eq('patient_id', userId);
    await supabaseAdmin.from('lifestyle_habits').delete().eq('patient_id', userId);
    await supabaseAdmin.from('patients').delete().eq('id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw error;
  }
};

/**
 * List all registered patients in the clinic database.
 * Uses direct queries to prevent PostgREST relationship ambiguity bugs.
 */
export const listPatients = async (doctorId) => {
  const client = supabaseAdmin || supabase;

  // 1. Fetch patient profile records
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('*')
    .eq('role', 'patient')
    .order('last_name', { ascending: true });

  if (profilesError) throw profilesError;

  // 2. Fetch patients details
  let patientsQuery = client.from('patients').select('*');
  if (doctorId) {
    patientsQuery = patientsQuery.eq('doctor_id', doctorId);
  }
  const { data: patients, error: patientsError } = await patientsQuery;
  if (patientsError) throw patientsError;

  const patientMap = new Map((patients || []).map(p => [p.id, p]));

  // Filter profiles to match active/draft patients registered by this doctor
  const filteredProfiles = doctorId 
    ? profiles.filter(p => patientMap.has(p.id))
    : profiles;

  if (filteredProfiles.length === 0) return [];

  const patientIds = filteredProfiles.map(p => p.id);

  // 3. Fetch habits
  const { data: habits, error: habitsError } = await client
    .from('lifestyle_habits')
    .select('*')
    .in('patient_id', patientIds);
  if (habitsError) throw habitsError;

  const habitsMap = new Map((habits || []).map(h => [h.patient_id, h]));

  // 4. Fetch medical records
  const { data: records, error: recordsError } = await client
    .from('medical_records')
    .select('*')
    .in('patient_id', patientIds);
  if (recordsError) throw recordsError;

  const recordsMap = new Map();
  (records || []).forEach(r => {
    if (!recordsMap.has(r.patient_id)) {
      recordsMap.set(r.patient_id, []);
    }
    recordsMap.get(r.patient_id).push(r);
  });
  recordsMap.forEach((list) => {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  return filteredProfiles.map(p => {
    const patientData = patientMap.get(p.id) || {};
    const habitsData = habitsMap.get(p.id) || {};
    const patientRecords = recordsMap.get(p.id) || [];
    const latestRecord = patientRecords[0] || {};

    return {
      id: p.id,
      patient_code: patientData.patient_code,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      date_of_birth: patientData.date_of_birth,
      gender: patientData.gender,
      address: patientData.address,
      doctor_id: patientData.doctor_id,
      status: patientData.status || 'active',
      
      tobacco_habit: habitsData.tobacco_habit,
      tobacco_frequency: habitsData.tobacco_frequency,
      tobacco_duration: habitsData.tobacco_duration,
      alcohol_habit: habitsData.alcohol_habit,
      alcohol_frequency: habitsData.alcohol_frequency,
      alcohol_duration: habitsData.alcohol_duration,
      betel_nut: habitsData.betel_nut,
      family_history: habitsData.family_history,
      
      cancer_stage: latestRecord.cancer_stage,
      lesion_location: latestRecord.lesion_location,
      risk_factors: latestRecord.risk_factors
    };
  });
};

/**
 * Retrieves detailed doctor profile data, patient counts, checkups logged, and storage file sizes.
 * @param {string} doctorId - Doctor's UUID
 */
export const getDoctorProfileWithStats = async (doctorId) => {
  const client = supabaseAdmin || supabase;

  // 1. Fetch base profile fields
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', doctorId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== 'doctor') {
    throw new Error('Doctor profile not found.');
  }

  // 2. Fetch doctor specific details
  const { data: doctor, error: docError } = await client
    .from('doctors')
    .select('*')
    .eq('id', doctorId)
    .maybeSingle();

  if (docError) throw docError;

  // 3. Fetch patients assigned to this doctor
  const { data: patients, error: patientError } = await client
    .from('patients')
    .select('*')
    .eq('doctor_id', doctorId);

  if (patientError) throw patientError;

  const patientIds = (patients || []).map(p => p.id);
  let patientProfiles = [];
  const recordsMap = new Map();

  if (patientIds.length > 0) {
    const { data: profiles } = await client
      .from('profiles')
      .select('*')
      .in('id', patientIds);
    patientProfiles = profiles || [];

    const { data: records } = await client
      .from('medical_records')
      .select('*')
      .in('patient_id', patientIds);

    (records || []).forEach(r => {
      if (!recordsMap.has(r.patient_id)) {
        recordsMap.set(r.patient_id, r);
      }
    });
  }

  // 4. Fetch count of checkups (visits) logged by this doctor
  const { count: checkupCount, error: checkupError } = await client
    .from('checkups')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctorId);

  if (checkupError) throw checkupError;

  // 5. Fetch uploaded reports and resolve sizes
  const { data: reports, error: reportsError } = await client
    .from('patient_reports')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('uploaded_at', { ascending: false });

  if (reportsError) throw reportsError;

  let totalSize = 0;
  let reportsWithSizes = [];

  if (reports && reports.length > 0) {
    const patientFilesMap = new Map();
    reports.forEach(r => {
      const parts = r.file_url.split('/patient-reports/');
      if (parts.length < 2) return;
      const pathAndName = parts[1];
      const pathParts = pathAndName.split('/');
      if (pathParts.length < 2) return;
      const pid = pathParts[0];
      const fileName = pathParts[1];

      if (!patientFilesMap.has(pid)) {
        patientFilesMap.set(pid, new Set());
      }
      patientFilesMap.get(pid).add(fileName);
    });

    const patientIdsWithFiles = Array.from(patientFilesMap.keys());
    const listPromises = patientIdsWithFiles.map(pid =>
      supabaseAdmin.storage.from('patient-reports').list(pid)
    );
    const listResults = await Promise.all(listPromises);

    const fileSizeMap = new Map();
    patientIdsWithFiles.forEach((pid, index) => {
      const res = listResults[index];
      if (res.data) {
        const allowedNames = patientFilesMap.get(pid);
        res.data.forEach(file => {
          if (allowedNames.has(file.name) && file.metadata && file.metadata.size) {
            fileSizeMap.set(`${pid}/${file.name}`, file.metadata.size);
          }
        });
      }
    });

    reportsWithSizes = reports.map(r => {
      const parts = r.file_url.split('/patient-reports/');
      let size = 0;
      if (parts.length >= 2) {
        const pathAndName = parts[1];
        const pathParts = pathAndName.split('/');
        if (pathParts.length >= 2) {
          size = fileSizeMap.get(`${pathParts[0]}/${pathParts[1]}`) || 0;
        }
      }
      totalSize += size;
      
      // Also resolve patient name for reports table
      const pat = patientProfiles.find(p => p.id === r.patient_id) || {};
      const patientName = pat.first_name ? `${pat.first_name} ${pat.last_name}` : 'Unknown Patient';

      return {
        ...r,
        file_size_bytes: size,
        patient_name: patientName
      };
    });
  }

  return {
    profile: {
      id: profile.id,
      doctor_code: doctor?.doctor_code,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      specialization: doctor?.specialization || 'General Dentistry',
      license_number: doctor?.license_number || 'N/A'
    },
    stats: {
      patient_count: patients?.length || 0,
      total_file_size_bytes: totalSize,
      checkup_count: checkupCount || 0
    },
    patients: (patients || []).map(p => {
      const patProfile = patientProfiles.find(prof => prof.id === p.id) || {};
      const record = recordsMap.get(p.id) || {};
      return {
        id: p.id,
        patient_code: p.patient_code,
        first_name: patProfile.first_name || '',
        last_name: patProfile.last_name || '',
        email: patProfile.email || '',
        phone: patProfile.phone || '',
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        status: p.status,
        cancer_stage: record.cancer_stage || 'N/A'
      };
    }),
    reports: reportsWithSizes
  };
};

