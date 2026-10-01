const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister');
  const Order = require('../models/Order');
  const Product = require('../models/Product');
  const Listing = require('../models/Listing');

  const userId = new mongoose.Types.ObjectId('6a9998d8792e9694c0368c85');

  // Let's inspect the active product listing IDs
  const activeProducts = await Product.find({ user: userId, status: { $in: ['active', 'live', 'published'] } }).lean();
  const activeEbayIds = new Set(activeProducts.map(p => p.ebayListingId || p.itemId || p.liveListingId).filter(Boolean));
  const activePoshIds = new Set(activeProducts.map(p => p.poshmarkListingId).filter(Boolean));
  const activeMercIds = new Set(activeProducts.map(p => p.mercariListingId).filter(Boolean));

  // Let's inspect September 2026 orders
  const septOrders = await Order.find({
    user: userId,
    createdDate: { $gte: new Date('2026-09-01T00:00:00.000Z') }
  }).sort({ createdDate: -1 }).lean();

  console.log(`Total September 2026 Orders: ${septOrders.length}`);

  let activeProductOrders = 0;
  let trulySoldOrders = 0;

  for (const o of septOrders) {
    const d = new Date(o.createdDate || o.createdAt);
    const lineItem = o.lineItems?.[0] || {};
    const title = lineItem.title || o.title || 'Unknown';
    const sku = lineItem.sku || o.sku || '';
    const ebayId = o.ebayOrderId || o.orderId || lineItem.legacyItemId || lineItem.itemId;
    const poshId = o.poshmarkListingId || lineItem.poshmarkListingId;
    const price = o.totalAmount || lineItem.price || 0;

    const isEbayActive = (lineItem.legacyItemId && activeEbayIds.has(lineItem.legacyItemId)) || (lineItem.itemId && activeEbayIds.has(lineItem.itemId));
    const isPoshActive = poshId && activePoshIds.has(poshId);

    if (isEbayActive || isPoshActive) {
      activeProductOrders++;
      console.log(`[STILL ACTIVE STORE ITEM in Order] Date: ${d.toISOString().substring(0, 10)}, Platform: ${o.platform}, Title: "${title}", Price: $${price}`);
    } else {
      trulySoldOrders++;
    }
  }

  console.log(`\nSummary of September Orders:`);
  console.log(`  Truly Sold (Item not active in store): ${trulySoldOrders}`);
  console.log(`  Still Active Store Items (Mistakenly treated as sold): ${activeProductOrders}`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
