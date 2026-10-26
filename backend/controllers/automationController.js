const AutomationSettings = require('../models/AutomationSettings');
const AutomationJob = require('../models/AutomationJob');
const AutomationJobItem = require('../models/AutomationJobItem');
const AutomationAuditEvent = require('../models/AutomationAuditEvent');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { dailyActionCap } = require('../utils/humanPacing');
const { ensureJob, claimJob, runShareClosetJob } = require('../services/automationWorker');

const PLATFORMS = ['poshmark', 'ebay', 'mercari', 'etsy', 'amazon'];
const FEATURES = ['share_closet', 'follow_users', 'relist', 'offers_to_likers'];

// Only Poshmark's Share Closet has a confirmed real endpoint today (see services/automationAdapters.js).
// Every other platform/feature combination is registered here as "coming soon" rather than left out,
// so the module already understands all 5 platforms exist without fabricating automation that hasn't
// been confirmed against the platform's real site.
const AVAILABLE = {
  poshmark: { share_closet: true, follow_users: false, relist: false, offers_to_likers: false },
  ebay: { share_closet: false, follow_users: false, relist: false, offers_to_likers: false },
  mercari: { share_closet: false, follow_users: false, relist: false, offers_to_likers: false },
  etsy: { share_closet: false, follow_users: false, relist: false, offers_to_likers: false },
  amazon: { share_closet: false, follow_users: false, relist: false, offers_to_likers: false }
};

function isAvailable(platform, feature) {
  return !!AVAILABLE[platform]?.[feature];
}

// @desc    Read all platform/feature settings for the current user (creating defaults for any missing ones)
// @route   GET /api/automation/settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await AutomationSettings.find({ user: userId });
    const byKey = Object.fromEntries(existing.map(s => [`${s.platform}:${s.feature}`, s]));

    for (const platform of PLATFORMS) {
      for (const feature of FEATURES) {
        const key = `${platform}:${feature}`;
        if (!byKey[key]) {
          byKey[key] = await AutomationSettings.create({ user: userId, platform, feature });
        }
      }
    }

    const user = await User.findById(userId)
      .select('poshmarkAccount ebayAccount mercariAccount etsyAccount amazonAccount')
      .lean();

    const connected = {
      poshmark: !!user?.poshmarkAccount?.connected,
      ebay: !!user?.ebayAccount?.connected,
      mercari: !!user?.mercariAccount?.connected,
      etsy: !!user?.etsyAccount?.connected,
      amazon: !!user?.amazonAccount?.connected
    };

    const settings = [];
    for (const platform of PLATFORMS) {
      for (const feature of FEATURES) {
        const doc = byKey[`${platform}:${feature}`];
        settings.push({
          platform,
          feature,
          available: isAvailable(platform, feature),
          disabledReason: isAvailable(platform, feature) ? null : 'Required integration permission is not available.',
          ...doc.toObject()
        });
      }
    }

    res.json({ success: true, data: { connected, settings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update one platform/feature's settings
// @route   PUT /api/automation/settings/:platform/:feature
exports.updateSettings = async (req, res) => {
  try {
    const { platform, feature } = req.params;
    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unknown platform.' });
    }
    if (!FEATURES.includes(feature)) {
      return res.status(400).json({ success: false, message: 'Unknown feature.' });
    }
    if (req.body.enabled && !isAvailable(platform, feature)) {
      return res.status(409).json({ success: false, message: 'Required integration permission is not available for this feature yet.' });
    }

    const update = {};
    for (const key of ['enabled', 'paused', 'timezone', 'approvalMode', 'schedule', 'config']) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    update.updatedAt = new Date();

    const settings = await AutomationSettings.findOneAndUpdate(
      { user: req.user.id, platform, feature },
      { $set: update, $setOnInsert: { user: req.user.id, platform, feature } },
      { new: true, upsert: true }
    );

    await AutomationAuditEvent.create({
      user: req.user.id, platform, actorType: 'user', eventType: `${feature}.settings_updated`, metadata: update
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Preview eligible listings for Share Closet without running anything, or run a feature now
// @route   POST /api/automation/jobs  { platform, feature, mode }
exports.createJob = async (req, res) => {
  try {
    const { platform, feature, mode = 'preview' } = req.body;
    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Unknown platform.' });
    }
    if (!FEATURES.includes(feature)) {
      return res.status(400).json({ success: false, message: 'Unknown feature.' });
    }
    if (!isAvailable(platform, feature)) {
      return res.status(409).json({ success: false, message: 'CAPABILITY_NOT_AVAILABLE', code: 'CAPABILITY_NOT_AVAILABLE' });
    }

    const user = await User.findById(req.user.id).select(`${platform}Account`).lean();
    if (!user?.[`${platform}Account`]?.connected) {
      return res.status(409).json({ success: false, message: `${platform} account is not connected.` });
    }

    if (mode === 'preview') {
      if (feature === 'share_closet' && platform === 'poshmark') {
        const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
        const eligible = await Listing.countDocuments({
          user: req.user.id,
          poshmarkListingId: { $nin: [null, '', 'undefined', 'null'] },
          poshmarkStatus: 'published',
          $or: [{ poshmarkLastSharedAt: null }, { poshmarkLastSharedAt: { $lt: cutoff } }]
        });
        return res.json({
          success: true,
          data: { platform, feature, mode, eligible, dailyCap: dailyActionCap('share_closet'), message: 'Eligible listings evaluated.' }
        });
      }
    }

    // mode === 'execute': run it right now (manual "Run now"), outside the schedule.
    const job = await ensureJob(req.user.id, platform, feature);
    const claimed = await claimJob(job._id);
    if (!claimed) {
      return res.json({ success: true, data: { jobId: job._id, status: job.status, message: 'A run for today is already queued or in progress.' } });
    }

    res.json({ success: true, data: { jobId: claimed._id, status: 'running', mode: 'execute' } });

    // Respond immediately, run in background - same pattern as the rest of the app's sync endpoints.
    setImmediate(async () => {
      try {
        const settings = await AutomationSettings.findOne({ user: req.user.id, platform, feature });
        if (feature === 'share_closet') await runShareClosetJob(claimed, settings);
      } catch (err) {
        console.error('[Automation] Manual run error:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Paginated job list
// @route   GET /api/automation/jobs
exports.listJobs = async (req, res) => {
  try {
    const { platform, feature } = req.query;
    const query = { user: req.user.id };
    if (platform) query.platform = platform;
    if (feature) query.feature = feature;
    const jobs = await AutomationJob.find(query).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Job detail + per-item outcomes
// @route   GET /api/automation/jobs/:id
exports.getJob = async (req, res) => {
  try {
    const job = await AutomationJob.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    const items = await AutomationJobItem.find({ job: job._id }).populate('listing', 'title thumbnail').sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { job, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Cancel a queued/running job - running items in flight finish, remaining ones are skipped
// @route   POST /api/automation/jobs/:id/cancel
exports.cancelJob = async (req, res) => {
  try {
    const job = await AutomationJob.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: { $in: ['queued', 'running'] } },
      { $set: { status: 'cancelled', completedAt: new Date() } },
      { new: true }
    );
    if (!job) return res.status(404).json({ success: false, message: 'No cancellable job found.' });
    await AutomationAuditEvent.create({ user: req.user.id, job: job._id, platform: job.platform, actorType: 'user', eventType: `${job.feature}.job_cancelled`, metadata: {} });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Audit / execution history
// @route   GET /api/automation/activity
exports.getActivity = async (req, res) => {
  try {
    const events = await AutomationAuditEvent.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
