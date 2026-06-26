const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const User = require('./models/User');
  const u = await User.findOne({ email: /nick/i });
  if (u) {
    console.log('User found:', u.email);
    console.log('ID:', u._id);
    console.log('Poshmark Connected:', u.poshmarkAccount?.connected);
    console.log('Poshmark Username:', u.poshmarkAccount?.username);
    console.log('Poshmark Cookie:', u.poshmarkAccount?.sessionCookie);
    console.log('Poshmark Csrf:', u.poshmarkAccount?.csrfToken);
  } else {
    console.log('User not found by email!');
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
