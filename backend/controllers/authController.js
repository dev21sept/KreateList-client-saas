const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../services/emailService');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    // Check if user exists
    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Generate signup OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: cleanEmail,
      password,
      phone,
      isVerified: false,
      otpCode: otp,
      otpExpires: new Date(Date.now() + 15 * 60 * 1000)
    });

    // Send OTP Email
    await sendOtpEmail(cleanEmail, otp, firstName);

    res.status(201).json({
      success: true,
      verificationRequired: true,
      message: 'Registration successful! Verification OTP sent to your email.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 1. Check if account is verified. If not, require registration OTP verification.
    if (!user.isVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      await sendOtpEmail(cleanEmail, otp, user.firstName);

      return res.status(400).json({
        success: false,
        verificationRequired: true,
        message: 'Please verify your account. An OTP code has been sent to your email.'
      });
    }

    // 2. Check for trusted device.
    const isTrusted = deviceId && user.trustedDevices && user.trustedDevices.includes(deviceId);
    
    if (!isTrusted) {
      // Generate OTP for login on a new device
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      await sendOtpEmail(cleanEmail, otp, user.firstName);

      return res.status(200).json({
        success: false,
        verificationRequired: true,
        message: 'New device detected. Please verify the OTP code sent to your email.'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Verify OTP for registration or login
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, deviceId } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP code' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid verification OTP code' });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ success: false, message: 'OTP verification code has expired' });
    }

    // Mark as verified
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;

    // Add deviceId to trusted devices list if provided
    if (deviceId) {
      if (!user.trustedDevices) {
        user.trustedDevices = [];
      }
      if (!user.trustedDevices.includes(deviceId)) {
        user.trustedDevices.push(deviceId);
      }
    }

    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Resend verification OTP code
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send OTP Email
    await sendOtpEmail(cleanEmail, otp, user.firstName);

    res.status(200).json({ success: true, message: 'Verification OTP code resent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const Listing = require('../models/Listing');
    
    // Count active listings created by the user
    const listingsCount = await Listing.countDocuments({
      user: req.user.id,
      status: 'published'
    });

    // Count total listings created/fetched by the user in the database
    const fetchesCount = await Listing.countDocuments({
      user: req.user.id
    });

    const plan = user.subscription?.plan || 'free';
    const expiresAt = user.subscription?.expiresAt;

    // Define limits
    const planLimits = {
      free: 0,
      basic: 500,
      pro: 3000,
      enterprise: 10000
    };

    const aiLimits = {
      free: 10,
      basic: 50,
      pro: 500,
      enterprise: 99999
    };

    const listingLimit = planLimits[plan.toLowerCase()] || 0;
    const aiFetchLimit = listingLimit;

    let daysLeft = 0;
    if (expiresAt) {
      const diffTime = new Date(expiresAt) - new Date();
      daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const userData = user.toObject();
    userData.usage = {
      listingsCount,
      listingLimit,
      fetchesCount,
      aiFetchLimit,
      daysLeft
    };

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update user subscription
// @route   PUT /api/auth/subscription
// @access  Private
exports.updateSubscription = async (req, res) => {
  try {
    const { plan, status, expiresAt } = req.body;

    if (!plan || !status) {
      return res.status(400).json({ success: false, message: 'Plan and status are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.subscription = {
      plan: plan.toLowerCase(),
      status: status,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, currency } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (currency) user.currency = currency;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if current password is correct
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash of new password will be handled by the pre-save hook in User model
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate 6-digit OTP code for password reset
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpire = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    // Send OTP email
    const { sendResetPasswordOtpEmail } = require('../services/emailService');
    await sendResetPasswordOtpEmail(user.email, otp, user.firstName);

    res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password-otp
// @access  Public
exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email, OTP code, and new password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid reset password OTP code' });
    }

    if (new Date() > new Date(user.resetPasswordOtpExpire)) {
      return res.status(400).json({ success: false, message: 'OTP code has expired' });
    }

    // Set new password (pre-save hook will hash it)
    user.password = password;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully! You can now log in.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Hash token from URL
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      currency: user.currency || 'USD'
    }
  });
};
