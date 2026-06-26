const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/elister').then(async () => {
  const User = require('./models/User');
  const u = await User.findOne({ email: 'theantiquestuff@gmail.com' });
  if (u && u.poshmarkAccount) {
    const cookieStr = u.poshmarkAccount.sessionCookie || '';
    console.log('Cookie string length:', cookieStr.length);
    console.log('Cookie parts:');
    const cookies = cookieStr.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      console.log(`  Name: ${name} | Val: ${val ? val.substring(0, 30) : 'undefined'}`);
    }
  } else {
    console.log('User not found!');
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
