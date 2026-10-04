const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const dns = require('dns');
const { apiLimiter, authLimiter, pricingLimiter } = require('./middleware/rateLimits');

// Force IPv4 first to ensure backend traffic routes through VPN
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}

// Connect to database
connectDB();

// Initialize automated cron jobs
const { initCronJobs } = require('./utils/cronJobs');
initCronJobs();

// Note: Etsy and Mercari logo assets are served directly from the frontend public directory.

const app = express();

// Middleware
app.set('trust proxy', 1);

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const defaultOrigins = [
  'https://elister.ai',
  'https://www.elister.ai',
  'https://app.elister.ai'
];
if (process.env.NODE_ENV !== 'production') {
  defaultOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

app.use(cors({
  origin(origin, callback) {
    const isBrowserExtension = origin && origin.startsWith('chrome-extension://');
    if (!origin || allowedOrigins.has(origin) || isBrowserExtension) {
      return callback(null, true);
    }
    // Disallowed origins get no CORS headers instead of a 500 error response.
    return callback(null, false);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Streamlined API request logging (skips static uploads and preflight options)
app.use(morgan('dev', {
  skip: (req) => req.url.startsWith('/uploads') || req.method === 'OPTIONS'
}));
// Stripe requires the exact raw bytes to validate webhook signatures. This
// parser must be registered before express.json().
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json', limit: '2mb' }));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: process.env.REQUEST_BODY_LIMIT || '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/v1/pricing', pricingLimiter);

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
// Pricing Engine Routes
app.use('/api/v1/pricing', require('./routes/pricingRoutes'));


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
