const cron = require('node-cron');
const User = require('../models/User');
const { sendExpiryReminderEmail } = require('../services/emailService');

const runRenewalChecks = async () => {
  console.log('[Cron Job] Starting daily subscription renewal checks...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Expiry date helper ranges
    const threeDaysLaterStart = new Date(today);
    threeDaysLaterStart.setDate(threeDaysLaterStart.getDate() + 3);
    const threeDaysLaterEnd = new Date(threeDaysLaterStart);
    threeDaysLaterEnd.setHours(23, 59, 59, 999);

    const oneDayLaterStart = new Date(today);
    oneDayLaterStart.setDate(oneDayLaterStart.getDate() + 1);
    const oneDayLaterEnd = new Date(oneDayLaterStart);
    oneDayLaterEnd.setHours(23, 59, 59, 999);

    // 1. Check users expiring in 3 days
    const users3Days = await User.find({
      'subscription.status': 'active',
      'subscription.expiresAt': { $gte: threeDaysLaterStart, $lte: threeDaysLaterEnd }
    });

    console.log(`[Cron Job] Found ${users3Days.length} users expiring in 3 days.`);
    for (const user of users3Days) {
      await sendExpiryReminderEmail(
        user.email,
        user.subscription.plan,
        3,
        user.firstName
      );
    }

    // 2. Check users expiring in 1 day
    const users1Day = await User.find({
      'subscription.status': 'active',
      'subscription.expiresAt': { $gte: oneDayLaterStart, $lte: oneDayLaterEnd }
    });

    console.log(`[Cron Job] Found ${users1Day.length} users expiring in 1 day.`);
    for (const user of users1Day) {
      await sendExpiryReminderEmail(
        user.email,
        user.subscription.plan,
        1,
        user.firstName
      );
    }

    console.log('[Cron Job] Daily subscription renewal checks completed.');
  } catch (err) {
    console.error('[Cron Job] Error in renewal checks:', err.message);
  }
};

const initCronJobs = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    runRenewalChecks();
  });
  
  console.log('[Cron System] Scheduler initialized (running daily at 8:00 AM).');
};

module.exports = { initCronJobs, runRenewalChecks };
