const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const listings = await mongoose.connection.db.collection('listings').find({}).toArray();
    console.log(`Found ${listings.length} listings in DB.`);
    listings.slice(0, 10).forEach((l, i) => {
        console.log(`[${i}] Title: "${l.title}" | Status: ${l.status}`);
        console.log(`    ebayListingId: "${l.ebayListingId}" (${typeof l.ebayListingId})`);
        console.log(`    poshmarkListingId: "${l.poshmarkListingId}" (${typeof l.poshmarkListingId})`);
        console.log(`    depopListingId: "${l.depopListingId}" (${typeof l.depopListingId})`);
        console.log(`    vintedListingId: "${l.vintedListingId}" (${typeof l.vintedListingId})`);
    });
    await mongoose.disconnect();
}

run().catch(console.error);
