import * as notificationService from '../services/notificationService.js';
import { sendResponse } from '../utils/response.js';

/**
 * Manually trigger daily notifications job (IT-Admin only)
 */
export const triggerDailyNotifications = async (req, res, next) => {
  try {
    console.log(`[NOTIFICATIONS CONTROLLER] Admin user ${req.profile.email} manually triggered daily notifications.`);
    const summary = await notificationService.runDailyNotificationsJob();
    return sendResponse(res, 200, 'Daily notifications job executed successfully.', summary);
  } catch (error) {
    next(error);
  }
};
