const mongoose = require('mongoose');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const products = await Product.find({});
    console.log(`Scanning ${products.length} products to restore corrupted channel sources...`);

    let fixedCount = 0;
    for (const prod of products) {
      let correctedSource = null;
      
      // Determine the true source based on listing IDs
      if (prod.poshmarkListingId && !prod.ebayListingId && !prod.etsyListingId && !prod.depopListingId) {
        correctedSource = 'poshmark';
      } else if (prod.depopListingId && !prod.ebayListingId && !prod.etsyListingId && !prod.poshmarkListingId) {
        correctedSource = 'depop';
      } else if (prod.etsyListingId && !prod.ebayListingId && !prod.poshmarkListingId && !prod.depopListingId) {
        correctedSource = 'etsy';
      } else if (prod.sku && prod.sku.startsWith('P-') && prod.source === 'ebay') {
        correctedSource = 'poshmark';
      } else if (prod.sku && prod.sku.startsWith('D-') && prod.source === 'ebay') {
        correctedSource = 'depop';
      }

      if (correctedSource && prod.source !== correctedSource) {
        console.log(`Restoring product "${prod.title}":`);
        console.log(`  Current Source: "${prod.source}" -> Corrected Source: "${correctedSource}"`);
        
        prod.source = correctedSource;
        await prod.save();
        fixedCount++;
      }
    }
    
    console.log(`Migration complete. Fixed ${fixedCount} corrupted product records.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
