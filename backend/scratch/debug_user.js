const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/elister')
  .then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.findOne({ 'poshmarkAccount.username': { $exists: true, $ne: '' } });
    if (!u) {
      console.log('No user found');
    } else {
      console.log('Username:', u.poshmarkAccount.username);
      console.log('CSRF Token length:', u.poshmarkAccount.csrfToken?.length);
      console.log('CSRF Token:', u.poshmarkAccount.csrfToken);
      console.log('Cookie length:', u.poshmarkAccount.sessionCookie?.length);
      console.log('Cookie:', u.poshmarkAccount.sessionCookie);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
