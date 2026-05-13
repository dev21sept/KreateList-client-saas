const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Plan = require('../models/Plan');

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
    'subscription.expiresAt': new Date(subscription.current_period_end * 1000)
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
