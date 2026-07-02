const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const { publishToDepop } = require('../services/backendPublishService');

    const listing = await Listing.findById('6a420e6b015890f7f8335322');
    if (!listing) {
      console.error('Listing not found');
      return;
    }

    const user = await User.findById(listing.user);
    if (!user) {
      console.error('User not found');
      return;
    }

    console.log('Starting direct publish test via backend service...');
    console.log('Listing title:', listing.title);
    console.log('User depopAccount connected:', user.depopAccount?.connected);

    const result = await publishToDepop(listing, user.depopAccount);
    console.log('Test Publish Result:', result);

  } catch (err) {
    console.error('Test Publish Failed with error:');
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
