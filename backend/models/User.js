const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add a first name']
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phone: {
    type: String
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'past_due', 'canceled'],
      default: 'inactive'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    paymentMethod: {
      type: String,
      enum: ['free', 'stripe', 'razorpay', 'admin'],
      default: 'free'
    },
    paymentAmount: {
      type: Number,
      default: 0
    },
    paymentDate: Date,
    razorpayPaymentId: String,
    expiresAt: Date
  },
  ebayAccount: {
    connected: {
      type: Boolean,
      default: false
    },
    username: String,
    email: String,
    name: String,
    phone: String,
    accessToken: String,
    refreshToken: String,
    tokenExpires: Date
  },
  linkedEbayUsernames: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
