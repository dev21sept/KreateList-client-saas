const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
  const User = require('../models/User');
  const { scrapeMercariCloset } = require('../services/mercariService');

  const user = await User.findOne({ 'mercariAccount.connected': true });
  if (!user) { console.log('no mercari-connected user found'); process.exit(0); }
  console.log('Testing scrapeMercariCloset for user:', user.email || user._id);

  try {
    const items = await scrapeMercariCloset(user.mercariAccount.username || 'me', user.mercariAccount);
    console.log('SUCCESS. Items scraped:', items.length);
    console.log('Sample:', JSON.stringify(items.slice(0, 2), null, 2));
  } catch (e) {
    console.log('FAILED:', e.message);
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
