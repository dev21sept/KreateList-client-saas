const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');
const Listing = require('../models/Listing');

async function checkProduct() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister');
    
    // Check in Listing or Product
    const id = '6a3fb0fa928322b7b5f3de01';
    let doc = await Listing.findById(id);
    if (!doc) {
      doc = await Product.findById(id);
    }
    
    if (!doc) {
      console.log('Document not found in Listings or Products.');
    } else {
      console.log('Document details:');
      console.log(JSON.stringify({
        title: doc.title,
        category: doc.category,
        categoryId: doc.categoryId,
        size: doc.size,
        quantity: doc.quantity,
        platform: doc.platform
      }, null, 2));
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkProduct();
