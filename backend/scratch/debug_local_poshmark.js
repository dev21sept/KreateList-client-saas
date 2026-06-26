const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const User = require('../models/User');
  const u = await User.findById("6a1571887a41852eef0fdda5");
  if (u) {
    console.log('User Email:', u.email);
    console.log('Cookie:', u.poshmarkAccount?.sessionCookie);
    console.log('Csrf:', u.poshmarkAccount?.csrfToken);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
