const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const Listing = require('./models/Listing');
  const ids = ['6a2ca65fdc210d31783ad242', '6a2ca685dc210d31783ad243', '6a2ca65fdc210d31783ad241'];
  for (const id of ids) {
    const l = await Listing.findById(id);
    if (l) {
      console.log('ID:', id);
      console.log('SKU:', l.sku);
      console.log('itemSpecifics:', JSON.stringify(l.itemSpecifics));
    } else {
      console.log('Not found:', id);
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
