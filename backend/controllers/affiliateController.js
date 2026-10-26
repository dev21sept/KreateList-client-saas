const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateCommission = require('../models/AffiliateCommission');
const { generateAffiliateCode } = require('../services/affiliateService');

// @desc    Apply to become an affiliate (any logged-in eLister user)
// @route   POST /api/affiliate/apply
exports.apply = async (req, res) => {
  try {
    const existing = await AffiliateProfile.findOne({ user: req.user.id });
    if (existing) {
      return res.status(200).json({ success: true, data: existing, message: 'You already have an affiliate profile.' });
    }
    const code = await generateAffiliateCode(req.user);
    const profile = await AffiliateProfile.create({ user: req.user.id, code, status: 'pending' });
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Own affiliate profile, status and tracking link
// @route   GET /api/affiliate/me
exports.getMe = async (req, res) => {
  try {
    const profile = await AffiliateProfile.findOne({ user: req.user.id }).lean();
    if (!profile) {
      return res.json({ success: true, data: null });
    }
    res.json({
      success: true,
      data: {
        ...profile,
        trackingLink: `https://elister.ai/?via=${profile.code}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Own commission ledger / referred-user list, paginated
// @route   GET /api/affiliate/commissions
exports.getCommissions = async (req, res) => {
  try {
    const profile = await AffiliateProfile.findOne({ user: req.user.id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'No affiliate profile found.' });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 25;
    const [entries, total] = await Promise.all([
      AffiliateCommission.find({ affiliate: profile._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AffiliateCommission.countDocuments({ affiliate: profile._id })
    ]);
    res.json({
      success: true,
      data: {
        entries,
        total,
        page,
        pages: Math.ceil(total / limit),
        totalReferred: profile.totalReferred,
        totalCommissionEarned: profile.totalCommissionEarned
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
