const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Plan = require('../models/Plan');
const razorpayService = require('../services/razorpayService');

// @desc    Get all available plans
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create Stripe checkout session
// @route   POST /api/subscriptions/checkout
// @access  Private
exports.createCheckoutSession = async (req, res) => {
  try {
    const { priceId } = req.body;
    const user = await User.findById(req.user.id);

    // Create stripe customer if not exists
    if (!user.subscription.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user._id.toString() }
      });
      user.subscription.stripeCustomerId = customer.id;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: user.subscription.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription`,
      metadata: { userId: user._id.toString() }
    });

    res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Stripe Webhook
// @route   POST /api/subscriptions/webhook
// @access  Public
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSubscriptionCreated(session);
      break;
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await handleSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      const deletedSub = event.data.object;
      await handleSubscriptionDeleted(deletedSub);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Helper functions for webhook
async function handleSubscriptionCreated(session) {
  const userId = session.metadata.userId;
  const stripeSubscriptionId = session.subscription;
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  await User.findByIdAndUpdate(userId, {
    'subscription.status': 'active',
    'subscription.stripeSubscriptionId': stripeSubscriptionId,
    'subscription.expiresAt': new Date(subscription.current_period_end * 1000),
    'subscription.paymentMethod': 'stripe'
  });
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
  if (user) {
    user.subscription.status = subscription.status === 'active' ? 'active' : 'inactive';
    user.subscription.expiresAt = new Date(subscription.current_period_end * 1000);
    await user.save();
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  await User.findOneAndUpdate(
    { 'subscription.stripeCustomerId': customerId },
    { 'subscription.status': 'canceled' }
  );
}

// @desc    Create Razorpay Order
// @route   POST /api/subscriptions/razorpay/order
// @access  Private
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { plan, cycle } = req.body;
    
    // Plan prices in USD
    const planPrices = {
      basic: { monthly: 1, yearly: 10 },
      pro: { monthly: 149, yearly: 1692 },
      enterprise: { monthly: 299, yearly: 3408 }
    };

    const targetPlan = String(plan || 'pro').toLowerCase();
    const targetCycle = String(cycle || 'monthly').toLowerCase();

    const planCyclePrice = planPrices[targetPlan] || planPrices.pro;
    const amount = planCyclePrice[targetCycle] || planCyclePrice.monthly;
    
    // For USD payments, we charge the flat plan rate without GST
    const totalAmount = amount;

    const receiptId = `rcpt_${req.user.id.substring(18)}_${Date.now().toString().slice(-6)}`;
    const order = await razorpayService.createOrder(totalAmount, 'USD', receiptId);

    res.status(200).json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: order.amount, // in cents
      currency: order.currency,
      order_id: order.id,
      plan: targetPlan,
      cycle: targetCycle
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify Razorpay Payment
// @route   POST /api/subscriptions/razorpay/verify
// @access  Private
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      plan,
      cycle
    } = req.body;

    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid signature.'
      });
    }

    // Upgrade the user's subscription in DB
    const expiresAt = new Date();
    if (cycle === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const planPrices = {
      basic: { monthly: 1, yearly: 10 },
      pro: { monthly: 149, yearly: 1692 },
      enterprise: { monthly: 299, yearly: 3408 }
    };
    const targetPlan = plan.toLowerCase();
    const targetCycle = (cycle || 'monthly').toLowerCase();
    const cyclePrices = planPrices[targetPlan] || planPrices.pro;
    const amountPaid = cyclePrices[targetCycle] || cyclePrices.monthly;

    user.subscription.plan = targetPlan;
    user.subscription.status = 'active';
    user.subscription.expiresAt = expiresAt;
    user.subscription.paymentMethod = 'razorpay';
    user.subscription.paymentAmount = amountPaid;
    user.subscription.paymentDate = new Date();
    user.subscription.razorpayPaymentId = razorpay_payment_id;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully!',
      data: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        expiresAt: user.subscription.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
