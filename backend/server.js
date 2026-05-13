const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'KreateList API is running...' });
});

// Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));
// eBay Routes
app.use('/api/ebay', require('./routes/ebayRoutes'));
// Listing Routes
app.use('/api/listings', require('./routes/listingRoutes'));
// Rule Routes
app.use('/api/rules', require('./routes/ruleRoutes'));
// Subscription Routes
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
// Admin Routes
app.use('/api/admin', require('./routes/adminRoutes'));
// AI Routes
app.use('/api/ai', require('./routes/aiRoutes'));

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
