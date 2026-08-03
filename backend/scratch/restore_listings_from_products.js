const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Product = require('./models/Product');
    const Listing = require('./models/Listing');
    
    const products = await Product.find({});
    console.log(`Found ${products.length} products to check...`);
    
    let createdCount = 0;
    for (const prod of products) {
      // Find if a Listing already exists for this SKU or synced listing ID
      let query = [];
      const generatedSku = prod.sku || ('KL-SYNCED-' + prod._id.toString().slice(-6).toUpperCase());
      
      query.push({ sku: generatedSku });
      if (prod.ebayListingId) query.push({ ebayListingId: prod.ebayListingId });
      if (prod.etsyListingId) query.push({ etsyListingId: prod.etsyListingId });
      if (prod.poshmarkListingId) query.push({ poshmarkListingId: prod.poshmarkListingId });
      if (prod.depopListingId) query.push({ depopListingId: prod.depopListingId });
      
      let hasListing = false;
      if (query.length > 0) {
        hasListing = await Listing.findOne({ user: prod.user, $or: query });
      }
      
      if (!hasListing) {
        // Recreate the draft/published listing document
        const listing = new Listing({
          user: prod.user,
          title: prod.title,
          description: prod.description || prod.title,
          sku: generatedSku,
          brand: prod.brand || '',
          size: prod.size || '',
          color: prod.color || '',
          category: 'Clothing', // Required by Listing schema
          categoryId: prod.categoryId || '',
          itemSpecifics: prod.itemSpecifics || {},
          price: prod.selling_price || 0,
          images: prod.images || [],
          status: prod.status === 'active' ? 'published' : 'draft',
          ebayListingId: prod.ebayListingId || '',
          ebayUrl: prod.ebayUrl || '',
          ebayStatus: prod.ebayListingId && prod.status === 'active' ? 'published' : 'delisted',
          etsyListingId: prod.etsyListingId || '',
          etsyUrl: prod.etsyUrl || '',
          etsyStatus: prod.etsyListingId && prod.status === 'active' ? 'published' : 'delisted',
          poshmarkListingId: prod.poshmarkListingId || '',
          poshmarkUrl: prod.poshmarkUrl || '',
          poshmarkStatus: prod.poshmarkListingId && prod.status === 'active' ? 'published' : 'delisted',
          depopListingId: prod.depopListingId || '',
          depopUrl: prod.depopUrl || '',
          depopStatus: prod.depopListingId && prod.status === 'active' ? 'published' : 'delisted'
        });
        
        await listing.save();
        createdCount++;
        console.log(`Created Listing for: "${prod.title}" (SKU: "${listing.sku}") | Status: ${listing.status}`);
      }
    }
    
    console.log(`Successfully restored ${createdCount} listings!`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
