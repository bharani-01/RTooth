import * as authService from '../services/authService.js';

/**
 * Handle user registration
 */
export const register = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      role, 
      firstName, 
      lastName, 
      phone,
      // Doctor specific
      specialization,
      licenseNumber,
      // Patient specific
      dateOfBirth,
      gender,
      // Oral Oncology specific
      cancerStage,
      lesionLocation,
      riskFactors
    } = req.body;

    // Basic Input Validations
    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, role, firstName, and lastName are mandatory.',
      });
    }

    if (role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Public registration is restricted to 'admin' (IT-Admin) accounts.",
      });
    }

    const profileData = {
      firstName,
      lastName,
      phone,
    };

    // Execute service layer signup (forces role = 'admin' for IT-Admins)
    const result = await authService.signUpUser(email, password, 'admin', profileData);

    return res.status(201).json({
      success: true,
      message: 'IT-Admin registered successfully.',
      data: {
        user: result.user,
        profile: result.profile,
        session: result.session,
      },
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'An error occurred during registration.',
    });
  }
};

/**
 * Handle user login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Execute service layer login
    const result = await authService.signInUser(email, password);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        session: result.session,
        profile: result.profile,
      },
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Invalid credentials.',
    });
  }
};

/**
 * Handle user logout
 */
export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(400).json({
        success: false,
        message: 'No authorization header provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    await authService.signOutUser(token);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('Logout Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred during logout.',
    });
  }
};

/**
 * Get the current user profile (guarded by requireAuth middleware)
 */
export const getMe = async (req, res) => {
  try {
    // req.profile is populated by requireAuth middleware
    return res.status(200).json({
      success: true,
      data: {
        profile: req.profile,
      },
    });
  } catch (error) {
    console.error('Get Me Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred fetching user details.',
    });
  }
};

/**
 * Register a patient under the logged-in doctor session
 */
export const registerPatient = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      cancerStage,
      lesionLocation,
      riskFactors,
      address,
      tobaccoHabit,
      tobaccoFrequency,
      tobaccoDuration,
      alcoholHabit,
      alcoholFrequency,
      alcoholDuration,
      betelNut,
      familyHistory,
      status,
    } = req.body;

    // Validate patient base details
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required patient fields: email, password, firstName, and lastName are mandatory.',
      });
    }

    const patientData = {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      cancerStage,
      lesionLocation,
      riskFactors,
      address,
      tobaccoHabit,
      tobaccoFrequency,
      tobaccoDuration,
      alcoholHabit,
      alcoholFrequency,
      alcoholDuration,
      betelNut,
      familyHistory,
      doctor_id: req.profile.id, // Map the patient to the registering doctor
      status: status || 'active',
    };

    // Execute service layer patient registration
    const result = await authService.registerPatientByDoctor(email, password, patientData);

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully in RTooth Oncology Registry.',
      data: {
        user: result.user,
        profile: result.profile,
      },
    });
  } catch (error) {
    console.error('Doctor Register Patient Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'An error occurred during patient registration.',
    });
  }
};

/**
 * Register a doctor (IT-Admin only)
 */
export const registerDoctor = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, specialization, licenseNumber } = req.body;

    if (!email || !password || !firstName || !lastName || !specialization || !licenseNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, specialization, and licenseNumber are mandatory.',
      });
    }

    const doctorData = {
      firstName,
      lastName,
      phone,
      specialization,
      licenseNumber
    };

    const result = await authService.registerDoctorByAdmin(email, password, doctorData);

    return res.status(201).json({
      success: true,
      message: 'Doctor registered successfully in the system.',
      data: {
        user: result.user,
        profile: result.profile
      }
    });
  } catch (error) {
    console.error('Admin Register Doctor Error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'An error occurred during doctor registration.'
    });
  }
};

/**
 * Get all registered doctors (IT-Admin only)
 */
export const getDoctors = async (req, res) => {
  try {
    const doctors = await authService.listDoctors();
    return res.status(200).json({
      success: true,
      data: {
        doctors
      }
    });
  } catch (error) {
    console.error('Get Doctors Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred fetching doctors.'
    });
  }
};

/**
 * Get all registered patients (Doctor only)
 */
export const getPatients = async (req, res) => {
  try {
    // Only fetch patients registered by the logged-in doctor
    const patients = await authService.listPatients(req.profile.id);
    return res.status(200).json({
      success: true,
      data: {
        patients
      }
    });
  } catch (error) {
    console.error('Get Patients Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred fetching patients.'
    });
  }
};

