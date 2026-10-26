/**
 * Worker for the Poshmark Automation module. Runs on a schedule (see server.js wiring) and processes
 * due jobs feature by feature. Mongo stands in for SQS here (no managed queue in this app's infra):
 * a job document with status:'queued' and a due scheduledAt IS the "message", claimed with an atomic
 * findOneAndUpdate so two overlapping worker ticks can't both grab it.
 */

const User = require('../models/User');
const Listing = require('../models/Listing');
const PoshmarkAutomationSettings = require('../models/PoshmarkAutomationSettings');
const PoshmarkAutomationJob = require('../models/PoshmarkAutomationJob');
const PoshmarkJobItem = require('../models/PoshmarkJobItem');
const PoshmarkAuditEvent = require('../models/PoshmarkAuditEvent');
const poshmarkAutomationService = require('./poshmarkAutomationService');
const { acquireUserSyncLock, releaseUserSyncLock } = require('./backgroundSyncService');
const { nextDelayMs, sleep, dailyActionCap } = require('../utils/humanPacing');

function todayRunKey(feature, userId) {
  const d = new Date();
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${feature}:${userId}:${dateStr}`;
}

async function audit(userId, jobId, eventType, metadata = {}) {
  try {
    await PoshmarkAuditEvent.create({ user: userId, job: jobId, actorType: 'worker', eventType, metadata });
  } catch (e) {
    console.warn('[Poshmark Automation] Audit write failed:', e.message);
  }
}

/** Finds settings that are enabled, not paused, and whose local time matches the configured hour:minute (+/- a few minutes for the cron tick granularity). */
async function findDueSettings(feature) {
  const all = await PoshmarkAutomationSettings.find({ feature, enabled: true, paused: false });
  const now = new Date();
  return all.filter(s => {
    try {
      const local = new Date(now.toLocaleString('en-US', { timeZone: s.timezone || 'America/New_York' }));
      const dueMinute = s.schedule.hour * 60 + s.schedule.minute;
      const nowMinute = local.getHours() * 60 + local.getMinutes();
      return Math.abs(nowMinute - dueMinute) <= 7; // the tick runs every 5 min; 7 gives one cycle of slack
    } catch (e) {
      return false;
    }
  });
}

/** Creates today's job for this user+feature if it doesn't already exist, queued. */
async function ensureJob(userId, feature) {
  const runKey = todayRunKey(feature, userId);
  const existing = await PoshmarkAutomationJob.findOne({ user: userId, feature, runKey });
  if (existing) return existing;
  return PoshmarkAutomationJob.create({
    user: userId, feature, runKey, mode: 'execute', status: 'queued', scheduledAt: new Date()
  });
}

/** Atomically claims one queued job so two worker ticks never both run it. */
async function claimJob(jobId) {
  return PoshmarkAutomationJob.findOneAndUpdate(
    { _id: jobId, status: 'queued' },
    { $set: { status: 'running', claimedAt: new Date(), startedAt: new Date() }, $inc: { attemptCount: 1 } },
    { new: true }
  );
}

async function runShareClosetJob(job, settings) {
  const userId = job.user;
  const user = await User.findById(userId);
  if (!user?.poshmarkAccount?.connected || !user.poshmarkAccount.sessionCookie) {
    job.status = 'failed';
    job.errorMessage = 'Poshmark account not connected.';
    await job.save();
    return;
  }

  // Eligible: belongs to this user, has a live Poshmark ID, currently published, and either never
  // shared or not shared in the last 20 hours (a daily job shouldn't re-share the same item twice
  // in one calendar day if it runs slightly early/late against the schedule boundary).
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const config = settings?.config || {};
  const query = {
    user: userId,
    poshmarkListingId: { $nin: [null, '', 'undefined', 'null'] },
    poshmarkStatus: 'published',
    $or: [{ poshmarkLastSharedAt: null }, { poshmarkLastSharedAt: { $lt: cutoff } }]
  };
  if (Array.isArray(config.excludeListingIds) && config.excludeListingIds.length) {
    query._id = { $nin: config.excludeListingIds };
  }
  if (config.category) {
    query.category = config.category;
  }

  const cap = dailyActionCap('share_closet');
  const candidates = await Listing.find(query).limit(cap * 2).select('_id poshmarkListingId title').lean();

  job.counts.eligible = candidates.length;
  const toProcess = candidates.slice(0, cap);
  job.counts.excluded = candidates.length - toProcess.length;
  await job.save();

  if (toProcess.length === 0) {
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
    await audit(userId, job._id, 'share_closet.no_eligible_items', {});
    return;
  }

  let confirmed = 0, failed = 0, authInvalid = false;
  for (let i = 0; i < toProcess.length; i++) {
    if (authInvalid) break;

    const listing = toProcess[i];
    const item = await PoshmarkJobItem.create({
      job: job._id, user: userId, listing: listing._id, action: 'share', status: 'pending'
    });

    if (i > 0) {
      const delayMs = nextDelayMs(i);
      await sleep(delayMs);
    }

    // Re-check cancellation before every action, per the required worker sequence.
    const fresh = await PoshmarkAutomationJob.findById(job._id).select('status').lean();
    if (fresh?.status === 'cancelled') {
      item.status = 'skipped';
      item.processedAt = new Date();
      await item.save();
      continue;
    }

    try {
      const result = await poshmarkAutomationService.shareListing(listing.poshmarkListingId, user.poshmarkAccount);
      item.attemptCount += 1;
      item.processedAt = new Date();
      if (result.success) {
        item.status = 'confirmed';
        item.resultMeta = { status: result.status };
        await Listing.updateOne({ _id: listing._id }, { $set: { poshmarkLastSharedAt: new Date() } });
        confirmed++;
      } else if (result.permanent) {
        item.status = 'failed';
        item.errorCode = 'NOT_FOUND';
        item.resultMeta = { status: result.status, message: result.message };
        failed++;
      } else {
        item.status = 'uncertain';
        item.errorCode = 'TRANSIENT';
        item.resultMeta = { status: result.status, message: result.message };
        failed++;
      }
      await item.save();
    } catch (err) {
      item.status = err.code === 'AUTH_INVALID' ? 'uncertain' : 'failed';
      item.errorCode = err.code || 'UNKNOWN';
      item.resultMeta = { message: err.message };
      item.processedAt = new Date();
      await item.save();
      failed++;
      if (err.code === 'AUTH_INVALID') {
        authInvalid = true;
        await audit(userId, job._id, 'share_closet.auth_invalid', { message: err.message });
      }
    }
  }

  job.counts.confirmed = confirmed;
  job.counts.failed = failed;
  job.status = authInvalid
    ? 'blocked'
    : (failed === 0 ? 'completed' : (confirmed > 0 ? 'partially_completed' : 'failed'));
  job.completedAt = new Date();
  await job.save();

  settings.lastRunAt = new Date();
  await settings.save();

  await audit(userId, job._id, 'share_closet.completed', { confirmed, failed, eligible: candidates.length });
}

/** One worker tick: finds due Share-closet settings, creates/claims/runs their job for today. */
async function runShareClosetTick() {
  const dueSettings = await findDueSettings('share_closet');
  for (const settings of dueSettings) {
    const userId = String(settings.user);
    if (!acquireUserSyncLock(userId)) {
      // Another Poshmark operation (sync, publish, or another automation feature) is in flight for
      // this user's account - wait for the next tick rather than racing it on the same session.
      continue;
    }
    try {
      const job = await ensureJob(settings.user, 'share_closet');
      const claimed = await claimJob(job._id);
      if (!claimed) continue; // already running or completed (another tick got there first)
      await runShareClosetJob(claimed, settings);
    } catch (err) {
      console.error(`[Poshmark Automation] Share closet tick error for user ${userId}:`, err.message);
    } finally {
      releaseUserSyncLock(userId);
    }
  }
}

module.exports = { runShareClosetTick, runShareClosetJob, ensureJob, claimJob };
