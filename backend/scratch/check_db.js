const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/elister';

(async () => {
  try {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB!');

    const User = require('../models/User');
    const users = await User.find({});
    console.log(`Found ${users.length} user(s) in the database.\n`);

    users.forEach((user, idx) => {
      console.log(`User #${idx + 1}: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log('Depop Account Details in DB:');
      console.log(JSON.stringify(user.depopAccount, null, 2));
      console.log('--------------------------------------------------\n');
    });

  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
})();
