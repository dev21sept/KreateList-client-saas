const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const User = require('./models/User');
  const users = await User.find({});
  console.log(`Total users: ${users.length}`);
  for (const u of users) {
    console.log(`ID: ${u._id} | Email: ${u.email} | Poshmark: ${u.poshmarkAccount?.connected} | Poshmark Username: ${u.poshmarkAccount?.username}`);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
