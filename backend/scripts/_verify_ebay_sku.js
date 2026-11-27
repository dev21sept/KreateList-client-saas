const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = require('../models/Listing');
  const { getValidToken } = require('../controllers/ebayController');
  const ebayService = require('../services/ebayService');

  const listing = await Listing.findOne({ ebayListingId: '206606802710' });
  if (!listing) { console.log('not found'); process.exit(0); }
  console.log('Before: sku =', JSON.stringify(listing.sku));

  const token = await getValidToken(String(listing.user));
  if (!token) { console.log('no token'); process.exit(0); }
  const details = await ebayService.getTradingItemDetails(token, listing.ebayListingId);
  console.log('eBay GetItem SKU field:', JSON.stringify(details?.sku));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
