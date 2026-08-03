const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Listing = require('./models/Listing');
    const { findDuplicateListing } = require('./utils/duplicateChecker');
    
    const userId = '6a11940b4e123a5c21541803';
    const listing = await Listing.findOne({ title: /cozy/i });
    if (!listing) {
      console.log('No cozy listing found');
      return;
    }
    
    console.log('Cozy listing images:', listing.images);
    
    const duplicate = await findDuplicateListing(userId, 'etsy', listing.images[0]);
    console.log('findDuplicateListing duplicate found:', duplicate ? { _id: duplicate._id, title: duplicate.title, platform: duplicate.platform } : 'null');
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
