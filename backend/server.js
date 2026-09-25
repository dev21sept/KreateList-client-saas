const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const dns = require('dns');

// Force IPv4 first to ensure backend traffic routes through VPN
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Connect to database
connectDB();

// Initialize automated cron jobs
const { initCronJobs } = require('./utils/cronJobs');
initCronJobs();

// Note: Etsy and Mercari logo assets are served directly from the frontend public directory.

const app = express();

// Middleware
app.use(cors());
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Streamlined API request logging (skips static uploads and preflight options)
app.use(morgan('dev', {
  skip: (req) => req.url.startsWith('/uploads') || req.method === 'OPTIONS'
}));
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Elister.ai API is running...' });
});

// Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));
// eBay Routes
app.use('/api/ebay', require('./routes/ebayRoutes'));
// eBay Bulk Listing Routes
app.use('/api/bulklistingebay', require('./routes/bulkListingEbayRoutes'));
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
// Poshmark Routes
app.use('/api/poshmark', require('./routes/poshmarkRoutes'));
// Depop Routes
app.use('/api/depop', require('./routes/depopRoutes'));
// Etsy Routes
app.use('/api/etsy', require('./routes/etsyRoutes'));
// Mercari Routes
app.use('/api/mercari', require('./routes/mercariRoutes'));
// Amazon Routes
app.use('/api/amazon', require('./routes/amazonRoutes'));
// Sales Orders Routes
app.use('/api/orders', require('./routes/orderRoutes'));


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
