const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const user = await mongoose.connection.db.collection('users').findOne({ email: "dev@gmail.com" });
    console.log(`User: ${user.firstName} ${user.lastName}`);
    console.log("ebayAccount:", JSON.stringify(user.ebayAccount, null, 2));
    console.log("linkedEbayUsernames:", user.linkedEbayUsernames);
    await mongoose.disconnect();
}

run().catch(console.error);
