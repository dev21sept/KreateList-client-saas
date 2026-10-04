const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Listing = require('../models/Listing');
const Product = require('../models/Product');

test('maintenance listing routes are protected and admin-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/listingRoutes.js'), 'utf8');
  const protectIndex = source.indexOf('router.use(protect)');
  const routeIndex = source.indexOf("router.get('/admin/force-delist-poshmark'");
  assert.ok(protectIndex >= 0 && protectIndex < routeIndex);
  assert.match(source, /force-delist-poshmark', authorize\('admin'\)/);
  assert.match(source, /clean-ghost-channels', authorize\('admin'\)/);
});

test('manual subscription update is admin-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/authRoutes.js'), 'utf8');
  assert.match(source, /subscription', protect, authorize\('admin'\), updateSubscription/);
});

test('Stripe raw parser is registered before JSON parser', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const rawIndex = source.indexOf("app.use('/api/subscriptions/webhook', express.raw");
  const jsonIndex = source.indexOf('app.use(express.json');
  assert.ok(rawIndex >= 0 && rawIndex < jsonIndex);
});

test('Razorpay signatures use a valid HMAC comparison', () => {
  process.env.RAZORPAY_KEY_SECRET = 'unit-test-secret';
  const service = require('../services/razorpayService');
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update('order_1|payment_1')
    .digest('hex');
  assert.equal(service.verifyPaymentSignature('order_1', 'payment_1', signature), true);
  assert.equal(service.verifyPaymentSignature('order_1', 'payment_2', signature), false);
});

test('new Listing and Product records receive stable fallback SKUs', async () => {
  const user = new mongoose.Types.ObjectId();
  const listing = new Listing({ user, title: 'Test', description: 'Test', price: '1', category: 'Test' });
  const product = new Product({ user, title: 'Test' });
  await listing.validate();
  await product.validate();
  assert.match(listing.sku, /^AUTO-L-[A-F0-9]{12}$/);
  assert.match(product.sku, /^AUTO-P-[A-F0-9]{12}$/);
});
