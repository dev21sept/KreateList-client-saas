/**
 * Scheduled live check for Master statuses, by platform listing ID.
 *
 * - One cycle at a time (lock). Users are handled one after another with a pause between them,
 *   so the API and the small server are not hit all at once.
 * - Each user's sync has its own safety guard (masterStatusSync: no write if too many statuses would flip).
 * - Off when MASTER_STATUS_SYNC_DISABLED=true.
 */

const User = require('../models/User');
const { syncMasterStatuses } = require('./masterStatusSync');

const USER_PAUSE_MS = Number(process.env.MASTER_STATUS_USER_PAUSE_MS || 20000);
let running = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runMasterStatusCycle() {
  if (running) return { skipped: 'previous cycle still running' };
  running = true;
  const started = Date.now();
  const report = [];
  try {
    const users = await User.find({
      $or: [{ 'ebayAccount.connected': true }, { 'poshmarkAccount.connected': true }, { 'etsyAccount.connected': true }],
    }).select('_id').lean();

    for (const u of users) {
      try {
        const r = await syncMasterStatuses(u._id, { apply: true });
        report.push({ user: String(u._id).slice(-6), checked: r.checked, changed: r.changed, skippedUnsafe: r.skippedUnsafe });
      } catch (e) {
        report.push({ user: String(u._id).slice(-6), error: e.message });
      }
      await sleep(USER_PAUSE_MS);
    }
    return { users: users.length, seconds: Math.round((Date.now() - started) / 1000), report };
  } finally {
    running = false;
  }
}

module.exports = { runMasterStatusCycle };
