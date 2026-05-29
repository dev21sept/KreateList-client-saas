const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize automated cron jobs
const { initCronJobs } = require('./utils/cronJobs');
initCronJobs();

const app = express();
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
// Middleware
app.use(cors());
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Elister.ai API is running...' });
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
