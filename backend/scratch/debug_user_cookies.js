const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/elister');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.findOne({ 'poshmarkAccount.username': { $exists: true, $ne: '' } });
    if (!u) {
      console.log('No user found');
      process.exit(0);
    }

    console.log('User found:', u.email);
    console.log('Poshmark username:', u.poshmarkAccount.username);
    console.log('Connected:', u.poshmarkAccount.connected);
    const cookies = u.poshmarkAccount.sessionCookie || '';
    console.log('Has _poshmark_session:', cookies.includes('_poshmark_session='));
    console.log('Has jwt:', cookies.includes('jwt='));
    console.log('Cookie Preview:', cookies.substring(0, 150) + '...');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
