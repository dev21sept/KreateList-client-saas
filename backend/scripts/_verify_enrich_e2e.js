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
  const token = await getValidToken(String(listing.user));
  const ebayDetails = await ebayService.getTradingItemDetails(token, listing.ebayListingId);

  if (ebayDetails.sku && !listing.sku) {
    listing.sku = ebayDetails.sku;
    await listing.save();
    console.log('Saved. New sku:', listing.sku);
  }

  const reread = await Listing.findById(listing._id);
  console.log('Re-read from DB: sku =', JSON.stringify(reread.sku));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
