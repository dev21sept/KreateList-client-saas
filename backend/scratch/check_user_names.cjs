const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const users = await User.find({});
    console.log(`Found ${users.length} users:`);
    users.forEach((u, idx) => {
      console.log(`${idx + 1}. Name: "${u.name}" | Email: "${u.email}" | Connected: ebay=${!!u.ebayAccount?.connected}, etsy=${!!u.etsyAccount?.connected}, posh=${!!u.poshmarkAccount?.connected}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
