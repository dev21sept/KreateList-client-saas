const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Listing = require('./models/Listing');
    
    const userId = '6a11940b4e123a5c21541803';
    const docs = await Listing.find({ user: userId });
    console.log(`Current Listing count: ${docs.length}`);
    docs.forEach((d, idx) => {
      console.log(`[${idx}] SKU: "${d.sku}" | Title: "${d.title}" | Status: ${d.status}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
