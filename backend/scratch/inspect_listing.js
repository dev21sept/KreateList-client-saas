const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const listing = await mongoose.connection.db.collection('listings').findOne({ _id: new mongoose.Types.ObjectId('6a3850d701f52785ceeca5f8') });
    console.log(JSON.stringify(listing, null, 2));
    await mongoose.disconnect();
}

run().catch(console.error);
