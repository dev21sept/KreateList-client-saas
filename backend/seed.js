const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding...');

    const adminEmail = 'support@elister.ai';
    const adminPassword = 'admin123';

    // Check if admin exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log('Admin already exists. Updating password and role...');
      admin.password = adminPassword; // User model handles hashing on save
      admin.role = 'admin';
      await admin.save();
    } else {
      console.log('Creating new admin user...');
      admin = await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: adminEmail,
        password: adminPassword, // User model handles hashing on create
        role: 'admin',
        subscription: {
          status: 'active',
          plan: 'enterprise'
        }
      });
    }

    console.log('Admin user seeded successfully!');
    process.exit();
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
};

seedAdmin();
