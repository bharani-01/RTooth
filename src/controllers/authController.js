import * as authService from '../services/authService.js';
import { sendResponse } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';

/**
 * Handle user registration (IT-Admin only)
 */
export const register = async (req, res, next) => {
  try {
    const { 
      email, 
      password, 
      role, 
      firstName, 
      lastName, 
      phone 
    } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
      throw new BadRequestError('Missing required fields: email, password, role, firstName, and lastName are mandatory.');
    }

    if (role !== 'admin') {
      throw new BadRequestError("Invalid role. Public registration is restricted to 'admin' (IT-Admin) accounts.");
    }

    const profileData = {
      firstName,
      lastName,
      phone,
    };

    const result = await authService.signUpUser(email, password, 'admin', profileData);

    return sendResponse(res, 201, 'IT-Admin registered successfully.', {
      user: result.user,
      profile: result.profile,
      session: result.session,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required.');
    }

    const result = await authService.signInUser(email, password);

    return sendResponse(res, 200, 'Login successful.', {
      session: result.session,
      profile: result.profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user logout
 */
export const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new BadRequestError('No authorization header provided.');
    }

    const token = authHeader.split(' ')[1];
    await authService.signOutUser(token);

    return sendResponse(res, 200, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * Get the current user profile (guarded by requireAuth middleware)
 */
export const getMe = async (req, res, next) => {
  try {
    return sendResponse(res, 200, 'User profile fetched successfully.', { profile: req.profile });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a patient under the logged-in doctor session
 */
export const registerPatient = async (req, res, next) => {
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

    if (!email || !password || !firstName || !lastName) {
      throw new BadRequestError('Missing required patient fields: email, password, firstName, and lastName are mandatory.');
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
      doctor_id: req.profile.id, // Map patient to registering doctor
      status: status || 'active',
    };

    const result = await authService.registerPatientByDoctor(email, password, patientData);

    return sendResponse(res, 201, 'Patient registered successfully in RTooth Oncology Registry.', {
      user: result.user,
      profile: result.profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a doctor (IT-Admin only)
 */
export const registerDoctor = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, specialization, licenseNumber } = req.body;

    if (!email || !password || !firstName || !lastName || !specialization || !licenseNumber) {
      throw new BadRequestError('Missing required fields: email, password, firstName, lastName, specialization, and licenseNumber are mandatory.');
    }

    const doctorData = {
      firstName,
      lastName,
      phone,
      specialization,
      licenseNumber
    };

    const result = await authService.registerDoctorByAdmin(email, password, doctorData);

    return sendResponse(res, 201, 'Doctor registered successfully in the system.', {
      user: result.user,
      profile: result.profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all registered doctors (IT-Admin only)
 */
export const getDoctors = async (req, res, next) => {
  try {
    const doctors = await authService.listDoctors();
    return sendResponse(res, 200, 'Doctors directory retrieved successfully.', { doctors });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all registered patients (Doctor/Admin only)
 */
export const getPatients = async (req, res, next) => {
  try {
    // Only fetch patients registered by the logged-in doctor (or all if admin)
    const isDoc = req.profile.role === 'doctor';
    const patients = await authService.listPatients(isDoc ? req.profile.id : null);
    return sendResponse(res, 200, 'Patients directory retrieved successfully.', { patients });
  } catch (error) {
    next(error);
  }
};

