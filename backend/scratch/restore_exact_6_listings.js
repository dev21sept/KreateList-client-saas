const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Product = require('./models/Product');
    const Listing = require('./models/Listing');
    
    const userId = '6a11940b4e123a5c21541803';
    
    // 1. Fetch the 2 original listings to keep
    const originalSkus = ['KL8A-65201-77724-98801', 'KL53A'];
    const originalListings = await Listing.find({ user: userId, sku: { $in: originalSkus } });
    
    console.log(`Original listings found in DB to keep: ${originalListings.length}`);
    for (const l of originalListings) {
      console.log(`Keeping: "${l.title}" | SKU: "${l.sku}" | Status: ${l.status}`);
    }
    
    // 2. Delete ALL listings for this user first
    const deleteRes = await Listing.deleteMany({ user: userId });
    console.log(`Deleted all ${deleteRes.deletedCount} listings for user dev@gmail.com to start fresh.`);
    
    // 3. Restore the 2 original listings
    for (const l of originalListings) {
      // Re-save original listing document (remove __v if exists)
      const plainObj = l.toObject();
      delete plainObj.__v;
      const newL = new Listing(plainObj);
      await newL.save();
      console.log(`Restored original listing: "${newL.title}"`);
    }
    
    // 4. Create draft listings for the 4 specific products the user wants
    const targetProductTitles = [
      "H&M Women's Pink Floral Summer Romper Romper Size 10",
      "Magicsuit Womens Palm Green Dress Size 14",
      "Jordan Air Retro 3 White University Blue Cement Sneakers Size 10 Men's Shoes",
      "Nike Nylon Vintage Green Windbreaker Jacket Size Large"
    ];
    
    let draftCount = 0;
    for (const title of targetProductTitles) {
      // CRITICAL: Filter by user to get the product that belongs to dev@gmail.com!
      const prod = await Product.findOne({ user: userId, title });
      if (prod) {
        const generatedSku = prod.sku || ('KL-SYNCED-' + prod._id.toString().slice(-6).toUpperCase());
        const listing = new Listing({
          user: userId, // Ensure it's dev@gmail.com
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
          status: 'draft', // User wants them as drafts in local database
          ebayListingId: prod.ebayListingId || '',
          ebayUrl: prod.ebayUrl || '',
          ebayStatus: prod.ebayListingId ? 'published' : 'delisted',
          etsyListingId: prod.etsyListingId || '',
          etsyUrl: prod.etsyUrl || '',
          etsyStatus: prod.etsyListingId ? 'published' : 'delisted',
          poshmarkListingId: prod.poshmarkListingId || '',
          poshmarkUrl: prod.poshmarkUrl || '',
          poshmarkStatus: prod.poshmarkListingId ? 'published' : 'delisted',
          depopListingId: prod.depopListingId || '',
          depopUrl: prod.depopUrl || '',
          depopStatus: prod.depopListingId ? 'published' : 'delisted'
        });
        
        await listing.save();
        draftCount++;
        console.log(`Restored draft listing: "${listing.title}" | SKU: "${listing.sku}"`);
      } else {
        console.warn(`Product not found for title: "${title}" and user dev@gmail.com`);
      }
    }
    
    // Verify count
    const finalCount = await Listing.countDocuments({ user: userId });
    console.log(`Final Listing count for user dev@gmail.com: ${finalCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
