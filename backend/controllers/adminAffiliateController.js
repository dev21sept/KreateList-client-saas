const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateCommission = require('../models/AffiliateCommission');
const User = require('../models/User');

// @desc    List all affiliates with their user info and totals
// @route   GET /api/admin/affiliates
exports.listAffiliates = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const affiliates = await AffiliateProfile.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Signup counts (regardless of payment) alongside each affiliate's already-stored paid total,
    // so "0 referred" in the list doesn't look broken when people have signed up but not paid yet.
    const signupCounts = await User.aggregate([
      { $match: { referredByAffiliateCode: { $in: affiliates.map(a => a.code) } } },
      { $group: { _id: '$referredByAffiliateCode', count: { $sum: 1 } } }
    ]);
    const signupCountByCode = Object.fromEntries(signupCounts.map(s => [s._id, s.count]));
    const withSignupCounts = affiliates.map(a => ({ ...a, totalSignedUp: signupCountByCode[a.code] || 0 }));

    res.json({ success: true, data: withSignupCounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    One affiliate's full detail: who they referred and which plan each took
// @route   GET /api/admin/affiliates/:id
exports.getAffiliate = async (req, res) => {
  try {
    const affiliate = await AffiliateProfile.findById(req.params.id).populate('user', 'firstName lastName email').lean();
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found.' });
    }
    const commissions = await AffiliateCommission.find({ affiliate: affiliate._id }).sort({ createdAt: -1 }).lean();

    // One row per referred user (their latest plan + total commission from them), for the
    // "clicked on dev, shows who he added and which plan each took" view.
    const byReferredUser = new Map();
    for (const c of commissions) {
      const key = String(c.referredUser);
      if (!byReferredUser.has(key)) {
        byReferredUser.set(key, {
          referredUser: c.referredUser,
          name: c.referredUserName,
          email: c.referredUserEmail,
          plan: c.plan,
          totalCommission: 0,
          firstPaymentAt: c.createdAt,
          lastPaymentAt: c.createdAt
        });
      }
      const row = byReferredUser.get(key);
      row.totalCommission += c.status === 'approved' ? c.commissionAmount : -c.commissionAmount;
      // Entries are sorted newest-first, so the row's plan was already set to the most recent
      // payment's plan when the row was created - only earlier (lower createdAt) entries move the
      // firstPaymentAt bound here; plan is intentionally not overwritten by older entries.
      if (c.createdAt > row.lastPaymentAt) row.lastPaymentAt = c.createdAt;
      if (c.createdAt < row.firstPaymentAt) row.firstPaymentAt = c.createdAt;
    }
    const paidRows = Array.from(byReferredUser.values()).map(r => ({ ...r, paid: true }));

    // Everyone who signed up with this code but hasn't generated a commission yet (no payment, or a
    // trial/free plan) - shown separately so "0 paid referrals" doesn't look like the link isn't
    // working when people are in fact signing up through it.
    const paidUserIds = new Set(paidRows.map(r => String(r.referredUser)));
    const signedUpUsers = await User.find({ referredByAffiliateCode: affiliate.code })
      .select('firstName lastName email createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const pendingRows = signedUpUsers
      .filter(u => !paidUserIds.has(String(u._id)))
      .map(u => ({
        referredUser: u._id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
        plan: null,
        totalCommission: 0,
        firstPaymentAt: null,
        lastPaymentAt: null,
        signedUpAt: u.createdAt,
        paid: false
      }));

    res.json({
      success: true,
      data: {
        affiliate,
        referredUsers: [...paidRows, ...pendingRows],
        totalSignedUp: signedUpUsers.length,
        totalPaid: paidRows.length,
        commissions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function setStatus(req, res, status) {
  try {
    const affiliate = await AffiliateProfile.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          statusReason: (req.body && req.body.reason) || '',
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      },
      { new: true }
    );
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found.' });
    }
    res.json({ success: true, data: affiliate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// @desc    Approve a pending affiliate application
// @route   POST /api/admin/affiliates/:id/approve
exports.approveAffiliate = (req, res) => setStatus(req, res, 'approved');

// @desc    Reject a pending affiliate application
// @route   POST /api/admin/affiliates/:id/reject
exports.rejectAffiliate = (req, res) => setStatus(req, res, 'rejected');

// @desc    Terminate (suspend) an approved affiliate - their tracking link stops earning new
//          commissions immediately; past earned commissions are untouched.
// @route   POST /api/admin/affiliates/:id/terminate
exports.terminateAffiliate = (req, res) => setStatus(req, res, 'suspended');

// @desc    Reactivate a previously suspended affiliate
// @route   POST /api/admin/affiliates/:id/reactivate
exports.reactivateAffiliate = (req, res) => setStatus(req, res, 'approved');
