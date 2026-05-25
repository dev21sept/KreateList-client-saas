const Listing = require('../models/Listing');

exports.requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Bypass subscription checks for admin users
    if (req.user.role === 'admin') {
      return next();
    }

    const sub = req.user.subscription;
    
    // Check if subscription status is active
    if (!sub || sub.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required. Please purchase a subscription plan to unlock this feature.'
      });
    }

    // Check if subscription has expired
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
      req.user.subscription.status = 'inactive';
      await req.user.save();
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew your subscription to continue.'
      });
    }

    // Enforce monthly listing limit based on plan
    const plan = sub.plan || 'free';
    const planLimits = {
      free: 0,
      basic: 500,
      pro: 3000,
      enterprise: 10000
    };

    const limit = planLimits[plan.toLowerCase()] || 0;

    // Count listings created by the user in the current calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const listingsCount = await Listing.countDocuments({
      user: req.user.id,
      createdAt: { $gte: startOfMonth }
    });

    if (listingsCount >= limit) {
      return res.status(403).json({
        success: false,
        message: `You have reached the monthly AI listing limit of ${limit} listings for your ${plan.toUpperCase()} plan. Please upgrade your subscription to continue.`
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
