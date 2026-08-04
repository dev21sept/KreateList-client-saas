const mongoose = require('mongoose');
const Listing = require('./models/Listing');
const Product = require('./models/Product');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  const id = '6a6fc83adc55972f89b4d10c';
  try {
    let listing = await Listing.findById(id);
    console.log('Listing found directly:', !!listing);
    
    if (!listing) {
      const prod = await Product.findById(id);
      console.log('Product found:', !!prod);
      if (prod) {
        console.log('Product details:', {
          title: prod.title,
          sku: prod.sku,
          user: prod.user,
          etsyListingId: prod.etsyListingId
        });
        
        listing = await Listing.findOne({ user: prod.user, sku: prod.sku });
        console.log('Listing found by SKU:', !!listing);
        
        if (!listing) {
          console.log('Creating listing from product...');
          listing = new Listing({
            _id: prod._id,
            user: prod.user,
            title: prod.title,
            description: prod.description || prod.title,
            sku: prod.sku,
            brand: prod.brand,
            size: prod.size,
            color: prod.color,
            category: prod.category_name || prod.category || 'Clothing',
            categoryId: prod.categoryId,
            itemSpecifics: prod.itemSpecifics || {},
            price: prod.selling_price || 0,
            images: prod.images || [],
            status: 'draft'
          });
          if (prod.ebayListingId) {
            listing.ebayListingId = prod.ebayListingId;
            listing.ebayUrl = prod.ebayUrl;
            listing.ebayStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.etsyListingId) {
            listing.etsyListingId = prod.etsyListingId;
            listing.etsyUrl = prod.etsyUrl;
            listing.etsyStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.poshmarkListingId) {
            listing.poshmarkListingId = prod.poshmarkListingId;
            listing.poshmarkUrl = prod.poshmarkUrl;
            listing.poshmarkStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.depopListingId) {
            listing.depopListingId = prod.depopListingId;
            listing.depopUrl = prod.depopUrl;
            listing.depopStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          await listing.save();
          console.log('Successfully saved new listing!');
        }
      }
    }
  } catch (err) {
    console.error('Error occurred in getListing logic:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
