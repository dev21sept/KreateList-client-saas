const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users in DB.`);
    users.forEach((u, i) => {
        console.log(`[${i}] ID: ${u._id}`);
        console.log(`    Name: "${u.firstName} ${u.lastName}"`);
        console.log(`    Email: "${u.email}"`);
        console.log(`    Plan: "${u.subscription?.plan}"`);
        console.log(`    eBay Connected: ${u.ebayAccount?.connected} (${u.ebayAccount?.username})`);
    });
    await mongoose.disconnect();
}

run().catch(console.error);
