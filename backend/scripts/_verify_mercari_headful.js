const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const Listing = require('../models/Listing');
  const User = require('../models/User');
  const { fetchMercariItemDetails } = require('../services/mercariService');

  const listing = await Listing.findOne({ mercariListingId: { $exists: true, $ne: null, $ne: '' } });
  if (!listing) { console.log('no mercari listing found'); process.exit(0); }
  console.log('Testing real production fetchMercariItemDetails() for:', listing.mercariListingId);

  const user = await User.findById(listing.user);
  if (!user?.mercariAccount?.connected) { console.log('mercari not connected'); process.exit(0); }

  try {
    const details = await fetchMercariItemDetails(listing.mercariListingId, user.mercariAccount);
    console.log('SUCCESS. Details:', JSON.stringify(details, null, 2));
  } catch (e) {
    console.log('FAILED:', e.message);
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
