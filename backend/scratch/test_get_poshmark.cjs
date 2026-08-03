const mongoose = require('mongoose');
const Listing = require('./models/Listing');
const Product = require('./models/Product');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const prod = await Product.findOne({ source: 'poshmark' });
    if (!prod) {
      console.log('No Poshmark products found in DB!');
      return;
    }
    
    console.log('Found Poshmark Product ID:', prod._id);
    const id = prod._id.toString();
    
    let listing = await Listing.findById(id);
    console.log('Listing found directly:', !!listing);
    
    if (!listing) {
      const prodObj = await Product.findById(id);
      console.log('Product found:', !!prodObj);
      if (prodObj) {
        console.log('Product details:', {
          title: prodObj.title,
          sku: prodObj.sku,
          user: prodObj.user,
          poshmarkListingId: prodObj.poshmarkListingId
        });
        
        listing = await Listing.findOne({ user: prodObj.user, sku: prodObj.sku });
        console.log('Listing found by SKU:', !!listing);
        
        if (!listing) {
          console.log('Creating listing from product...');
          listing = new Listing({
            user: prodObj.user,
            title: prodObj.title,
            description: prodObj.description || prodObj.title,
            sku: prodObj.sku,
            brand: prodObj.brand,
            size: prodObj.size,
            color: prodObj.color,
            category: prodObj.category_name || prodObj.category || 'Clothing',
            categoryId: prodObj.categoryId,
            itemSpecifics: prodObj.itemSpecifics || {},
            price: prodObj.selling_price || 0,
            images: prodObj.images || [],
            status: 'draft'
          });
          if (prodObj.ebayListingId) {
            listing.ebayListingId = prodObj.ebayListingId;
            listing.ebayUrl = prodObj.ebayUrl;
            listing.ebayStatus = prodObj.status === 'active' ? 'published' : 'delisted';
          }
          if (prodObj.etsyListingId) {
            listing.etsyListingId = prodObj.etsyListingId;
            listing.etsyUrl = prodObj.etsyUrl;
            listing.etsyStatus = prodObj.status === 'active' ? 'published' : 'delisted';
          }
          if (prodObj.poshmarkListingId) {
            listing.poshmarkListingId = prodObj.poshmarkListingId;
            listing.poshmarkUrl = prodObj.poshmarkUrl;
            listing.poshmarkStatus = prodObj.status === 'active' ? 'published' : 'delisted';
          }
          if (prodObj.depopListingId) {
            listing.depopListingId = prodObj.depopListingId;
            listing.depopUrl = prodObj.depopUrl;
            listing.depopStatus = prodObj.status === 'active' ? 'published' : 'delisted';
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
