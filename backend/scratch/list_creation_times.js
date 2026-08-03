const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Listing = require('./models/Listing');
    
    const docs = await Listing.find({});
    console.log('Total Listings in DB:', docs.length);
    
    const sorted = docs.map(d => {
      const timestamp = d._id.getTimestamp();
      return {
        _id: d._id,
        title: d.title,
        sku: d.sku,
        status: d.status,
        created: timestamp.toISOString(),
        doc: d
      };
    }).sort((a, b) => new Date(a.created) - new Date(b.created));
    
    sorted.forEach((s, idx) => {
      console.log(`[${idx}] ${s.created} | SKU: ${s.sku} | Title: ${s.title}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
