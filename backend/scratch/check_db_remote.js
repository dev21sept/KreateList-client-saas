const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/elister').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({});
  console.log(JSON.stringify(users.map(u => ({
    email: u.email,
    poshmarkAccount: {
      connected: u.poshmarkAccount?.connected,
      username: u.poshmarkAccount?.username,
      hasPoshmarkSession: u.poshmarkAccount?.sessionCookie?.includes('_poshmark_session='),
      hasJwt: u.poshmarkAccount?.sessionCookie?.includes('jwt='),
      csrfToken: !!u.poshmarkAccount?.csrfToken,
      connectedAt: u.poshmarkAccount?.connectedAt
    }
  })), null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
