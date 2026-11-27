/**
 * Worker for the Automation module (eBay / Poshmark / Mercari / Etsy / Amazon). Runs on a schedule
 * (see utils/cronJobs.js wiring) and processes due jobs platform by platform, feature by feature.
 * Mongo stands in for SQS here (no managed queue in this app's infra): a job document with
 * status:'queued' and a due scheduledAt IS the "message", claimed with an atomic findOneAndUpdate so
 * two overlapping worker ticks can't both grab it.
 *
 * Only Poshmark's Share Closet has a confirmed real endpoint today (see automationAdapters.js) - the
 * other platforms are registered in the settings/job/adapter layer so the module already understands
 * they exist, but their adapters throw CAPABILITY_NOT_AVAILABLE until a real request shape is
 * confirmed for them too, same as Poshmark's own Follow/Relist/Offers features.
 */

const User = require('../models/User');
const Listing = require('../models/Listing');
const AutomationSettings = require('../models/AutomationSettings');
const AutomationJob = require('../models/AutomationJob');
const AutomationJobItem = require('../models/AutomationJobItem');
const AutomationAuditEvent = require('../models/AutomationAuditEvent');
const { getAdapter } = require('./automationAdapters');
const { acquireUserSyncLock, releaseUserSyncLock } = require('./backgroundSyncService');
const { nextDelayMs, sleep, dailyActionCap } = require('../utils/humanPacing');

// Only Poshmark's Share Closet is wired to a real, confirmed shape right now. Keyed by platform so
// adding the next confirmed platform/feature is a one-line addition here.
const SHARE_CLOSET_FIELDS = {
  poshmark: { listingIdField: 'poshmarkListingId', statusField: 'poshmarkStatus', lastSharedAtField: 'poshmarkLastSharedAt' }
};

function todayRunKey(platform, feature, userId) {
  const d = new Date();
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${platform}:${feature}:${userId}:${dateStr}`;
}

async function audit(userId, jobId, platform, eventType, metadata = {}) {
  try {
    await AutomationAuditEvent.create({ user: userId, job: jobId, platform, actorType: 'worker', eventType, metadata });
  } catch (e) {
    console.warn('[Automation] Audit write failed:', e.message);
  }
}

/** Finds settings that are enabled, not paused, and whose local time matches the configured hour:minute (+/- a few minutes for the cron tick granularity). */
async function findDueSettings(platform, feature) {
  const all = await AutomationSettings.find({ platform, feature, enabled: true, paused: false });
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

/** Creates today's job for this user+platform+feature if it doesn't already exist, queued. */
async function ensureJob(userId, platform, feature) {
  const runKey = todayRunKey(platform, feature, userId);
  const existing = await AutomationJob.findOne({ user: userId, platform, feature, runKey });
  if (existing) return existing;
  return AutomationJob.create({
    user: userId, platform, feature, runKey, mode: 'execute', status: 'queued', scheduledAt: new Date()
  });
}

/** Atomically claims one queued job so two worker ticks never both run it. */
async function claimJob(jobId) {
  return AutomationJob.findOneAndUpdate(
    { _id: jobId, status: 'queued' },
    { $set: { status: 'running', claimedAt: new Date(), startedAt: new Date() }, $inc: { attemptCount: 1 } },
    { new: true }
  );
}

async function runShareClosetJob(job, settings) {
  const platform = job.platform;
  const fields = SHARE_CLOSET_FIELDS[platform];
  if (!fields) {
    job.status = 'failed';
    job.errorMessage = `Share Closet has no confirmed endpoint for ${platform} yet.`;
    await job.save();
    return;
  }

  const userId = job.user;
  const user = await User.findById(userId);
  const account = user?.[`${platform}Account`];
  if (!account?.connected || !account.sessionCookie) {
    job.status = 'failed';
    job.errorMessage = `${platform} account not connected.`;
    await job.save();
    return;
  }

  // Eligible: belongs to this user, has a live platform ID, currently published, and either never
  // shared or not shared in the last 20 hours (a daily job shouldn't re-share the same item twice
  // in one calendar day if it runs slightly early/late against the schedule boundary).
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const config = settings?.config || {};
  const query = {
    user: userId,
    [fields.listingIdField]: { $nin: [null, '', 'undefined', 'null'] },
    [fields.statusField]: 'published',
    $or: [{ [fields.lastSharedAtField]: null }, { [fields.lastSharedAtField]: { $lt: cutoff } }]
  };
  if (Array.isArray(config.excludeListingIds) && config.excludeListingIds.length) {
    query._id = { $nin: config.excludeListingIds };
  }
  if (config.category) {
    query.category = config.category;
  }

  const cap = dailyActionCap('share_closet');
  const candidates = await Listing.find(query).limit(cap * 2).select(`_id ${fields.listingIdField} title`).lean();

  job.counts.eligible = candidates.length;
  const toProcess = candidates.slice(0, cap);
  job.counts.excluded = candidates.length - toProcess.length;
  await job.save();

  if (toProcess.length === 0) {
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
    await audit(userId, job._id, platform, 'share_closet.no_eligible_items', {});
    return;
  }

  const adapter = getAdapter(platform);
  let confirmed = 0, failed = 0, authInvalid = false;
  for (let i = 0; i < toProcess.length; i++) {
    if (authInvalid) break;

    const listing = toProcess[i];
    const item = await AutomationJobItem.create({
      job: job._id, user: userId, platform, listing: listing._id, action: 'share', status: 'pending'
    });

    if (i > 0) {
      const delayMs = nextDelayMs(i);
      await sleep(delayMs);
    }

    // Re-check cancellation before every action, per the required worker sequence.
    const fresh = await AutomationJob.findById(job._id).select('status').lean();
    if (fresh?.status === 'cancelled') {
      item.status = 'skipped';
      item.processedAt = new Date();
      await item.save();
      continue;
    }

    try {
      const result = await adapter.shareListing(listing[fields.listingIdField], account);
      item.attemptCount += 1;
      item.processedAt = new Date();
      if (result.success) {
        item.status = 'confirmed';
        item.resultMeta = { status: result.status };
        await Listing.updateOne({ _id: listing._id }, { $set: { [fields.lastSharedAtField]: new Date() } });
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
        await audit(userId, job._id, platform, 'share_closet.auth_invalid', { message: err.message });
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

  await audit(userId, job._id, platform, 'share_closet.completed', { confirmed, failed, eligible: candidates.length });
}

/** One worker tick: finds due Share-closet settings across every platform that supports it, creates/claims/runs their job for today. */
async function runShareClosetTick() {
  for (const platform of Object.keys(SHARE_CLOSET_FIELDS)) {
    const dueSettings = await findDueSettings(platform, 'share_closet');
    for (const settings of dueSettings) {
      const userId = String(settings.user);
      if (!acquireUserSyncLock(userId)) {
        // Another operation (sync, publish, or another automation feature) is in flight for this
        // user's account - wait for the next tick rather than racing it on the same session.
        continue;
      }
      try {
        const job = await ensureJob(settings.user, platform, 'share_closet');
        const claimed = await claimJob(job._id);
        if (!claimed) continue; // already running or completed (another tick got there first)
        await runShareClosetJob(claimed, settings);
      } catch (err) {
        console.error(`[Automation] Share closet tick error for ${platform} user ${userId}:`, err.message);
      } finally {
        releaseUserSyncLock(userId);
      }
    }
  }
}

module.exports = { runShareClosetTick, runShareClosetJob, ensureJob, claimJob };
