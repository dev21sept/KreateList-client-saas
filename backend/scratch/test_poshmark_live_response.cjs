const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const { scrapePoshmarkCloset } = require('./services/externalImportService');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const user = await User.findOne({ email: 'dev@gmail.com' });
    const cleanUsername = user.poshmarkAccount.username;
    console.log('Username:', cleanUsername);
    
    const scraped = await scrapePoshmarkCloset(cleanUsername, user.poshmarkAccount);
    console.log(`Scrape returned ${scraped.length} items.`);
    
    // Now simulate the database check in poshmarkGetLive before our fix
    // It used to do: Product.findOne({ user: user._id, sku: item.sku })
    // Let's print which products it matched for each scraped item!
    for (const item of scraped) {
      console.log(`\nScraped item title: "${item.title}" | SKU: "${item.sku}"`);
      if (item.sku) {
        const matchedOld = await Product.findOne({ user: user._id, sku: item.sku });
        console.log(`  Matched BEFORE fix: ${matchedOld ? `"${matchedOld.title}" (Source: ${matchedOld.source}, ID: ${matchedOld._id})` : 'None'}`);
        
        const matchedNew = await Product.findOne({ user: user._id, sku: item.sku, source: 'poshmark' });
        console.log(`  Matched AFTER fix: ${matchedNew ? `"${matchedNew.title}" (Source: ${matchedNew.source}, ID: ${matchedNew._id})` : 'None'}`);
      }
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
