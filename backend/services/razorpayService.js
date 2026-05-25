const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.warn('⚠️ WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in environment variables.');
    // Fallback to dummy values for compile safety if not set yet, but it will fail on actual API call
    return null;
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

  return razorpayInstance;
};

// Create a new payment order
exports.createOrder = async (amount, currency = 'USD', receiptId) => {
  const rzp = getRazorpayInstance();
  if (!rzp) {
    throw new Error('Razorpay service is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  const options = {
    amount: Math.round(amount * 100), // amount in smallest unit (cents/paisa)
    currency: currency,
    receipt: receiptId || `receipt_${Date.now()}`
  };

  return await rzp.orders.create(options);
};

// Verify payment signature
exports.verifyPaymentSignature = (orderId, paymentId, signature) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error('Razorpay Key Secret is missing. Cannot verify signature.');
  }

  const hmac = crypto.createHmac('sha256', keySecret);
  hmac.update(`${orderId}|${paymentId}`);
  const generatedSignature = hmac.digest('hex');

  return generatedSignature === signature;
};
