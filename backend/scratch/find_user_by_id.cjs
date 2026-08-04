const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/elister');
  console.log('MongoDB Connected');

  try {
    const user = await User.findById('6a11940b4e123a5c21541803');
    if (user) {
      console.log(`User found: Name="${user.name}" | Email="${user.email}"`);
    } else {
      console.log('User not found!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
