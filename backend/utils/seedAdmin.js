const User = require('../models/User');

const seedAdminOnStartup = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'valisting@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin exists
    const admin = await User.findOne({ email: adminEmail });

    if (admin) {
      let isModified = false;
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        isModified = true;
      }
      if (admin.subscription?.status !== 'active') {
        admin.subscription = {
          ...admin.subscription,
          status: 'active',
          plan: 'enterprise'
        };
        isModified = true;
      }
      if (isModified) {
        await admin.save();
        console.log(`[Auto-Seed] Updated existing user ${adminEmail} to admin/active status.`);
      }
    } else {
      console.log(`[Auto-Seed] Admin user not found. Creating new admin user: ${adminEmail}...`);
      await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: adminEmail,
        password: adminPassword, // Will be hashed automatically by User model pre-save hook
        role: 'admin',
        subscription: {
          status: 'active',
          plan: 'enterprise'
        }
      });
      console.log(`[Auto-Seed] Admin user ${adminEmail} created successfully.`);
    }
  } catch (error) {
    console.error(`[Auto-Seed] Error seeding admin on startup: ${error.message}`);
  }
};

module.exports = seedAdminOnStartup;
