const mongoose = require('mongoose');
const Listing = require('./models/Listing');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({});
    console.log(`Checking ${products.length} products for mismatched listing IDs...`);

    let correctedCount = 0;
    for (const prod of products) {
      // Find listing with the same SKU but different _id than prod._id
      const mismatchedListing = await Listing.findOne({ 
        sku: prod.sku, 
        _id: { $ne: prod._id } 
      });

      if (mismatchedListing) {
        console.log(`Found mismatched listing for SKU: ${prod.sku}`);
        console.log(`  Product ID: ${prod._id} | Listing ID: ${mismatchedListing._id}`);
        
        // Delete the mismatched listing
        await Listing.deleteOne({ _id: mismatchedListing._id });
        console.log(`  Deleted mismatched listing: ${mismatchedListing._id}`);

        // Recreate it with the exact Product ID
        const newListing = new Listing({
          _id: prod._id,
          user: prod.user,
          title: mismatchedListing.title || prod.title,
          description: mismatchedListing.description || prod.description || prod.title,
          sku: prod.sku,
          brand: mismatchedListing.brand || prod.brand,
          size: mismatchedListing.size || prod.size,
          color: mismatchedListing.color || prod.color,
          category: mismatchedListing.category || prod.category_name || prod.category || 'Clothing',
          categoryId: mismatchedListing.categoryId || prod.categoryId,
          itemSpecifics: mismatchedListing.itemSpecifics || prod.itemSpecifics || {},
          price: mismatchedListing.price || prod.selling_price || 0,
          images: mismatchedListing.images || prod.images || [],
          status: mismatchedListing.status || 'draft',
          ebayListingId: mismatchedListing.ebayListingId || prod.ebayListingId,
          ebayUrl: mismatchedListing.ebayUrl || prod.ebayUrl,
          ebayStatus: mismatchedListing.ebayStatus,
          etsyListingId: mismatchedListing.etsyListingId || prod.etsyListingId,
          etsyUrl: mismatchedListing.etsyUrl || prod.etsyUrl,
          etsyStatus: mismatchedListing.etsyStatus,
          poshmarkListingId: mismatchedListing.poshmarkListingId || prod.poshmarkListingId,
          poshmarkUrl: mismatchedListing.poshmarkUrl || prod.poshmarkUrl,
          poshmarkStatus: mismatchedListing.poshmarkStatus,
          depopListingId: mismatchedListing.depopListingId || prod.depopListingId,
          depopUrl: mismatchedListing.depopUrl || prod.depopUrl,
          depopStatus: mismatchedListing.depopStatus
        });

        await newListing.save();
        console.log(`  Recreated listing with correct ID: ${prod._id}`);
        correctedCount++;
      }
    }
    console.log(`Migration complete. Corrected ${correctedCount} listings.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
