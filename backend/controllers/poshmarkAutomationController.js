const PoshmarkAutomationSettings = require('../models/PoshmarkAutomationSettings');
const PoshmarkAutomationJob = require('../models/PoshmarkAutomationJob');
const PoshmarkJobItem = require('../models/PoshmarkJobItem');
const PoshmarkAuditEvent = require('../models/PoshmarkAuditEvent');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { dailyActionCap } = require('../utils/humanPacing');
const { ensureJob, claimJob, runShareClosetJob } = require('../services/poshmarkAutomationWorker');

const FEATURES = ['share_closet', 'follow_users', 'relist', 'offers_to_likers'];
const AVAILABLE_FEATURES = { share_closet: true, follow_users: false, relist: false, offers_to_likers: false };

// @desc    Read all 4 feature settings for the current user (creating defaults for any missing ones)
// @route   GET /api/poshmark-automation/settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await PoshmarkAutomationSettings.find({ user: userId });
    const byFeature = Object.fromEntries(existing.map(s => [s.feature, s]));

    for (const feature of FEATURES) {
      if (!byFeature[feature]) {
        byFeature[feature] = await PoshmarkAutomationSettings.create({ user: userId, feature });
      }
    }

    const user = await User.findById(userId).select('poshmarkAccount').lean();
    res.json({
      success: true,
      data: {
        connected: !!user?.poshmarkAccount?.connected,
        settings: FEATURES.map(f => ({
          feature: f,
          available: AVAILABLE_FEATURES[f],
          disabledReason: AVAILABLE_FEATURES[f] ? null : 'Required integration permission is not available.',
          ...byFeature[f].toObject()
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update one feature's settings
// @route   PUT /api/poshmark-automation/settings/:feature
exports.updateSettings = async (req, res) => {
  try {
    const { feature } = req.params;
    if (!FEATURES.includes(feature)) {
      return res.status(400).json({ success: false, message: 'Unknown feature.' });
    }
    if (req.body.enabled && !AVAILABLE_FEATURES[feature]) {
      return res.status(409).json({ success: false, message: 'Required integration permission is not available for this feature yet.' });
    }

    const update = {};
    for (const key of ['enabled', 'paused', 'timezone', 'approvalMode', 'schedule', 'config']) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    update.updatedAt = new Date();

    const settings = await PoshmarkAutomationSettings.findOneAndUpdate(
      { user: req.user.id, feature },
      { $set: update, $setOnInsert: { user: req.user.id, feature } },
      { new: true, upsert: true }
    );

    await PoshmarkAuditEvent.create({
      user: req.user.id, actorType: 'user', eventType: `${feature}.settings_updated`, metadata: update
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Preview eligible listings for Share Closet without running anything
// @route   POST /api/poshmark-automation/jobs  { feature, mode }
exports.createJob = async (req, res) => {
  try {
    const { feature, mode = 'preview' } = req.body;
    if (!FEATURES.includes(feature)) {
      return res.status(400).json({ success: false, message: 'Unknown feature.' });
    }
    if (!AVAILABLE_FEATURES[feature]) {
      return res.status(409).json({ success: false, message: 'CAPABILITY_NOT_AVAILABLE', code: 'CAPABILITY_NOT_AVAILABLE' });
    }

    const user = await User.findById(req.user.id).select('poshmarkAccount').lean();
    if (!user?.poshmarkAccount?.connected) {
      return res.status(409).json({ success: false, message: 'Poshmark account is not connected.' });
    }

    if (mode === 'preview') {
      if (feature === 'share_closet') {
        const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
        const eligible = await Listing.countDocuments({
          user: req.user.id,
          poshmarkListingId: { $nin: [null, '', 'undefined', 'null'] },
          poshmarkStatus: 'published',
          $or: [{ poshmarkLastSharedAt: null }, { poshmarkLastSharedAt: { $lt: cutoff } }]
        });
        return res.json({
          success: true,
          data: { feature, mode, eligible, dailyCap: dailyActionCap('share_closet'), message: 'Eligible listings evaluated.' }
        });
      }
    }

    // mode === 'execute': run it right now (manual "Run now"), outside the schedule.
    const job = await ensureJob(req.user.id, feature);
    const claimed = await claimJob(job._id);
    if (!claimed) {
      return res.json({ success: true, data: { jobId: job._id, status: job.status, message: 'A run for today is already queued or in progress.' } });
    }

    res.json({ success: true, data: { jobId: claimed._id, status: 'running', mode: 'execute' } });

    // Respond immediately, run in background - same pattern as the rest of the app's sync endpoints.
    setImmediate(async () => {
      try {
        const settings = await PoshmarkAutomationSettings.findOne({ user: req.user.id, feature });
        if (feature === 'share_closet') await runShareClosetJob(claimed, settings);
      } catch (err) {
        console.error('[Poshmark Automation] Manual run error:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Paginated job list
// @route   GET /api/poshmark-automation/jobs
exports.listJobs = async (req, res) => {
  try {
    const { feature } = req.query;
    const query = { user: req.user.id };
    if (feature) query.feature = feature;
    const jobs = await PoshmarkAutomationJob.find(query).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Job detail + per-item outcomes
// @route   GET /api/poshmark-automation/jobs/:id
exports.getJob = async (req, res) => {
  try {
    const job = await PoshmarkAutomationJob.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    const items = await PoshmarkJobItem.find({ job: job._id }).populate('listing', 'title thumbnail').sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { job, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Cancel a queued/running job - running items in flight finish, remaining ones are skipped
// @route   POST /api/poshmark-automation/jobs/:id/cancel
exports.cancelJob = async (req, res) => {
  try {
    const job = await PoshmarkAutomationJob.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: { $in: ['queued', 'running'] } },
      { $set: { status: 'cancelled', completedAt: new Date() } },
      { new: true }
    );
    if (!job) return res.status(404).json({ success: false, message: 'No cancellable job found.' });
    await PoshmarkAuditEvent.create({ user: req.user.id, job: job._id, actorType: 'user', eventType: `${job.feature}.job_cancelled`, metadata: {} });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Audit / execution history
// @route   GET /api/poshmark-automation/activity
exports.getActivity = async (req, res) => {
  try {
    const events = await PoshmarkAuditEvent.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
