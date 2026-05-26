const User = require('../models/User');
const Listing = require('../models/Listing');

// @desc    Get system stats
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalListings = await Listing.countDocuments();
    const publishedListings = await Listing.countDocuments({ status: 'published' });
    
    // Calculate monthly revenue from active premium subscriptions
    const activeSubs = await User.countDocuments({ 'subscription.status': 'active' });
    const monthlyRevenue = activeSubs * 29; // Assuming $29 average

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        publishedListings,
        monthlyRevenue,
        activeSubscriptions: activeSubs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    
    // Fetch stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const total = await Listing.countDocuments({ user: user._id });
      const published = await Listing.countDocuments({ user: user._id, status: 'published' });
      const draft = await Listing.countDocuments({ user: user._id, status: 'draft' });
      const scheduled = await Listing.countDocuments({ user: user._id, status: 'scheduled' });
      const failed = await Listing.countDocuments({ user: user._id, status: 'failed' });

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        subscription: user.subscription,
        createdAt: user.createdAt,
        stats: {
          total,
          published,
          draft,
          scheduled,
          failed
        }
      };
    }));

    res.status(200).json({ success: true, count: usersWithStats.length, data: usersWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update user status/plan
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

