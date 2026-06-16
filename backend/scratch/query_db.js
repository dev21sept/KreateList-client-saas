const fs = require('fs');
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/elister')
  .then(async () => {
    const Listing = mongoose.model('Listing', new mongoose.Schema({}, { strict: false }));
    const jeans = await Listing.find(
      { platform: 'poshmark', category: /Jeans/i },
      { images: 0, thumbnail: 0, description: 0 }
    ).limit(10);
    
    let out = `Found ${jeans.length} Jeans listings:\n`;
    jeans.forEach(j => {
      out += JSON.stringify(j.toObject(), null, 2) + "\n\n";
    });
    
    fs.writeFileSync('/tmp/query_db.txt', out, 'utf8');
    console.log("Database results written to /tmp/query_db.txt successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
