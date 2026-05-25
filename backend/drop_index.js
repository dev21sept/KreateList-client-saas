const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/elister');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    const collections = await conn.connection.db.listCollections({ name: 'listings' }).toArray();
    if (collections.length > 0) {
      console.log('Listings collection exists. Dropping index "sku_1"...');
      try {
        await conn.connection.db.collection('listings').dropIndex('sku_1');
        console.log('Successfully dropped "sku_1" index!');
      } catch (indexErr) {
        console.log('Index "sku_1" might not exist or was already dropped:', indexErr.message);
      }
    } else {
      console.log('Listings collection does not exist.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

connectDB();
