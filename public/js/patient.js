import { getUserProfile, logoutUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Bind Logout Button
  const logoutBtn = document.getElementById('patient-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to end your patient portal session?')) {
        await logoutUser();
      }
    });
  }

  // Pre-load from localStorage if available
  const initialProfile = getUserProfile();
  if (initialProfile && initialProfile.role === 'patient') {
    populatePatientDetails(initialProfile);
  }

  // Listen for official auth-verified event from auth.js guard
  document.addEventListener('auth-verified', (event) => {
    const profile = event.detail;
    if (profile && profile.role === 'patient') {
      populatePatientDetails(profile);
    }
  });

  if (window.initMobileMenu) {
    window.initMobileMenu();
  }
});

/**
 * Populate UI with Patient's profile fields
 */
function populatePatientDetails(profile) {
  const fullName = `${profile.first_name} ${profile.last_name}`;
  
  // Set headers & badges
  const nameBadge = document.getElementById('patient-name-badge');
  const avatar = document.getElementById('patient-avatar');
  const welcomeTitle = document.getElementById('patient-welcome-title');

  if (nameBadge) nameBadge.innerText = fullName;
  if (avatar) avatar.innerText = `${profile.first_name[0].toUpperCase()}${profile.last_name[0].toUpperCase()}`;
  if (welcomeTitle) welcomeTitle.innerText = `Welcome, ${profile.first_name}`;

  // Set Profile section fields
  const pName = document.getElementById('pat-full-name');
  const pEmail = document.getElementById('pat-email');
  const pPhone = document.getElementById('pat-phone');
  const pDob = document.getElementById('pat-dob');
  const pGender = document.getElementById('pat-gender');
  
  const pStage = document.getElementById('pat-cancer-stage');
  const statStage = document.getElementById('stat-cancer-stage');
  const pLocation = document.getElementById('pat-lesion-location');
  const statLocation = document.getElementById('stat-lesion-location');
  const pRisks = document.getElementById('pat-risk-factors');

  if (pName) pName.innerText = fullName;
  if (pEmail) pEmail.innerText = profile.email || 'N/A';
  if (pPhone) pPhone.innerText = profile.phone || 'Not Provided';
  
  // Format Date of Birth for presentation
  if (pDob) {
    if (profile.date_of_birth) {
      const dobDate = new Date(profile.date_of_birth);
      pDob.innerText = dobDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      pDob.innerText = 'Not Provided';
    }
  }

  if (pGender) pGender.innerText = profile.gender || 'Not Specified';
  
  // Set oncology details
  if (pStage) pStage.innerText = profile.cancer_stage || 'Suspicious Lesion';
  if (statStage) statStage.innerText = profile.cancer_stage || 'Suspicious Lesion';
  if (pLocation) pLocation.innerText = profile.lesion_location || 'Not Specified';
  if (statLocation) statLocation.innerText = profile.lesion_location || 'Under Watch';
  if (pRisks) pRisks.innerText = profile.risk_factors || 'None';

  // Set Attending Doctor details
  const attendingDocName = document.getElementById('attending-doctor-name');
  const attendingDocSpec = document.getElementById('attending-doctor-spec');

  if (profile.doctor) {
    if (attendingDocName) attendingDocName.innerText = `Dr. ${profile.doctor.first_name} ${profile.doctor.last_name}`;
    if (attendingDocSpec) attendingDocSpec.innerText = profile.doctor.specialization || 'Oral Oncology Specialist';
  } else {
    if (attendingDocName) attendingDocName.innerText = 'No Doctor Assigned';
    if (attendingDocSpec) attendingDocSpec.innerText = 'General Oncology Care';
  }

  // Set Lifestyle Habits details
  const pTobaccoHabit = document.getElementById('pat-tobacco-habit');
  const pTobaccoFreq = document.getElementById('pat-tobacco-freq');
  const pTobaccoDur = document.getElementById('pat-tobacco-dur');
  const pAlcoholHabit = document.getElementById('pat-alcohol-habit');
  const pAlcoholFreq = document.getElementById('pat-alcohol-freq');
  const pAlcoholDur = document.getElementById('pat-alcohol-dur');
  const pBetelNut = document.getElementById('pat-betel-nut');
  const pFamilyHist = document.getElementById('pat-family-history');

  if (pTobaccoHabit) pTobaccoHabit.innerText = profile.tobacco_habit || 'None';
  if (pTobaccoFreq) pTobaccoFreq.innerText = profile.tobacco_frequency || 'N/A';
  if (pTobaccoDur) pTobaccoDur.innerText = profile.tobacco_duration || 'N/A';
  if (pAlcoholHabit) pAlcoholHabit.innerText = profile.alcohol_habit || 'None';
  if (pAlcoholFreq) pAlcoholFreq.innerText = profile.alcohol_frequency || 'N/A';
  if (pAlcoholDur) pAlcoholDur.innerText = profile.alcohol_duration || 'N/A';
  if (pBetelNut) pBetelNut.innerText = profile.betel_nut || 'No';
  if (pFamilyHist) pFamilyHist.innerText = profile.family_history || 'No';
}
