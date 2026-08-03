const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { normalizeProductImages, generateThumbnail } = require('../utils/imageProcessor');
const ebayService = require('../services/ebayService');
const { getValidToken } = require('./ebayController');
const { sanitizeEbayDescription } = require('../services/descriptionService');

const isAspectValueInvalid = (val) => {
  if (typeof val !== 'string') return true;
  const clean = val.trim().toLowerCase();
  if (!clean || clean === '' || clean === '-' || clean === 'none' || clean === 'n/a' || clean === 'not applicable') {
    return true;
  }
  const isZero = /^(0+(\.0+)?)\s*(oz|gsm|g|lbs|lb|kg|ml|oz\.)?$/i.test(clean);
  return isZero;
};


// @desc    Get all listings for a user
// @route   GET /api/listings
// @access  Private
exports.getListings = async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.id })
      .select('-description -itemSpecifics -images')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: listings.length, data: listings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get dashboard stats for a user
// @route   GET /api/listings/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const totalListings = await Listing.countDocuments({ user: userId });
    const publishedListings = await Listing.countDocuments({ user: userId, status: 'published' });
    const draftListings = await Listing.countDocuments({ user: userId, status: 'draft' });
    const scheduledListings = await Listing.countDocuments({ user: userId, status: 'scheduled' });
    const failedListings = await Listing.countDocuments({ user: userId, status: 'failed' });

    const recentActivity = await Listing.find({ user: userId })
      .select('-description -itemSpecifics -images')
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch raw data from DB in one go
    const allUserListings = await Listing.find({ user: userId }).select('status createdAt platform source');
    const allUserProducts = await Product.find({ user: userId }).select('source updated_at createdAt');

    // 1. Listings Overview Line Chart Data (Weekly, Monthly, Yearly)
    // Weekly (Last 7 Days)
    const weeklyChartData = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklyChartData.push({
        label: days[d.getDay()],
        dateStr: d.toLocaleDateString(),
        dayNum: d.getDate(),
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        total: 0,
        published: 0,
        draft: 0
      });
    }

    allUserListings.forEach(l => {
      if (!l.createdAt) return;
      const date = new Date(l.createdAt);
      const bucket = weeklyChartData.find(b => b.dayNum === date.getDate() && b.monthNum === date.getMonth() && b.year === date.getFullYear());
      if (bucket) {
        bucket.total++;
        if (l.status === 'published') bucket.published++;
        if (l.status === 'draft') bucket.draft++;
      }
    });

    // Monthly (Last 30 Days in 5-day intervals)
    const monthlyChartData = [];
    const bucketLabels = ['Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'];
    for (let i = 0; i < 6; i++) {
      monthlyChartData.push({
        label: bucketLabels[i],
        total: 0,
        published: 0,
        draft: 0
      });
    }

    const now = new Date();
    allUserListings.forEach(l => {
      if (!l.createdAt) return;
      const date = new Date(l.createdAt);
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        const group = Math.floor(diffDays / 5); // 0 to 6
        const bucketIndex = Math.max(0, Math.min(5, 5 - group));
        const bucket = monthlyChartData[bucketIndex];
        if (bucket) {
          bucket.total++;
          if (l.status === 'published') bucket.published++;
          if (l.status === 'draft') bucket.draft++;
        }
      }
    });

    // Yearly (Last 12 Months)
    const yearlyChartData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      yearlyChartData.push({
        label: months[d.getMonth()],
        monthName: months[d.getMonth()],
        year: d.getFullYear(),
        monthNum: d.getMonth(),
        total: 0,
        published: 0,
        draft: 0
      });
    }

    allUserListings.forEach(l => {
      if (!l.createdAt) return;
      const date = new Date(l.createdAt);
      const bucket = yearlyChartData.find(b => b.monthNum === date.getMonth() && b.year === date.getFullYear());
      if (bucket) {
        bucket.total++;
        if (l.status === 'published') bucket.published++;
        if (l.status === 'draft') bucket.draft++;
      }
    });

    // 2. Platform Metrics Chart Data (Weekly, Monthly, Yearly)
    const nowMs = Date.now();
    const oneWeekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
    const oneYearAgo = nowMs - 5 * 365 * 24 * 60 * 60 * 1000; // Extend to 5 years to cover all seeded/historical listings

    const getMetricsForTimeframe = (sinceDate) => {
       const fetched = { ebay: 0, poshmark: 0, depop: 0, etsy: 0 };
      const listed = { ebay: 0, poshmark: 0, depop: 0, etsy: 0 };

      allUserListings.forEach(l => {
        const date = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        if (date >= sinceDate) {
          // Fetched mode counts all generated/fetched listings grouped by their platform
          const src = (l.platform || 'ebay').toLowerCase();
          if (src === 'ebay') fetched.ebay++;
          else if (src === 'poshmark') fetched.poshmark++;
          else if (src === 'depop') fetched.depop++;
          else if (src === 'etsy') fetched.etsy++;

          // Listed mode counts only active published listings grouped by target platform
          if (l.status === 'published') {
            if (l.platform === 'ebay') listed.ebay++;
            else if (l.platform === 'poshmark') listed.poshmark++;
            else if (l.platform === 'depop') listed.depop++;
            else if (l.platform === 'etsy') listed.etsy++;
          }
        }
      });

      return { fetched, listed };
    };

    const weeklyMetrics = getMetricsForTimeframe(oneWeekAgo);
    const monthlyMetrics = getMetricsForTimeframe(oneMonthAgo);
    const yearlyMetrics = getMetricsForTimeframe(oneYearAgo);
    const allTimeMetrics = getMetricsForTimeframe(0);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total: totalListings,
          published: publishedListings,
          draft: draftListings,
          scheduled: scheduledListings,
          failed: failedListings
        },
        recentActivity,
        charts: {
          lineChart: {
            weekly: weeklyChartData,
            monthly: monthlyChartData,
            yearly: yearlyChartData
          },
          pieChart: {
            weekly: weeklyMetrics,
            monthly: monthlyMetrics,
            yearly: yearlyMetrics,
            allTime: allTimeMetrics
          }
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private
exports.createListing = async (req, res) => {
  try {
    req.body.user = req.user.id;

    // Convert base64 images to static files and get absolute URLs
    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = await normalizeProductImages(req.body.images, baseUrl);
      if (req.body.images.length > 0) {
        req.body.thumbnail = await generateThumbnail(req.body.images[0]);
      } else {
        req.body.thumbnail = '';
      }
    }

    if (!req.body.sku) {
      return res.status(400).json({ 
        success: false, 
        message: 'SKU is required.' 
      });
    }

    const platform = req.body.platform || 'ebay';
    req.body[`${platform}Status`] = req.body.status || 'draft';

    const existing = await Listing.findOne({ user: req.user.id, sku: req.body.sku });
    if (existing) {
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy'];
      platforms.forEach(p => {
        if (existing[`${p}Status`] && existing[`${p}Status`] !== 'none' && !req.body[`${p}Status`]) {
          req.body[`${p}Status`] = existing[`${p}Status`];
        }
      });
      const idFields = ['ebayListingId', 'ebayUrl', 'poshmarkListingId', 'poshmarkUrl', 'depopListingId', 'depopUrl', 'etsyListingId', 'etsyUrl'];
      idFields.forEach(f => {
        if (existing[f] && !req.body[f]) {
          req.body[f] = existing[f];
        }
      });

      const updated = await Listing.findByIdAndUpdate(existing._id, req.body, { new: true, runValidators: true });
      return res.status(201).json({ success: true, data: updated });
    }

    const listing = await Listing.create(req.body);
    res.status(201).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single listing
// @route   GET /api/listings/:id
// @access  Private
exports.getListing = async (req, res) => {
  try {
    let listing = await Listing.findById(req.params.id);
    if (!listing) {
      const Product = require('../models/Product');
      const prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        const query = { user: req.user.id };
        if (prod.sku && prod.sku.trim()) {
          query.sku = prod.sku.trim();
        } else {
          query._id = prod._id;
        }
        listing = await Listing.findOne(query);
        if (!listing) {
          listing = new Listing({
            _id: prod._id,
            user: req.user.id,
            title: prod.title,
            description: prod.description || prod.title,
            sku: prod.sku && prod.sku.trim() ? prod.sku.trim() : `SKU-${prod._id.toString().substring(18)}`,
            brand: prod.brand,
            size: prod.size,
            color: prod.color,
            category: prod.category_name || prod.category || 'Clothing',
            categoryId: prod.categoryId,
            itemSpecifics: prod.itemSpecifics || {},
            price: prod.selling_price || 0,
            images: prod.images || [],
            status: 'draft'
          });
          if (prod.ebayListingId) {
            listing.ebayListingId = prod.ebayListingId;
            listing.ebayUrl = prod.ebayUrl;
            listing.ebayStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.etsyListingId) {
            listing.etsyListingId = prod.etsyListingId;
            listing.etsyUrl = prod.etsyUrl;
            listing.etsyStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.poshmarkListingId) {
            listing.poshmarkListingId = prod.poshmarkListingId;
            listing.poshmarkUrl = prod.poshmarkUrl;
            listing.poshmarkStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.depopListingId) {
            listing.depopListingId = prod.depopListingId;
            listing.depopUrl = prod.depopUrl;
            listing.depopStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          await listing.save();
        }
      }
    }

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update listing
// @route   PUT /api/listings/:id
// @access  Private
exports.updateListing = async (req, res) => {
  try {
    let listing = await Listing.findById(req.params.id);
    if (!listing) {
      const Product = require('../models/Product');
      const prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        const query = { user: req.user.id };
        if (prod.sku && prod.sku.trim()) {
          query.sku = prod.sku.trim();
        } else {
          query._id = prod._id;
        }
        listing = await Listing.findOne(query);
        if (!listing) {
          listing = new Listing({
            _id: prod._id,
            user: req.user.id,
            title: prod.title,
            description: prod.description || prod.title,
            sku: prod.sku && prod.sku.trim() ? prod.sku.trim() : `SKU-${prod._id.toString().substring(18)}`,
            brand: prod.brand,
            size: prod.size,
            color: prod.color,
            category: prod.category_name || prod.category || 'Clothing',
            categoryId: prod.categoryId,
            itemSpecifics: prod.itemSpecifics || {},
            price: prod.selling_price || 0,
            images: prod.images || [],
            status: 'draft'
          });
          if (prod.ebayListingId) {
            listing.ebayListingId = prod.ebayListingId;
            listing.ebayUrl = prod.ebayUrl;
            listing.ebayStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.etsyListingId) {
            listing.etsyListingId = prod.etsyListingId;
            listing.etsyUrl = prod.etsyUrl;
            listing.etsyStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.poshmarkListingId) {
            listing.poshmarkListingId = prod.poshmarkListingId;
            listing.poshmarkUrl = prod.poshmarkUrl;
            listing.poshmarkStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          if (prod.depopListingId) {
            listing.depopListingId = prod.depopListingId;
            listing.depopUrl = prod.depopUrl;
            listing.depopStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
          await listing.save();
        }
      }
    }

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Convert base64 images to static files and get absolute URLs
    const host = req.get('host');
    const protocol = req.protocol;
    const isProd = host.includes('elister.ai');
    const finalProtocol = isProd ? 'https' : protocol;
    const baseUrl = `${finalProtocol}://${host}`;

    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = await normalizeProductImages(req.body.images, baseUrl);
      
      // Delete old replaced image files from disk
      if (listing.images && Array.isArray(listing.images)) {
        const fs = require('fs');
        const path = require('path');
        const newImages = req.body.images;
        
        listing.images.forEach(oldImg => {
          if (oldImg.includes('/uploads/') && !newImages.includes(oldImg)) {
            const filename = oldImg.split('/uploads/').pop();
            const filepath = path.join(__dirname, '..', 'uploads', filename);
            if (fs.existsSync(filepath)) {
              try {
                fs.unlinkSync(filepath);
                console.log(`[Listing Controller] Deleted replaced image file: ${filepath}`);
              } catch (err) {
                console.error(`[Listing Controller] Error deleting replaced file: ${filepath}`, err.message);
              }
            }
          }
        });
      }

      if (req.body.images.length > 0) {
        req.body.thumbnail = await generateThumbnail(req.body.images[0]);
      } else {
        req.body.thumbnail = '';
      }
    }

    const platform = req.body.platform || listing.platform;
    if (req.body.status) {
      req.body[`${platform}Status`] = req.body.status;
    }

    listing = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    // Live eBay Sync: If listing is listed on eBay, push ALL updates (Aspects/Specifics, Title, Price, Description, Images, Weight, Condition) directly to eBay Inventory API
    if (listing.ebayListingId || (listing.platform === 'ebay' && listing.status === 'published')) {
      try {
        const token = await getValidToken(req.user.id);
        if (token && listing.sku) {
          console.log(`[Listing Controller] Live Syncing ALL data (Item Specifics, Aspects, Title, Price, Images, Condition) to eBay for SKU: ${listing.sku}`);
          
          // Build aspects dictionary
          const aspects = {};
          if (listing.itemSpecifics) {
            const specsObj = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
            for (const [key, value] of Object.entries(specsObj)) {
              if (value && value.length > 0) {
                const filtered = (Array.isArray(value) ? value : [value])
                  .map(v => String(v || ''))
                  .filter(v => !isAspectValueInvalid(v));
                if (filtered.length > 0) {
                  aspects[key] = filtered;
                }
              }
            }
          }

          if (listing.brand && !isAspectValueInvalid(listing.brand) && !aspects['Brand']) aspects['Brand'] = [listing.brand];
          if (listing.color && !isAspectValueInvalid(listing.color) && !aspects['Color']) aspects['Color'] = [listing.color];
          if (listing.size && !isAspectValueInvalid(listing.size) && !aspects['Size']) aspects['Size'] = [listing.size];
          if (listing.material && !isAspectValueInvalid(listing.material) && !aspects['Material']) aspects['Material'] = [listing.material];
          if (listing.styleTag && !isAspectValueInvalid(listing.styleTag) && !aspects['Style']) aspects['Style'] = [listing.styleTag];

          const resolvedConditionId = resolveConditionForCategory(listing.conditionId, []);
          const ebayConditionEnum = mapConditionIdToEnum(resolvedConditionId);

          const packageWeightAndSize = {};
          if (listing.packageWeight) {
            const totalOunces = (listing.packageWeight.lbs || 0) * 16 + (listing.packageWeight.oz || 0);
            if (totalOunces > 0) packageWeightAndSize.weight = { value: totalOunces, unit: 'OUNCE' };
          }
          if (listing.packageDimensions) {
            const { length, width, height } = listing.packageDimensions;
            if (length > 0 || width > 0 || height > 0) {
              packageWeightAndSize.dimensions = { length: length || 0, width: width || 0, height: height || 0, unit: 'INCH' };
            }
          }

          const inventoryItemData = {
            availability: {
              shipToLocationAvailability: {
                quantity: listing.quantity || 1
              }
            },
            condition: ebayConditionEnum,
            product: {
              title: listing.title ? listing.title.substring(0, 80) : '',
              description: sanitizeEbayDescription(listing.description),
              aspects: aspects,
              imageUrls: listing.images && listing.images.length > 0 ? listing.images : ['https://via.placeholder.com/500']
            }
          };

          if (listing.conditionNote) {
            inventoryItemData.conditionDescription = listing.conditionNote;
          }
          if (packageWeightAndSize.weight || packageWeightAndSize.dimensions) {
            inventoryItemData.packageWeightAndSize = packageWeightAndSize;
          }

          await ebayService.createOrReplaceInventoryItem(token, listing.sku, inventoryItemData);

          // Update active offer price & description on eBay
          const existingOffers = await ebayService.getOffers(token, listing.sku);
          if (existingOffers && existingOffers.length > 0) {
            for (const offer of existingOffers) {
              try {
                const updatedOfferPayload = {
                  ...offer,
                  pricingSummary: {
                    price: {
                      value: String(listing.price),
                      currency: 'USD'
                    }
                  },
                  availableQuantity: listing.quantity || 1,
                  listingDescription: sanitizeEbayDescription(listing.description)
                };
                await ebayService.updateOffer(token, offer.offerId, updatedOfferPayload);
              } catch (offErr) {
                console.warn(`[Listing Controller] Offer price update note: ${offErr.message}`);
              }
            }
          }

          console.log(`[Listing Controller] Successfully synced ALL item specifics and data live to eBay for SKU: ${listing.sku}`);
        }
      } catch (ebayErr) {
        console.warn(`[Listing Controller] Failed to sync live changes to eBay API:`, ebayErr.message);
      }
    }

    // Live Etsy Sync: If listing is listed on Etsy, push core updates (Title, Price, Description, Quantity) directly to Etsy
    if (listing.etsyListingId || (listing.platform === 'etsy' && listing.status === 'published')) {
      try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        if (user && user.etsyAccount && user.etsyAccount.connected && user.etsyAccount.shopId && listing.etsyListingId) {
          const etsyService = require('../services/etsyService');
          console.log(`[Listing Controller] Live Syncing core data to Etsy for Listing ID: ${listing.etsyListingId}`);
          await etsyService.updateEtsyListing(req.user.id, user.etsyAccount.shopId, listing.etsyListingId, {
            title: listing.title,
            description: listing.description,
            price: listing.price,
            quantity: listing.quantity || 1,
            who_made: listing.etsyWhoMade || 'i_did',
            when_made: listing.etsyWhenMade || '2020_2026',
            is_supply: listing.etsyIsSupply === true || listing.etsyIsSupply === 'true',
            shipping_profile_id: listing.etsyShippingProfileId || undefined
          });
          console.log(`[Listing Controller] Successfully synced live changes to Etsy for Listing ID: ${listing.etsyListingId}`);
        }
      } catch (etsyErr) {
        console.warn(`[Listing Controller] Failed to sync live changes to Etsy API:`, etsyErr.message);
      }
    }

    // Background Poshmark Sync: If listed on Poshmark, sync changes in background
    if (listing.poshmarkListingId || (listing.platform === 'poshmark' && listing.status === 'published')) {
      (async () => {
        try {
          const User = require('../models/User');
          const user = await User.findById(req.user.id);
          if (user && user.poshmarkAccount && user.poshmarkAccount.connected && user.poshmarkAccount.sessionCookie && listing.poshmarkListingId) {
            console.log(`[Listing Controller] [BG SYNC] Pushing updates to Poshmark for listing: ${listing.title}`);
            const { publishToPoshmark } = require('../services/backendPublishService');
            await publishToPoshmark(listing, user.poshmarkAccount);
            console.log(`[Listing Controller] [BG SYNC] Poshmark updates synced successfully!`);
          }
        } catch (poshErr) {
          console.error(`[Listing Controller] [BG SYNC] Poshmark sync failed:`, poshErr.message);
        }
      })();
    }

    // Background Depop Sync: If listed on Depop and has Partner API integration, sync changes in background
    if (listing.depopListingId || (listing.platform === 'depop' && listing.status === 'published')) {
      (async () => {
        try {
          const User = require('../models/User');
          const user = await User.findById(req.user.id);
          const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || (user && user.depopAccount && user.depopAccount.usePartnerApi));
          const authToken = process.env.DEPOP_PARTNER_API_KEY || user?.depopAccount?.accessToken;
          if (user && user.depopAccount && user.depopAccount.connected && isPartner && authToken && listing.depopListingId) {
            console.log(`[Listing Controller] [BG SYNC] Pushing updates to Depop for listing: ${listing.title}`);
            const { publishToDepop } = require('../services/backendPublishService');
            await publishToDepop(listing, user.depopAccount);
            console.log(`[Listing Controller] [BG SYNC] Depop updates synced successfully!`);
          }
        } catch (depopErr) {
          console.error(`[Listing Controller] [BG SYNC] Depop sync failed:`, depopErr.message);
        }
      })();
    }

    // Automatically update matched Product models cache to keep local Channel Inventory synced!
    try {
      const Product = require('../models/Product');
      const updateFields = {
        title: listing.title,
        description: listing.description,
        selling_price: listing.price,
        brand: listing.brand,
        size: listing.size,
        color: listing.color,
        images: listing.images,
        thumbnail: listing.thumbnail,
        updated_at: Date.now()
      };
      
      // Update by SKU
      if (listing.sku) {
        await Product.updateMany(
          { user: req.user.id, sku: listing.sku },
          { $set: updateFields }
        );
      }
      
      // Update by individual platform listing IDs just in case SKU is missing or mismatching
      if (listing.ebayListingId) {
        await Product.updateMany(
          { user: req.user.id, ebayListingId: listing.ebayListingId },
          { $set: updateFields }
        );
      }
      if (listing.etsyListingId) {
        await Product.updateMany(
          { user: req.user.id, etsyListingId: listing.etsyListingId },
          { $set: updateFields }
        );
      }
      if (listing.poshmarkListingId) {
        await Product.updateMany(
          { user: req.user.id, poshmarkListingId: listing.poshmarkListingId },
          { $set: updateFields }
        );
      }
      if (listing.depopListingId) {
        await Product.updateMany(
          { user: req.user.id, depopListingId: listing.depopListingId },
          { $set: updateFields }
        );
      }
      console.log(`[Listing Controller] Synced matched Product cache records with new listing updates.`);
    } catch (cacheErr) {
      console.warn(`[Listing Controller] Failed to update matched Product cache:`, cacheErr.message);
    }

    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete listing
// @route   DELETE /api/listings/:id
// @access  Private
exports.deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // If listing is published on Depop and Partner API key is available, delete it from Depop
    const user = await User.findById(req.user.id);
    const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || (user && user.depopAccount && user.depopAccount.usePartnerApi));
    const apiKey = process.env.DEPOP_PARTNER_API_KEY || user?.depopAccount?.accessToken;

    if (listing.platform === 'depop' && listing.status === 'published' && isPartner && apiKey && listing.sku) {
      try {
        console.log(`[Listing Controller] Deleting listing from Depop via Partner API... SKU: ${listing.sku}`);
        const { deleteFromDepopPartner } = require('../services/depopPartnerService');
        await deleteFromDepopPartner(listing.sku, apiKey);
      } catch (depopErr) {
        console.error(`[Listing Controller] Failed to delete listing from Depop platform:`, depopErr.message);
        // We proceed with local deletion regardless
      }
    }

    // Delete associated image files from server disk
    if (listing.images && Array.isArray(listing.images)) {
      const fs = require('fs');
      const path = require('path');
      listing.images.forEach(imgUrl => {
        if (imgUrl.includes('/uploads/')) {
          const filename = imgUrl.split('/uploads/').pop();
          const filepath = path.join(__dirname, '..', 'uploads', filename);
          if (fs.existsSync(filepath)) {
            try {
              fs.unlinkSync(filepath);
              console.log(`[Listing Controller] Deleted image file: ${filepath}`);
            } catch (err) {
              console.error(`[Listing Controller] Error deleting file: ${filepath}`, err.message);
            }
          }
        }
      });
    }

    await Listing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Helper to map eBay condition IDs to Inventory API enum strings
function mapConditionIdToEnum(conditionId) {
  const id = String(conditionId || '1000').toLowerCase();
  
  const validEnums = ['NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS', 'USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE', 'FOR_PARTS_OR_NOT_WORKING'];
  if (validEnums.includes(id.toUpperCase())) return id.toUpperCase();

  if (id.startsWith('1000')) {
    if (id.includes('wd') || id.includes('defect')) return 'NEW_WITH_DEFECTS';
    if (id.includes('c') || id.includes('g') || id.includes('f')) return 'USED_EXCELLENT';
    return 'NEW';
  }
  if (id.startsWith('1500') || id.startsWith('1750')) {
    return 'LIKE_NEW';
  }
  if (id.startsWith('2000') || id.startsWith('2500') || id.startsWith('2010') || id.startsWith('2020') || id.startsWith('2030')) {
    return 'USED_EXCELLENT';
  }
  if (id.startsWith('2750')) {
    return 'LIKE_NEW';
  }
  if (id.startsWith('3000')) {
    return 'USED_EXCELLENT';
  }
  if (id.startsWith('4000')) {
    return 'USED_VERY_GOOD';
  }
  if (id.startsWith('5000')) {
    return 'USED_GOOD';
  }
  if (id.startsWith('6000')) {
    return 'USED_ACCEPTABLE';
  }
  if (id.startsWith('7000')) {
    return 'FOR_PARTS_OR_NOT_WORKING';
  }
  
  return 'NEW'; // Default fallback
}

// Helper to resolve the closest supported condition ID for a given category
function resolveConditionForCategory(conditionId, validIds) {
  if (!validIds || validIds.length === 0) {
    return conditionId || '1000';
  }

  const cleanId = String(conditionId || '1000');
  const baseId = cleanId.split('_')[0];

  // 1. Exact match (e.g. "1000", "3000", "1000_c" if it exists in validIds)
  if (validIds.includes(cleanId)) {
    return cleanId;
  }

  // 2. Base ID match (e.g. if selected is "1000_c" and category supports "1000")
  if (validIds.includes(baseId)) {
    return baseId;
  }

  // 3. Fallback logic based on condition types
  const isNewType = baseId.startsWith('1');
  const isUsedType = baseId.startsWith('2') || baseId.startsWith('3') || baseId.startsWith('4') || baseId.startsWith('5') || baseId.startsWith('6');
  const isPartsType = baseId.startsWith('7');

  if (isNewType) {
    if (validIds.includes('1000')) return '1000';
    // Fallback to any other new-like condition supported
    const altNew = validIds.find(id => id.startsWith('1'));
    if (altNew) return altNew;
  } else if (isUsedType) {
    if (validIds.includes('3000')) return '3000';
    // Fallback to any other used-like condition supported
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  } else if (isPartsType) {
    if (validIds.includes('7000')) return '7000';
    if (validIds.includes('3000')) return '3000';
    const altUsed = validIds.find(id => id.startsWith('2') || id.startsWith('3') || id.startsWith('4') || id.startsWith('5') || id.startsWith('6'));
    if (altUsed) return altUsed;
  }

  // Default fallback to first available or 1000
  return validIds[0] || '1000';
}

// @desc    Publish listing to eBay
// @route   POST /api/listings/:id/publish
// @access  Private
exports.publishListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // 1. Resolve a valid user token
    const token = await getValidToken(req.user.id);
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Your eBay account is not connected or session expired. Please connect your eBay account in Settings.' 
      });
    }

    console.log(`[EBAY PUBLISH] User connected, token resolved. Starting publish for SKU: ${listing.sku}`);

    // 2. Ensure merchant location exists on eBay
    let locationKey = listing.locationKey || 'default-location';
    try {
      const locations = await ebayService.getLocations(token);
      const locationExists = locations && locations.some(l => l.merchantLocationKey === locationKey);
      if (!locationExists) {
        if (locations && locations.length > 0) {
          locationKey = locations[0].merchantLocationKey;
        } else {
          const defaultLocationData = {
            location: {
              address: {
                addressLine1: '123 Main St',
                city: 'San Jose',
                stateOrProvince: 'CA',
                postalCode: '95125',
                country: 'US'
              }
            },
            locationWebUrl: 'https://elister.ai',
            name: 'Default Location',
            merchantLocationStatus: 'ENABLED',
            locationTypes: ['STORE']
          };
          await ebayService.createOrUpdateLocation(token, locationKey, defaultLocationData);
        }
      }
    } catch (locErr) {
      console.warn('[EBAY PUBLISH] Merchant location check failed, attempting to use locationKey: ' + locationKey, locErr.message);
    }

    // 3. Upload images to eBay Picture Services (EPS)
    const ebayImageUrls = [];
    if (listing.images && listing.images.length > 0) {
      for (const rawImg of listing.images) {
        const imgUrl = typeof rawImg === 'string' ? rawImg.trim() : '';
        if (!imgUrl) continue;

        const isUrl = /^https?:\/\//i.test(imgUrl);
        const isDataUri = /^data:image\/[a-z0-9.+-]+;base64,/i.test(imgUrl);
        const looksLikeRawBase64 = !isUrl && !isDataUri && imgUrl.length > 2000 && /^[a-z0-9+/=\r\n]+$/i.test(imgUrl);
        const isBase64 = isDataUri || looksLikeRawBase64;

        try {
          let uploadedUrl;
          if (isUrl) {
            console.log(`[EBAY PUBLISH] Uploading image from URL: ${imgUrl.substring(0, 100)} to EPS`);
            uploadedUrl = await ebayService.uploadPictureFromUrl(token, imgUrl);
          } else if (isBase64) {
            console.log(`[EBAY PUBLISH] Uploading base64 image to EPS`);
            uploadedUrl = await ebayService.uploadPicture(token, imgUrl);
          } else {
            console.warn(`[EBAY PUBLISH] Unknown image format, skipping.`);
            continue;
          }
          if (uploadedUrl) {
            ebayImageUrls.push(uploadedUrl);
          }
        } catch (imgErr) {
          console.error(`[EBAY PUBLISH] Failed to upload image to EPS:`, imgErr.message);
          if (isUrl && imgUrl.length < 500) {
            ebayImageUrls.push(imgUrl);
          }
        }
      }
    }

    // 4. Build aspects/specifics
    const aspects = {};
    if (listing.itemSpecifics) {
      // Map has to be converted to standard object representation
      const specsObj = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
      for (const [key, value] of Object.entries(specsObj)) {
        if (value && value.length > 0) {
          const filtered = (Array.isArray(value) ? value : [value])
            .map(v => String(v || ''))
            .filter(v => {
              if (isAspectValueInvalid(v)) return false;
              // Specific check for Fabric Weight: must contain a positive number
              if (key.trim().toLowerCase() === 'fabric weight') {
                const numMatch = v.match(/(\d+(\.\d+)?)/);
                if (!numMatch || parseFloat(numMatch[1]) <= 0) {
                  return false; // discard non-numeric or <= 0 values
                }
              }
              return true;
            });
          if (filtered.length > 0) {
            if (key.trim().toLowerCase() === 'fabric weight') {
              aspects[key] = filtered.map(v => {
                const numMatch = v.match(/(\d+(\.\d+)?)/);
                return String(parseFloat(numMatch[1]).toFixed(1));
              });
            } else {
              aspects[key] = filtered;
            }
          }
        }
      }
    }

    // Overlay common fields if they are missing from aspects
    if (listing.brand && !isAspectValueInvalid(listing.brand) && !aspects['Brand']) aspects['Brand'] = [listing.brand];
    if (listing.color && !isAspectValueInvalid(listing.color) && !aspects['Color']) aspects['Color'] = [listing.color];
    if (listing.size && !isAspectValueInvalid(listing.size) && !aspects['Size']) aspects['Size'] = [listing.size];
    if (listing.material && !isAspectValueInvalid(listing.material) && !aspects['Material']) aspects['Material'] = [listing.material];

    // 5. Structure weight and dimensions
    const packageWeightAndSize = {};

    if (listing.packageWeight) {
      const totalOunces = (listing.packageWeight.lbs || 0) * 16 + (listing.packageWeight.oz || 0);
      if (totalOunces > 0) {
        packageWeightAndSize.weight = {
          value: totalOunces,
          unit: 'OUNCE'
        };
      }
    }

    if (listing.packageDimensions) {
      const { length, width, height } = listing.packageDimensions;
      if (length > 0 || width > 0 || height > 0) {
        packageWeightAndSize.dimensions = {
          length: length || 0,
          width: width || 0,
          height: height || 0,
          unit: 'INCH'
        };
      }
    }

    // Use exact listing.sku if present; fallback to auto-generated SKU
    const sku = listing.sku ? listing.sku.trim() : `SKU-${listing._id.toString().substring(18)}`;

    // Fetch valid conditions from Taxonomy API for listing.categoryId
    let validConditionIds = [];
    if (listing.categoryId) {
      try {
        console.log(`[EBAY PUBLISH] Fetching supported conditions for category ${listing.categoryId}...`);
        const catConditions = await ebayService.getCategoryConditions(token, listing.categoryId);
        if (catConditions && catConditions.length > 0) {
          validConditionIds = catConditions.map(c => String(c.id || c.condition_id || ''));
          console.log(`[EBAY PUBLISH] Supported conditions for category ${listing.categoryId}:`, validConditionIds);
        }
      } catch (err) {
        console.warn(`[EBAY PUBLISH] Failed to fetch category conditions, using static mapping. Error: ${err.message}`);
      }
    }

    const resolvedConditionId = resolveConditionForCategory(listing.conditionId, validConditionIds);
    const ebayConditionEnum = mapConditionIdToEnum(resolvedConditionId);
    console.log(`[EBAY PUBLISH] Selected ConditionID: ${listing.conditionId}, Resolved ConditionID: ${resolvedConditionId}, Mapped Enum: ${ebayConditionEnum}`);

    const inventoryItemData = {
      availability: {
        shipToLocationAvailability: {
          quantity: listing.quantity || 1
        }
      },
      condition: ebayConditionEnum,
      product: {
        title: listing.title ? listing.title.substring(0, 80) : '',
        description: sanitizeEbayDescription(listing.description),
        aspects: aspects,
        imageUrls: ebayImageUrls.length > 0 ? ebayImageUrls : ['https://via.placeholder.com/500']
      }
    };

    if (listing.conditionNote) {
      inventoryItemData.conditionDescription = listing.conditionNote;
    }

    if (packageWeightAndSize.weight || packageWeightAndSize.dimensions) {
      inventoryItemData.packageWeightAndSize = packageWeightAndSize;
    }

    console.log('[EBAY PUBLISH] Creating inventory item on eBay...');
    await ebayService.createOrReplaceInventoryItem(token, sku, inventoryItemData);

    // Sleep for 2 seconds to allow eBay availability database to propagate and prevent "Availability not found"
    console.log('[EBAY PUBLISH] Sleeping for 2 seconds for eBay inventory propagation...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Resolve business policies
    let fulfillmentPolicyId = listing.fulfillmentPolicyId;
    let paymentPolicyId = listing.paymentPolicyId;
    let returnPolicyId = listing.returnPolicyId;

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      try {
        const [fPolicies, pPolicies, rPolicies] = await Promise.all([
          !fulfillmentPolicyId ? ebayService.getFulfillmentPolicies(token) : null,
          !paymentPolicyId ? ebayService.getPaymentPolicies(token) : null,
          !returnPolicyId ? ebayService.getReturnPolicies(token) : null
        ]);

        if (!fulfillmentPolicyId) {
          if (fPolicies && fPolicies.length > 0) {
            fulfillmentPolicyId = fPolicies[0].fulfillmentPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultFulfillmentPolicy(token);
            fulfillmentPolicyId = newPolicy.fulfillmentPolicyId;
          }
        }

        if (!paymentPolicyId) {
          if (pPolicies && pPolicies.length > 0) {
            paymentPolicyId = pPolicies[0].paymentPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultPaymentPolicy(token);
            paymentPolicyId = newPolicy.paymentPolicyId;
          }
        }

        if (!returnPolicyId) {
          if (rPolicies && rPolicies.length > 0) {
            returnPolicyId = rPolicies[0].returnPolicyId;
          } else {
            const newPolicy = await ebayService.initDefaultReturnPolicy(token);
            returnPolicyId = newPolicy.returnPolicyId;
          }
        }
      } catch (policyErr) {
        console.error('[EBAY PUBLISH] Error resolving policies:', policyErr.message);
        throw new Error(`Failed to configure shipping/payment policies: ${policyErr.message}`);
      }
    }

    // 8. Handle existing offers (to prevent SKU conflicts and reactivate existing listings)
    const existingOffers = await ebayService.getOffers(token, sku);
    let publishedFromExisting = false;
    let ebayListingId;
    let publishSuccess = false;

    if (existingOffers && existingOffers.length > 0) {
      const existingOffer = existingOffers[0];
      const offerId = existingOffer.offerId;
      
      try {
        console.log(`[EBAY PUBLISH] Found existing offer: ${offerId} with status: ${existingOffer.status}. Reactivating...`);
        
        // If the offer is currently PUBLISHED, we must withdraw it first to transition it to WITHDRAWN
        if (existingOffer.status === 'PUBLISHED') {
          console.log(`[EBAY PUBLISH] Offer is PUBLISHED, withdrawing first: ${offerId}`);
          const { withdrawOffer } = require('../services/ebayService');
          await withdrawOffer(token, offerId);
          // Wait 2 seconds for eBay inventory sync
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Relist / Publish the same offer
        const publishRes = await ebayService.publishOffer(token, offerId);
        ebayListingId = publishRes.listingId || existingOffer.listingId;
        publishSuccess = true;
        publishedFromExisting = true;
        console.log(`[EBAY PUBLISH] Successfully reactivated existing offer! Listing ID: ${ebayListingId}`);
      } catch (reactivateErr) {
        console.warn(`[EBAY PUBLISH] Failed to reactivate existing offer, falling back to delete and recreate:`, reactivateErr.message);
        
        // Fallback: Delete all existing offers to clear the SKU space
        for (const offer of existingOffers) {
          try {
            console.log(`[EBAY PUBLISH] Deleting existing offer: ${offer.offerId}`);
            await ebayService.deleteOffer(token, offer.offerId);
          } catch (delErr) {
            console.warn(`[EBAY PUBLISH] Failed to delete existing offer ${offer.offerId}:`, delErr.message);
          }
        }
      }
    }

    let offerId;
    if (!publishedFromExisting) {
      // 9. Create Offer
      const offerData = {
        sku: sku,
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        availableQuantity: listing.quantity || 1,
        pricingSummary: {
          price: {
            value: String(listing.price),
            currency: 'USD'
          }
        },
        listingDescription: sanitizeEbayDescription(listing.description),
        categoryId: listing.categoryId || '26315',
        merchantLocationKey: locationKey,
        listingPolicies: {
          fulfillmentPolicyId,
          paymentPolicyId,
          returnPolicyId
        }
      };

      console.log('[EBAY PUBLISH] Creating new offer on eBay...');
      const createOfferRes = await ebayService.createOffer(token, offerData);
      offerId = createOfferRes.offerId;
    }

    // 10. Publish Offer (with retries to handle eBay replication lag)
    if (!publishedFromExisting) {
      console.log(`[EBAY PUBLISH] Publishing offer: ${offerId}...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const publishRes = await ebayService.publishOffer(token, offerId);
          ebayListingId = publishRes.listingId;
          publishSuccess = true;
          break;
        } catch (pubErr) {
          const errObj = pubErr.response?.data?.errors?.[0] || {};
          const errId = parseInt(errObj.errorId);
          if ((errId === 25604 || errObj.message?.includes('Product not found')) && attempt < 3) {
            console.warn(`[EBAY PUBLISH] eBay replication lag detected (Product not found). Retrying in 3 seconds... (Attempt ${attempt}/3)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            throw pubErr;
          }
        }
      }
    }

    // 11. Save publication details in database
    listing.status = 'published';
    listing.ebayStatus = 'published';
    listing.sku = sku;
    listing.ebayListingId = ebayListingId;
    listing.ebayUrl = `https://www.ebay.com/itm/${ebayListingId}`;
    listing.errorMessage = null;
    await listing.save();

    // Automatically update matched Product model cache to keep Channel Inventory synced!
    try {
      const Product = require('../models/Product');
      await Product.findOneAndUpdate(
        { user: listing.user, sku: listing.sku, source: 'ebay' },
        { 
          status: 'active', 
          ebayListingId: ebayListingId, 
          ebayUrl: listing.ebayUrl,
          title: listing.title,
          description: listing.description,
          selling_price: listing.price,
          brand: listing.brand,
          size: listing.size,
          color: listing.color,
          images: listing.images,
          thumbnail: listing.thumbnail,
          updated_at: Date.now() 
        }
      );
      console.log(`[EBAY PUBLISH] Updated synced Product status to active for SKU: ${sku}`);
    } catch (cacheErr) {
      console.warn(`[EBAY PUBLISH] Failed to update matched Product cache:`, cacheErr.message);
    }

    console.log(`[EBAY PUBLISH] Successfully published listing! eBay ID: ${ebayListingId}`);
    res.status(200).json({ success: true, data: listing });
  } catch (err) {
    console.error('[EBAY PUBLISH] Publish listing failed:', err.response?.data || err.message);
    const errDetails = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ success: false, message: `eBay API Error: ${errDetails}` });
  }
};

// @desc    Check for duplicate listing by first image content
// @route   POST /api/listings/check-duplicate
// @access  Private
exports.checkDuplicateListing = async (req, res) => {
  try {
    const { image, platform } = req.body;
    if (!image || !platform) {
      return res.status(400).json({ success: false, message: 'Image and platform are required.' });
    }

    const { findDuplicateListing } = require('../utils/duplicateChecker');
    const duplicate = await findDuplicateListing(req.user.id, platform, image);
    
    if (duplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        listingId: duplicate._id,
        title: duplicate.title
      });
    }

    res.status(200).json({ success: true, isDuplicate: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const axios = require('axios');

async function checkUrlActive(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
      },
      timeout: 5000,
      maxRedirects: 5
    });

    const finalUrl = response.request?.res?.responseUrl || url;
    
    // If it's a Poshmark listing URL, and we got redirected to home/closet/member page:
    if (url.includes('/listing/') && !finalUrl.includes('/listing/')) {
      console.log(`[Verify Live] Poshmark listing URL redirected to: ${finalUrl}`);
      return false;
    }
    // If it's an eBay listing URL, and we got redirected:
    if (url.includes('/itm/') && !finalUrl.includes('/itm/')) {
      console.log(`[Verify Live] eBay listing URL redirected to: ${finalUrl}`);
      return false;
    }

    return true;
  } catch (err) {
    // Only mark as dead if we get a definitive 404 Not Found
    if (err.response && err.response.status === 404) {
      console.log(`[Verify Live] URL explicitly returned 404: ${url}`);
      return false;
    }
    // If it's a 403 (Forbidden due to Bot protection), 503, 429, or network timeout, assume it's still alive (or we got blocked)
    console.log(`[Verify Live] Request to ${url} failed with status ${err.response?.status || 'Network Error'}. Assuming still active.`);
    return true;
  }
}

// @desc    Verify if a listing URL is active, and reset to draft if not found
// @route   POST /api/listings/:id/verify-live
// @access  Private
exports.verifyListingLive = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let isLive = false;
    const platform = listing.platform || 'ebay';

    if (platform === 'ebay') {
      if (listing.sku) {
        try {
          const token = await getValidToken(req.user.id);
          if (token) {
            const { getOffers } = require('../services/ebayService');
            const offers = await getOffers(token, listing.sku);

            // The real eBay listing ID/status live under offer.listing, not a
            // top-level offer.listingId field (which doesn't exist).
            const isOfferActive = (o) => o.listing?.listingStatus
              ? o.listing.listingStatus === 'ACTIVE'
              : o.status === 'PUBLISHED';

            // Check if there is any active published offer for this SKU
            let activeOffer = null;
            if (listing.ebayListingId) {
              activeOffer = offers && offers.find(o => o.listing?.listingId === listing.ebayListingId && isOfferActive(o));
            }

            // Fallback: If not matched by ID, check if there's any active published offer on this SKU at all
            if (!activeOffer && offers && offers.length > 0) {
              activeOffer = offers.find(isOfferActive);
              if (activeOffer && activeOffer.listing?.listingId) {
                // Sync the listing ID back if it was missing or different
                const listingId = activeOffer.listing.listingId;
                listing.ebayListingId = listingId;
                listing.ebayUrl = `https://www.ebay.com/itm/${listingId}`;
                listing.ebayStatus = 'published';
                listing.status = 'published';
                await listing.save();
                console.log(`[Verify Live] eBay Listing ID synchronized for SKU ${listing.sku}: ${listingId}`);
              }
            }

            if (activeOffer) {
              isLive = true;
            }
          }
        } catch (err) {
          console.warn(`[Verify Live] eBay API check failed:`, err.message);
        }
      }
    } else if (platform === 'poshmark') {
      if (listing.poshmarkListingId && user.poshmarkAccount && user.poshmarkAccount.connected) {
        try {
          const { getPoshmarkHeaders, getAxiosConfig } = require('../services/backendPublishService');
          const domain = user.poshmarkAccount.domain || 'poshmark.com';
          const headers = getPoshmarkHeaders(user.poshmarkAccount.sessionCookie, user.poshmarkAccount.csrfToken);
          delete headers['origin'];
          delete headers['content-type'];
          
          const config = getAxiosConfig({
            method: 'GET',
            url: `https://${domain}/vm-rest/posts/${listing.poshmarkListingId}?pm_version=2026.26.01`,
            headers
          });
          const pmRes = await axios(config);
          const postStatus = pmRes.data?.status || pmRes.data?.post?.status;
          if (postStatus === 'available') {
            isLive = true;
          }
        } catch (err) {
          console.warn(`[Verify Live] Poshmark API check failed:`, err.message);
        }
      }
    } else if (platform === 'etsy') {
      if (listing.etsyListingId && user.etsyAccount && user.etsyAccount.connected) {
        try {
          const { getValidToken: getEtsyToken, ETSY_CLIENT_ID, ETSY_CLIENT_SECRET } = require('../services/etsyService');
          const accessToken = await getEtsyToken(req.user.id);
          const numericListingId = parseInt(listing.etsyListingId);
          if (!isNaN(numericListingId)) {
            const response = await axios.get(`https://api.etsy.com/v3/application/listings/${numericListingId}`, {
              headers: {
                'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
                'Authorization': `Bearer ${accessToken}`
              }
            });
            if (response.data && response.data.state === 'active') {
              isLive = true;
            } else {
              console.log(`[Verify Live] Etsy listing state is: ${response.data?.state}`);
            }
          }
        } catch (err) {
          console.warn(`[Verify Live] Etsy API check failed:`, err.response?.data || err.message);
          // If it's a temporary API error (rate limit, 5xx, or token issue) other than a definitive 404, 
          // do NOT mark it as dead to prevent false negatives.
          if (err.response && err.response.status !== 404) {
            console.log(`[Verify Live] Etsy API returned error ${err.response.status}. Assuming still active.`);
            isLive = true; 
          }
        }
      }
    } else if (platform === 'depop') {
      if (listing.depopListingId) {
        const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
        const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
        if (isPartner && apiKey && listing.sku) {
          try {
            const response = await axios.get(`https://webapi.depop.com/api/v1/products/by-sku/${listing.sku}/`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            });
            if (response.data && response.data.status === 'active') {
              isLive = true;
            }
          } catch (err) {
            console.warn(`[Verify Live] Depop Partner API check failed:`, err.message);
          }
        } else {
          if (listing.depopUrl) {
            isLive = await checkUrlActive(listing.depopUrl);
          }
        }
      }
    }

    if (!isLive) {
      console.log(`[Verify Live] Listing ${listing._id} is verified as NOT live on ${platform}. Resetting to Delisted.`);
      
      if (platform === 'poshmark') {
        listing.poshmarkStatus = 'delisted';
      } else if (platform === 'ebay') {
        listing.ebayStatus = 'delisted';
      } else if (platform === 'etsy') {
        listing.etsyStatus = 'delisted';
      } else if (platform === 'depop') {
        listing.depopStatus = 'delisted';
      }
      
      // Check if there are no remaining active published platform listings
      const hasActive = (listing.ebayStatus === 'published' || 
                         listing.poshmarkStatus === 'published' || 
                         listing.etsyStatus === 'published' || 
                         listing.depopStatus === 'published');
      if (!hasActive) {
        listing.status = 'delisted';
      }
      
      await listing.save();
      return res.status(200).json({ success: true, isLive: false, status: 'delisted', data: listing });
    }

    res.status(200).json({ success: true, isLive: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delist listing from a platform
// @route   POST /api/listings/:id/delist
// @access  Private
exports.delistListing = async (req, res) => {
  try {
    const { platform } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required' });
    }

    let listing = await Listing.findById(req.params.id);
    if (!listing) {
      const Product = require('../models/Product');
      const prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
        if (!listing) {
          listing = new Listing({
            user: req.user.id,
            title: prod.title,
            description: prod.description || prod.title,
            sku: prod.sku,
            brand: prod.brand,
            size: prod.size,
            color: prod.color,
            categoryId: prod.categoryId,
            itemSpecifics: prod.itemSpecifics || {},
            price: prod.selling_price || 0,
            images: prod.images || [],
            status: 'draft'
          });
          const platformLower = platform.toLowerCase();
          if (platformLower === 'ebay') {
            listing.ebayListingId = prod.ebayListingId;
            listing.ebayUrl = prod.ebayUrl;
            listing.ebayStatus = 'published';
          } else if (platformLower === 'etsy') {
            listing.etsyListingId = prod.etsyListingId;
            listing.etsyUrl = prod.etsyUrl;
            listing.etsyStatus = 'published';
          } else if (platformLower === 'poshmark') {
            listing.poshmarkListingId = prod.poshmarkListingId;
            listing.poshmarkUrl = prod.poshmarkUrl;
            listing.poshmarkStatus = 'published';
          } else if (platformLower === 'depop') {
            listing.depopListingId = prod.depopListingId;
            listing.depopUrl = prod.depopUrl;
            listing.depopStatus = 'published';
          }
          await listing.save();
        }
      }
    }

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const platformLower = platform.toLowerCase();
    console.log(`[Delist Listing] Delisting from ${platformLower} for item: ${listing.title}`);

    if (platformLower === 'ebay') {
      if (!listing.ebayListingId) {
        return res.status(400).json({ success: false, message: 'Item is not currently marked as listed on eBay.' });
      }
      
      const token = await getValidToken(req.user.id);
      if (!token) {
        throw new Error('eBay account is not connected or session expired.');
      }
      
      const sku = listing.sku;
      const { getOffers, withdrawOffer } = require('../services/ebayService');
      const offers = await getOffers(token, sku);
      
      if (offers && offers.length > 0) {
        for (const offer of offers) {
          if (offer.status === 'PUBLISHED') {
            console.log(`[Delist Listing] Withdrawing eBay offer: ${offer.offerId}`);
            await withdrawOffer(token, offer.offerId);
          }
        }
      } else {
        console.warn(`[Delist Listing] No active eBay offers found for SKU ${sku}. Presuming already ended.`);
      }
      
      listing.ebayStatus = 'delisted';
      
    } else if (platformLower === 'poshmark') {
      if (!listing.poshmarkListingId) {
        return res.status(400).json({ success: false, message: 'Item is not currently marked as listed on Poshmark.' });
      }
      
      if (!user.poshmarkAccount || !user.poshmarkAccount.connected) {
        throw new Error('Poshmark account is not connected.');
      }
      
      const { deletePoshmarkListing } = require('../services/backendPublishService');
      await deletePoshmarkListing(listing.poshmarkListingId, user.poshmarkAccount);
      
      listing.poshmarkStatus = 'delisted';
      
    } else if (platformLower === 'etsy') {
      if (!listing.etsyListingId) {
        return res.status(400).json({ success: false, message: 'Item is not currently marked as listed on Etsy.' });
      }
      
      if (!user.etsyAccount || !user.etsyAccount.connected || !user.etsyAccount.shopId) {
        throw new Error('Etsy shop is not connected.');
      }
      
      const { updateListingState } = require('../services/etsyService');
      await updateListingState(req.user.id, user.etsyAccount.shopId, listing.etsyListingId, 'inactive');
      
      listing.etsyStatus = 'delisted';
      
    } else if (platformLower === 'depop') {
      if (!listing.depopListingId) {
        return res.status(400).json({ success: false, message: 'Item is not currently marked as listed on Depop.' });
      }
      
      const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
      const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
      
      if (isPartner && apiKey && listing.sku) {
        const { deleteFromDepopPartner } = require('../services/depopPartnerService');
        await deleteFromDepopPartner(listing.sku, apiKey);
      } else {
        console.warn(`[Delist Listing] Depop cookie-based connection. Resetting locally. User must end manually on Depop.`);
      }
      
      listing.depopStatus = 'delisted';
    } else {
      return res.status(400).json({ success: false, message: `Unsupported platform: ${platform}` });
    }

    // Check if there are no remaining active published platform listings
    const hasActive = (listing.ebayStatus === 'published' || 
                       listing.poshmarkStatus === 'published' || 
                       listing.etsyStatus === 'published' || 
                       listing.depopStatus === 'published');
    if (!hasActive) {
      listing.status = 'delisted';
    }

    await listing.save();

    // Automatically update matched Product model cache status to inactive to keep Channel Inventory synced!
    try {
      const Product = require('../models/Product');
      await Product.findOneAndUpdate(
        { user: listing.user, sku: listing.sku, source: platformLower },
        { status: 'inactive', updated_at: Date.now() }
      );
      console.log(`[Delist Listing] Updated synced Product status to inactive for platform: ${platformLower}, SKU: ${listing.sku}`);
    } catch (cacheErr) {
      console.warn(`[Delist Listing] Failed to update matched Product cache:`, cacheErr.message);
    }

    console.log(`[Delist Listing] Successfully delisted item ${listing.title} from ${platformLower}`);
    res.status(200).json({ success: true, message: `Successfully delisted listing from ${platform}`, data: listing });
  } catch (err) {
    console.error(`[Delist Listing] Failed to delist from ${req.body.platform}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

