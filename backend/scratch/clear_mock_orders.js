const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../models/Order');

// Load environment variables
dotenv.config();

const clearMockOrders = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elister';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Delete all orders starting with 'SL-' (which represents mock/demo sales)
    const result = await Order.deleteMany({ orderId: /^SL-/ });
    console.log(`Successfully deleted ${result.deletedCount} mock sales orders.`);

    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing mock orders:', error.message);
    process.exit(1);
  }
};

clearMockOrders();
