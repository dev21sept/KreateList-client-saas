const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Product = require('./models/Product');
    const Listing = require('./models/Listing');
    
    const activeProds = await Product.find({ status: 'active' });
    console.log('Active Products:', activeProds.length);
    for (const p of activeProds) {
      const hasListing = await Listing.findOne({ sku: p.sku });
      console.log(`[Active] Title: "${p.title}" | SKU: "${p.sku}" | Source: ${p.source} | Has Listing: ${!!hasListing}`);
    }
    
    const inactiveProds = await Product.find({ status: 'inactive' });
    console.log('\nInactive Products:', inactiveProds.length);
    for (const p of inactiveProds) {
      const hasListing = await Listing.findOne({ sku: p.sku });
      console.log(`[Inactive] Title: "${p.title}" | SKU: "${p.sku}" | Source: ${p.source} | Has Listing: ${!!hasListing}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
