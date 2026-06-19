import { supabaseAdmin } from '../config/supabase.js';
import * as emailService from './emailService.js';

/**
 * Execute the daily notifications and digests check
 */
export const runDailyNotificationsJob = async () => {
  console.log('[DAILY NOTIFICATIONS] Starting execution of notifications job...');
  const summary = {
    remindersSent: 0,
    digestsSent: 0,
    errors: []
  };

  if (!supabaseAdmin) {
    const errMsg = 'Supabase Admin client is not configured; cannot bypass RLS for system notification queries.';
    console.error(`[DAILY NOTIFICATIONS ERROR] ${errMsg}`);
    summary.errors.push(errMsg);
    return summary;
  }

  // ────────────────────────────────────────────────────────────────────────
  // PART 1: Patient Appointment / Follow-up Reminders
  // ────────────────────────────────────────────────────────────────────────
  try {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    console.log(`[DAILY NOTIFICATIONS] Fetching checkups scheduled between ${tomorrowStart.toISOString()} and ${tomorrowEnd.toISOString()}`);

    const { data: checkups, error: checkupsError } = await supabaseAdmin
      .from('checkups')
      .select('id, patient_id, doctor_id, next_checkup_date, followup_notes')
      .gte('next_checkup_date', tomorrowStart.toISOString())
      .lte('next_checkup_date', tomorrowEnd.toISOString());

    if (checkupsError) throw checkupsError;

    if (checkups && checkups.length > 0) {
      console.log(`[DAILY NOTIFICATIONS] Found ${checkups.length} checkups for tomorrow. Resolving recipient details...`);
      
      const patientIds = [...new Set(checkups.map(c => c.patient_id))];
      const doctorIds = [...new Set(checkups.map(c => c.doctor_id).filter(Boolean))];

      const { data: patientProfiles, error: pError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', patientIds);

      if (pError) throw pError;

      const { data: doctorProfiles, error: dError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', doctorIds);

      if (dError) throw dError;

      const patientMap = new Map(patientProfiles.map(p => [p.id, p]));
      const doctorMap = new Map(doctorProfiles.map(d => [d.id, d]));

      for (const checkup of checkups) {
        const patient = patientMap.get(checkup.patient_id);
        const doctor = checkup.doctor_id ? doctorMap.get(checkup.doctor_id) : null;

        if (patient && patient.email) {
          const patientName = `${patient.first_name} ${patient.last_name}`;
          const doctorName = doctor ? `${doctor.first_name} ${doctor.last_name}` : 'RTooth Practitioner';

          try {
            await emailService.sendUpcomingAppointmentReminderEmail({
              patientEmail: patient.email,
              patientName,
              doctorName,
              nextCheckupDate: checkup.next_checkup_date,
              notes: checkup.followup_notes
            });
            summary.remindersSent++;
          } catch (mailErr) {
            console.error(`[DAILY NOTIFICATIONS] Failed to send reminder email to ${patient.email}:`, mailErr.message);
            summary.errors.push(`Patient Reminder to ${patient.email}: ${mailErr.message}`);
          }
        }
      }
    } else {
      console.log('[DAILY NOTIFICATIONS] No checkups scheduled for tomorrow.');
    }
  } catch (err) {
    console.error('[DAILY NOTIFICATIONS ERROR] Patient reminder pipeline failed:', err.message);
    summary.errors.push(`Checkup reminders failure: ${err.message}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  // PART 2: Doctor Severe Symptoms Digests
  // ────────────────────────────────────────────────────────────────────────
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`[DAILY NOTIFICATIONS] Fetching symptom logs logged since ${oneDayAgo.toISOString()}`);

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('symptom_logs')
      .select('patient_id, pain_scale, burning_sensation, difficulty_opening_mouth, ulcer_duration, bleeding, logged_at')
      .gte('logged_at', oneDayAgo.toISOString());

    if (logsError) throw logsError;

    // Filter for severe symptom logs
    const severeLogs = (logs || []).filter(log => {
      const isPainSevere = log.pain_scale >= 7;
      const isBurningSevere = log.burning_sensation === 'Severe';
      const isOpeningSevere = log.difficulty_opening_mouth === 'Severe';
      const isBleeding = log.bleeding === true || log.bleeding === 'true';
      return isPainSevere || isBurningSevere || isOpeningSevere || isBleeding;
    });

    if (severeLogs.length > 0) {
      console.log(`[DAILY NOTIFICATIONS] Found ${severeLogs.length} severe symptom logs. Grouping by doctor...`);

      const patientIds = [...new Set(severeLogs.map(log => log.patient_id))];

      // Fetch patient profiles and patient assignments
      const { data: patients, error: patsError } = await supabaseAdmin
        .from('patients')
        .select('id, doctor_id, patient_code')
        .in('id', patientIds);

      if (patsError) throw patsError;

      const { data: patientProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', patientIds);

      if (profilesError) throw profilesError;

      const patientInfoMap = new Map(patients.map(p => [p.id, p]));
      const profileNameMap = new Map(patientProfiles.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

      // Group logs by Doctor ID
      const doctorGroupMap = new Map(); // doctorId -> Array of logs

      for (const log of severeLogs) {
        const patInfo = patientInfoMap.get(log.patient_id);
        const name = profileNameMap.get(log.patient_id) || 'Unknown Patient';

        if (patInfo && patInfo.doctor_id) {
          const docId = patInfo.doctor_id;
          const enhancedLog = {
            ...log,
            patient_name: name,
            patient_code: patInfo.patient_code
          };

          if (!doctorGroupMap.has(docId)) {
            doctorGroupMap.set(docId, []);
          }
          doctorGroupMap.get(docId).push(enhancedLog);
        }
      }

      // Loop through each doctor groups and send digests
      for (const [doctorId, docLogs] of doctorGroupMap.entries()) {
        try {
          const { data: doctorProfile, error: docProfileError } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', doctorId)
            .single();

          if (docProfileError) throw docProfileError;

          if (doctorProfile && doctorProfile.email) {
            const doctorName = `${doctorProfile.first_name} ${doctorProfile.last_name}`;

            await emailService.sendSevereSymptomsDigestEmail({
              doctorEmail: doctorProfile.email,
              doctorName,
              severeLogs: docLogs
            });
            summary.digestsSent++;
          }
        } catch (docErr) {
          console.error(`[DAILY NOTIFICATIONS] Failed to send digest for Doctor ID ${doctorId}:`, docErr.message);
          summary.errors.push(`Doctor Digest for ${doctorId}: ${docErr.message}`);
        }
      }
    } else {
      console.log('[DAILY NOTIFICATIONS] No severe symptom logs registered in the last 24 hours.');
    }
  } catch (err) {
    console.error('[DAILY NOTIFICATIONS ERROR] Doctor digest pipeline failed:', err.message);
    summary.errors.push(`Doctor digests failure: ${err.message}`);
  }

  console.log(`[DAILY NOTIFICATIONS] Execution finished. Summary: Sent ${summary.remindersSent} patient reminders, ${summary.digestsSent} doctor digests.`);
  return summary;
};

/**
 * Initialize background scheduler to run notifications job once every 24 hours at a specific local time
 */
export const initDailyNotificationsScheduler = () => {
  const targetHour = 9; // 9:00 AM
  const targetMinute = 0;

  const scheduleNextRun = () => {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(targetHour, targetMinute, 0, 0);

    // If target hour is already passed today, schedule for tomorrow
    if (now >= nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();
    const minutesToWait = Math.round(delay / 1000 / 60);
    console.log(`[DAILY SCHEDULER] Scheduled next run in ${minutesToWait} minutes (at ${nextRun.toLocaleString()}).`);

    setTimeout(async () => {
      try {
        await runDailyNotificationsJob();
      } catch (err) {
        console.error('[DAILY SCHEDULER ERROR] Background notifications job failed:', err.message);
      } finally {
        scheduleNextRun(); // Recursively schedule for the next day
      }
    }, delay);
  };

  scheduleNextRun();
};
