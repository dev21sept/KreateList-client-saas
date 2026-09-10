const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { normalizeProductImages, generateThumbnail } = require('../utils/imageProcessor');
const { isListingMatch, cleanAndTokenize, extractUniqueImageKey } = require('../utils/listingMatcher');
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
      .select('-description -itemSpecifics')
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
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari'];
      platforms.forEach(p => {
        if (existing[`${p}Status`] && existing[`${p}Status`] !== 'none' && !req.body[`${p}Status`]) {
          req.body[`${p}Status`] = existing[`${p}Status`];
        }
      });
      const idFields = ['ebayListingId', 'ebayUrl', 'poshmarkListingId', 'poshmarkUrl', 'depopListingId', 'depopUrl', 'etsyListingId', 'etsyUrl', 'mercariListingId', 'mercariUrl'];
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
    let isFromProduct = false;
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
          isFromProduct = true;
          listing = {
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
          };
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
          if (prod.mercariListingId) {
            listing.mercariListingId = prod.mercariListingId;
            listing.mercariUrl = prod.mercariUrl;
            listing.mercariStatus = prod.status === 'active' ? 'published' : 'delisted';
          }
        }
      }
    }

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Auto-enrich eBay listings with full details (all photos, aspects, condition, category, description) if missing/minimal
    if (listing.ebayListingId && (!listing.itemSpecifics || Object.keys(listing.itemSpecifics).length === 0 || !listing.images || listing.images.length <= 1 || !listing.categoryId || listing.category === 'Clothing')) {
      try {
        const token = await getValidToken(req.user.id);
        if (token) {
          console.log(`[GET LISTING] Auto-enriching eBay details for ItemID: ${listing.ebayListingId}`);
          const ebayDetails = await ebayService.getTradingItemDetails(token, listing.ebayListingId);
          if (ebayDetails) {
            let changed = false;
            if (ebayDetails.images && ebayDetails.images.length > (listing.images?.length || 0)) {
              listing.images = ebayDetails.images;
              changed = true;
            }
            if (ebayDetails.itemSpecifics && Object.keys(ebayDetails.itemSpecifics).length > 0) {
              listing.itemSpecifics = ebayDetails.itemSpecifics;
              changed = true;
            }
            if (ebayDetails.categoryId && (!listing.categoryId || listing.categoryId !== ebayDetails.categoryId)) {
              listing.categoryId = ebayDetails.categoryId;
              changed = true;
            }
            if (ebayDetails.categoryName && (!listing.category || listing.category === 'Clothing')) {
              listing.category = ebayDetails.categoryName;
              changed = true;
            }
            if (ebayDetails.conditionId && (!listing.conditionId || listing.conditionId === '')) {
              listing.conditionId = ebayDetails.conditionId;
              listing.selectedCondition = ebayDetails.conditionDisplayName || ebayDetails.conditionId;
              changed = true;
            }
            if (ebayDetails.conditionDescription && !listing.conditionNote) {
              listing.conditionNote = ebayDetails.conditionDescription;
              changed = true;
            }
            if (ebayDetails.description && (!listing.description || listing.description === listing.title)) {
              listing.description = ebayDetails.description;
              changed = true;
            }
            if (ebayDetails.brand && !listing.brand) {
              listing.brand = ebayDetails.brand;
              changed = true;
            }
            if (ebayDetails.size && !listing.size) {
              listing.size = ebayDetails.size;
              changed = true;
            }
            if (ebayDetails.color && !listing.color) {
              listing.color = ebayDetails.color;
              changed = true;
            }

            if (changed) {
              if (!isFromProduct && typeof listing.save === 'function') {
                await listing.save();
              }
              const Product = require('../models/Product');
              await Product.updateOne(
                { _id: listing._id },
                {
                  $set: {
                    images: listing.images,
                    itemSpecifics: listing.itemSpecifics,
                    categoryId: listing.categoryId,
                    brand: listing.brand,
                    size: listing.size,
                    color: listing.color,
                    description: listing.description
                  }
                }
              );
              console.log(`[GET LISTING] Successfully enriched eBay item ${listing.ebayListingId} with ${listing.images?.length} images, ${Object.keys(listing.itemSpecifics || {}).length} aspects`);
            }
          }
        }
      } catch (enrichErr) {
        console.warn(`[GET LISTING] Failed to auto-enrich eBay item ${listing.ebayListingId}:`, enrichErr.message);
      }
    }

    // Auto-enrich Mercari listings with full details (all photos, description, category, size, brand) if missing/minimal
    const mercariId = listing.mercariListingId || (listing.sku && listing.sku.startsWith('M-m') ? listing.sku.replace('M-', '') : null);
    if (mercariId && (!listing.images || listing.images.length <= 1 || !listing.description || listing.description === listing.title)) {
      try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        if (user?.mercariAccount?.connected) {
          const { fetchMercariItemDetails } = require('../services/mercariService');
          console.log(`[GET LISTING] Auto-enriching Mercari details for ItemID: ${mercariId}`);
          const mercDetails = await fetchMercariItemDetails(mercariId, user.mercariAccount);
          if (mercDetails) {
            let changed = false;
            if (mercDetails.images && mercDetails.images.length > (listing.images?.length || 0)) {
              listing.images = mercDetails.images;
              changed = true;
            }
            if (mercDetails.description && (!listing.description || listing.description === listing.title)) {
              listing.description = mercDetails.description;
              changed = true;
            }
            if (mercDetails.brand && !listing.brand) {
              listing.brand = mercDetails.brand;
              changed = true;
            }
            if (mercDetails.size && !listing.size) {
              listing.size = mercDetails.size;
              changed = true;
            }
            if (mercDetails.category && (!listing.category || listing.category === 'Clothing')) {
              listing.category = mercDetails.category;
              changed = true;
            }
            if (mercDetails.categoryId && !listing.categoryId) {
              listing.categoryId = mercDetails.categoryId;
              changed = true;
            }
            if (mercDetails.condition && !listing.selectedCondition) {
              listing.selectedCondition = mercDetails.selectedCondition || mercDetails.condition;
              changed = true;
            }

            if (changed) {
              if (!isFromProduct && typeof listing.save === 'function') {
                await listing.save();
              }
              const Product = require('../models/Product');
              await Product.updateOne(
                { _id: listing._id },
                {
                  $set: {
                    images: listing.images,
                    categoryId: listing.categoryId,
                    brand: listing.brand,
                    size: listing.size,
                    description: listing.description,
                    category: listing.category
                  }
                }
              );
              console.log(`[GET LISTING] Successfully enriched Mercari item ${mercariId} with ${listing.images?.length} images, category: ${listing.category}`);
            }
          }
        }
      } catch (mercEnrichErr) {
        console.warn(`[GET LISTING] Failed to auto-enrich Mercari item ${mercariId}:`, mercEnrichErr.message);
      }
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
          if (prod.mercariListingId) {
            listing.mercariListingId = prod.mercariListingId;
            listing.mercariUrl = prod.mercariUrl;
            listing.mercariStatus = prod.status === 'active' ? 'published' : 'delisted';
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
            const syncResult = await publishToPoshmark(listing, user.poshmarkAccount);
            if (syncResult && syncResult.id) {
              listing.poshmarkListingId = syncResult.id;
              listing.poshmarkUrl = syncResult.url;
              await listing.save();
              console.log(`[Listing Controller] [BG SYNC] Poshmark updates synced successfully! Saved new listing ID: ${syncResult.id}`);

              // Keep local Product model cache synced
              const Product = require('../models/Product');
              await Product.findOneAndUpdate(
                { user: listing.user, sku: listing.sku, source: 'poshmark' },
                { poshmarkListingId: syncResult.id, poshmarkUrl: syncResult.url, updated_at: Date.now() }
              );
            }
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
            sku: prod.sku || `KL${Date.now()}`,
            brand: prod.brand || '',
            size: prod.size || '',
            color: prod.color || '',
            category: 'Clothing',
            categoryId: prod.categoryId || '',
            itemSpecifics: prod.itemSpecifics || {},
            price: String(prod.selling_price || 0),
            images: prod.images || [],
            thumbnail: prod.images?.[0] || '',
            status: 'draft',
            platform: 'ebay'
          });
          if (prod.ebayListingId) {
            listing.ebayListingId = prod.ebayListingId;
            listing.ebayUrl = prod.ebayUrl;
          }
          await listing.save();
        }
      }
    }

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
    const itemId = req.params.id;
    const User = require('../models/User');
    const Product = require('../models/Product');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let listing = null;
    let product = null;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(itemId);
    if (isValidObjectId) {
      listing = await Listing.findById(itemId);
      if (!listing) {
        product = await Product.findById(itemId);
        if (product && product.user.toString() === req.user.id) {
          listing = await Listing.findOne({ user: req.user.id, $or: [{ sku: product.sku }, { mercariListingId: product.mercariListingId }] });
        }
      }
    } else {
      listing = await Listing.findOne({
        user: req.user.id,
        $or: [
          { sku: itemId },
          { ebayListingId: itemId },
          { poshmarkListingId: itemId },
          { mercariListingId: itemId },
          { etsyListingId: itemId },
          { depopListingId: itemId }
        ]
      });
      if (!listing) {
        product = await Product.findOne({
          user: req.user.id,
          $or: [
            { sku: itemId },
            { mercariListingId: itemId }
          ]
        });
      }
    }

    if (!listing && !product) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // If only Product exists (Channel Inventory)
    if (!listing && product) {
      const platform = product.source || 'mercari';
      if (platform === 'mercari' && product.mercariListingId) {
        const { verifyMercariListingStatus } = require('../services/mercariService');
        const verifyResult = await verifyMercariListingStatus(product.mercariListingId, user.mercariAccount);
        if (verifyResult.status === 'deleted' || verifyResult.mercariStatus === 'deleted') {
          await Product.findByIdAndDelete(product._id);
          return res.status(200).json({ success: true, isLive: false, status: 'deleted', message: 'Item was deleted on Mercari.' });
        } else {
          product.status = verifyResult.status;
          await product.save();
          return res.status(200).json({ success: true, isLive: verifyResult.isLive, status: product.status, data: product, message: `Verified status on Mercari: ${product.status}` });
        }
      }
      return res.status(200).json({ success: true, isLive: product.status === 'active' || product.status === 'live', data: product, message: `Status on ${platform}: ${product.status}` });
    }

    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    let isLive = false;
    const platform = (req.query.platform || req.body?.platform || listing.platform || 'ebay').toLowerCase();

    // -------------------------------------------------------------
    // 1. EBAY VERIFICATION
    // -------------------------------------------------------------
    if (platform === 'ebay') {
      const ebayId = listing.ebayListingId || listing.platformData?.ebay?.liveId;
      const ebaySku = listing.platformData?.ebay?.sku || (listing.sku?.startsWith('P-') || listing.sku?.startsWith('M-') ? null : listing.sku);

      // Check 1: Direct Trading API if token and ebayId exist
      if (ebayId) {
        try {
          const token = await getValidToken(req.user.id);
          if (token) {
            const { getTradingItemDetails } = require('../services/ebayService');
            const itemDetails = await getTradingItemDetails(token, ebayId);
            if (itemDetails && itemDetails.title) {
              isLive = true;
              listing.ebayListingId = ebayId;
              listing.ebayUrl = `https://www.ebay.com/itm/${ebayId}`;
            }
          }
        } catch (tErr) {
          console.warn(`[Verify Live] Trading GetItem check failed for ${ebayId}:`, tErr.message);
        }
      }

      // Check 2: Direct Inventory API Offers check
      if (!isLive) {
        try {
          const token = await getValidToken(req.user.id);
          if (token) {
            const { getOffers } = require('../services/ebayService');
            const skusToCheck = [ebaySku, listing.platformData?.ebay?.sku, listing.sku].filter(Boolean);
            for (const sku of skusToCheck) {
              try {
                const offers = await getOffers(token, sku);
                const isOfferActive = (o) => o.listing?.listingStatus
                  ? o.listing.listingStatus === 'ACTIVE'
                  : o.status === 'PUBLISHED';

                let activeOffer = offers && offers.find(isOfferActive);
                if (activeOffer) {
                  isLive = true;
                  if (activeOffer.listing?.listingId) {
                    const listingId = activeOffer.listing.listingId;
                    listing.ebayListingId = listingId;
                    listing.ebayUrl = `https://www.ebay.com/itm/${listingId}`;
                  }
                  break;
                }
              } catch (skuErr) {
                // Not in inventory API
              }
            }
          }
        } catch (apiErr) {
          console.warn(`[Verify Live] eBay API verification error:`, apiErr.message);
        }
      }

      // Check 3: Real-time Live URL check if URL or item ID is known
      const ebayUrlToCheck = listing.ebayUrl || (ebayId ? `https://www.ebay.com/itm/${ebayId}` : null);
      if (!isLive && ebayUrlToCheck) {
        const urlIsActive = await checkUrlActive(ebayUrlToCheck);
        if (urlIsActive) {
          isLive = true;
          listing.ebayUrl = ebayUrlToCheck;
          if (ebayId) listing.ebayListingId = ebayId;
        }
      }

      // Check 4: Channel Inventory fallback match
      if (!isLive) {
        const matchingEbayProduct = await Product.findOne({
          user: req.user.id,
          source: 'ebay',
          $or: [
            ...(ebayId ? [{ ebayListingId: ebayId }, { liveListingId: ebayId }, { itemId: ebayId }] : []),
            ...(ebaySku ? [{ sku: ebaySku }] : [])
          ],
          status: { $in: ['active', 'live', 'published'] }
        });

        if (matchingEbayProduct) {
          const prodUrl = `https://www.ebay.com/itm/${matchingEbayProduct.ebayListingId || matchingEbayProduct.itemId}`;
          const isReallyLive = await checkUrlActive(prodUrl);
          if (isReallyLive) {
            isLive = true;
            listing.ebayListingId = matchingEbayProduct.ebayListingId || matchingEbayProduct.itemId;
            listing.ebayUrl = prodUrl;
          } else {
            matchingEbayProduct.status = 'inactive';
            await matchingEbayProduct.save();
          }
        }
      }

      if (isLive) {
        listing.ebayStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.ebay) listing.platformData.ebay = {};
        listing.platformData.ebay.status = 'published';
        if (listing.ebayListingId) listing.platformData.ebay.liveId = listing.ebayListingId;
      }
    } 
    // -------------------------------------------------------------
    // 2. POSHMARK VERIFICATION
    // -------------------------------------------------------------
    else if (platform === 'poshmark') {
      const pmId = listing.poshmarkListingId || listing.platformData?.poshmark?.liveId;
      const pmUrlToCheck = listing.poshmarkUrl || (pmId ? `https://poshmark.com/listing/${pmId}` : null);

      // Check 1: Real-time Live URL check (404 = Deleted/Delisted)
      if (pmUrlToCheck) {
        const urlIsActive = await checkUrlActive(pmUrlToCheck);
        if (urlIsActive) {
          isLive = true;
          listing.poshmarkUrl = pmUrlToCheck;
          if (pmId) listing.poshmarkListingId = pmId;
        } else {
          console.log(`[Verify Live] Poshmark URL is 404/dead: ${pmUrlToCheck}`);
          isLive = false;
          // Mark product in DB as inactive so local cache reflects reality
          if (pmId) {
            await Product.updateMany({ user: req.user.id, poshmarkListingId: pmId }, { status: 'inactive' });
          }
        }
      }

      // Check 2: Direct Poshmark API if not resolved and connected
      if (!isLive && pmId && user.poshmarkAccount && user.poshmarkAccount.connected && user.poshmarkAccount.sessionCookie) {
        try {
          const { getPoshmarkHeaders, getAxiosConfig } = require('../services/backendPublishService');
          const domain = user.poshmarkAccount.domain || 'poshmark.com';
          const headers = getPoshmarkHeaders(user.poshmarkAccount.sessionCookie, user.poshmarkAccount.csrfToken);
          delete headers['origin'];
          delete headers['content-type'];
          
          const config = getAxiosConfig({
            method: 'GET',
            url: `https://${domain}/vm-rest/posts/${pmId}?pm_version=2026.26.01`,
            headers
          });
          const pmRes = await axios(config);
          const postStatus = pmRes.data?.status || pmRes.data?.post?.status || pmRes.data?.post?.inventory?.status;
          if (postStatus === 'available' || postStatus === 'published') {
            isLive = true;
          }
        } catch (err) {
          console.warn(`[Verify Live] Poshmark API check failed:`, err.message);
        }
      }

      if (isLive) {
        listing.poshmarkStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.poshmark) listing.platformData.poshmark = {};
        listing.platformData.poshmark.status = 'published';
        if (pmId) listing.platformData.poshmark.liveId = pmId;
      }
    } 
    // -------------------------------------------------------------
    // 3. ETSY VERIFICATION
    // -------------------------------------------------------------
    else if (platform === 'etsy') {
      const etsyId = listing.etsyListingId || listing.platformData?.etsy?.liveId;

      if (etsyId && user.etsyAccount && user.etsyAccount.connected) {
        try {
          const { getValidToken: getEtsyToken, ETSY_CLIENT_ID, ETSY_CLIENT_SECRET } = require('../services/etsyService');
          const accessToken = await getEtsyToken(req.user.id);
          const numericListingId = parseInt(etsyId);
          if (!isNaN(numericListingId)) {
            const response = await axios.get(`https://api.etsy.com/v3/application/listings/${numericListingId}`, {
              headers: {
                'x-api-key': `${ETSY_CLIENT_ID}:${ETSY_CLIENT_SECRET}`,
                'Authorization': `Bearer ${accessToken}`
              }
            });
            if (response.data && response.data.state === 'active') {
              isLive = true;
            }
          }
        } catch (err) {
          console.warn(`[Verify Live] Etsy API check failed:`, err.response?.data || err.message);
          if (err.response && err.response.status !== 404) {
            isLive = true; 
          }
        }
      }

      if (!isLive && listing.etsyUrl) {
        isLive = await checkUrlActive(listing.etsyUrl);
      }

      if (isLive) {
        listing.etsyStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.etsy) listing.platformData.etsy = {};
        listing.platformData.etsy.status = 'published';
        if (etsyId) listing.platformData.etsy.liveId = etsyId;
      }
    } 
    // -------------------------------------------------------------
    // 4. DEPOP VERIFICATION
    // -------------------------------------------------------------
    else if (platform === 'depop') {
      const depopId = listing.depopListingId || listing.platformData?.depop?.liveId;
      if (listing.depopUrl) {
        isLive = await checkUrlActive(listing.depopUrl);
      }

      if (isLive) {
        listing.depopStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.depop) listing.platformData.depop = {};
        listing.platformData.depop.status = 'published';
      }
    } 
    // -------------------------------------------------------------
    // 5. MERCARI VERIFICATION
    // -------------------------------------------------------------
    else if (platform === 'mercari') {
      const activeId = listing.mercariListingId || listing.platformData?.mercari?.liveId;

      if (activeId && user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
        try {
          const { verifyMercariListingStatus } = require('../services/mercariService');
          const verifyResult = await verifyMercariListingStatus(activeId, user.mercariAccount);
          if (verifyResult.isLive) {
            isLive = true;
          } else if (verifyResult.status === 'deleted' || verifyResult.mercariStatus === 'deleted') {
            listing.mercariStatus = 'none';
            listing.mercariListingId = undefined;
            listing.mercariUrl = undefined;
            await Product.findOneAndDelete({ user: req.user.id, mercariListingId: activeId });
          }
        } catch (err) {
          console.warn(`[Verify Live] Mercari API check failed:`, err.message);
        }
      }

      if (!isLive && listing.mercariUrl) {
        isLive = await checkUrlActive(listing.mercariUrl);
      }

      if (isLive) {
        listing.mercariStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.mercari) listing.platformData.mercari = {};
        listing.platformData.mercari.status = 'published';
        if (activeId) listing.platformData.mercari.liveId = activeId;
      }
    }

    if (!isLive) {
      console.log(`[Verify Live] Listing ${listing._id} is verified as NOT live on ${platform}. Resetting platform status to Delisted.`);
      
      if (platform === 'poshmark') {
        listing.poshmarkStatus = 'delisted';
        if (listing.platformData?.poshmark) listing.platformData.poshmark.status = 'delisted';
      } else if (platform === 'ebay') {
        listing.ebayStatus = 'delisted';
        if (listing.platformData?.ebay) listing.platformData.ebay.status = 'delisted';
      } else if (platform === 'etsy') {
        listing.etsyStatus = 'delisted';
        if (listing.platformData?.etsy) listing.platformData.etsy.status = 'delisted';
      } else if (platform === 'depop') {
        listing.depopStatus = 'delisted';
        if (listing.platformData?.depop) listing.platformData.depop.status = 'delisted';
      } else if (platform === 'mercari') {
        if (listing.mercariStatus !== 'none') {
          listing.mercariStatus = 'delisted';
          if (listing.platformData?.mercari) listing.platformData.mercari.status = 'delisted';
        }
      }
    }

    // Update overall listing status based on cross-platform status
    const hasActive = (
      listing.ebayStatus === 'published' || 
      listing.poshmarkStatus === 'published' || 
      listing.etsyStatus === 'published' || 
      listing.depopStatus === 'published' ||
      listing.mercariStatus === 'published'
    );

    const hasDelisted = (
      listing.ebayStatus === 'delisted' || 
      listing.poshmarkStatus === 'delisted' || 
      listing.etsyStatus === 'delisted' || 
      listing.depopStatus === 'delisted' ||
      listing.mercariStatus === 'delisted'
    );

    if (hasActive) {
      listing.status = 'published';
    } else if (hasDelisted) {
      listing.status = 'delisted';
    } else {
      listing.status = 'draft';
    }

    await listing.save();

    if (isLive) {
      return res.status(200).json({
        success: true,
        isLive: true,
        status: listing.status,
        data: listing,
        message: `Listing is live and active on ${platform.toUpperCase()}!`
      });
    } else {
      return res.status(200).json({
        success: true,
        isLive: false,
        status: listing.status,
        data: listing,
        message: `Listing is ${listing[`${platform}Status`] === 'none' ? 'not listed' : 'delisted'} on ${platform.toUpperCase()}`
      });
    }
  } catch (err) {
    console.error(`[Verify Live] Error:`, err.message);
    res.status(500).json({ success: false, message: `Verify live failed: ${err.message}` });
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
        const { deleteDepopListing } = require('../services/backendPublishService');
        await deleteDepopListing(listing.depopListingId, user.depopAccount);
      }
      
      listing.depopStatus = 'delisted';
    } else if (platformLower === 'mercari') {
      const activeId = listing.mercariListingId || (prod && prod.mercariListingId);
      if (activeId && user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
        try {
          const { deactivateMercariListing } = require('../services/mercariService');
          await deactivateMercariListing(activeId, user.mercariAccount);
        } catch (mErr) {
          console.warn(`[Delist Listing] Mercari remote deactivation failed:`, mErr.message);
        }
      }
      listing.mercariStatus = 'delisted';
    } else {
      return res.status(400).json({ success: false, message: `Unsupported platform: ${platform}` });
    }

    // Check if there are no remaining active published platform listings
    const hasActive = (listing.ebayStatus === 'published' || 
                       listing.poshmarkStatus === 'published' || 
                       listing.etsyStatus === 'published' || 
                       listing.depopStatus === 'published' ||
                       listing.mercariStatus === 'published');
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

// @desc    Delete listing connection/record from a specific platform
// @route   POST /api/listings/:id/delete-platform
// @access  Private
exports.deletePlatformListing = async (req, res) => {
  try {
    const { platform, disconnectOnly } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required' });
    }

    let listing = await Listing.findById(req.params.id);
    let prod = null;
    if (!listing) {
      const Product = require('../models/Product');
      prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
      }
    }

    if (!listing && !prod) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing && listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const platformLower = platform.toLowerCase();
    const isDisconnect = !!disconnectOnly;
    console.log(`[Delete Platform Listing] Deleting/Disconnecting listing from ${platformLower} (disconnectOnly: ${isDisconnect})`);

    if (!listing && prod) {
      // It exists only in Product cache. Try to delist it if it was live, and then delete the cache entry.
      let idField = `${platformLower}ListingId`;
      
      if (!isDisconnect && prod[idField]) {
        try {
          console.log(`[Delete Platform Listing] Sync product is active/live. Trying to delist from ${platformLower} first...`);
          if (platformLower === 'ebay') {
            const token = await getValidToken(req.user.id);
            if (token) {
              const sku = prod.sku;
              const { getOffers, withdrawOffer } = require('../services/ebayService');
              const offers = await getOffers(token, sku);
              if (offers && offers.length > 0) {
                for (const offer of offers) {
                  if (offer.status === 'PUBLISHED') {
                    await withdrawOffer(token, offer.offerId);
                  }
                }
              }
            }
          } else if (platformLower === 'poshmark' && user.poshmarkAccount?.connected) {
            const { deletePoshmarkListing } = require('../services/backendPublishService');
            await deletePoshmarkListing(prod[idField], user.poshmarkAccount);
          } else if (platformLower === 'etsy' && user.etsyAccount?.connected && user.etsyAccount?.shopId) {
            const { deleteListing } = require('../services/etsyService');
            await deleteListing(req.user.id, user.etsyAccount.shopId, prod[idField]);
          } else if (platformLower === 'depop') {
            const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
            const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
            if (isPartner && apiKey && prod.sku) {
              const { deleteFromDepopPartner } = require('../services/depopPartnerService');
              await deleteFromDepopPartner(prod.sku, apiKey);
            } else if (user.depopAccount) {
              const { deleteDepopListing } = require('../services/backendPublishService');
              await deleteDepopListing(prod[idField], user.depopAccount);
            }
          } else if (platformLower === 'mercari' && user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
            const { deleteFromMercari } = require('../services/mercariService');
            await deleteFromMercari(prod[idField], user.mercariAccount);
          }
        } catch (delistErr) {
          console.warn(`[Delete Platform Listing] Sync product delist attempt failed:`, delistErr.message);
        }
      }

      if (!isDisconnect) {
        try {
          const DeletedProduct = require('../models/DeletedProduct');
          await DeletedProduct.create({
            user: req.user.id,
            sku: prod.sku || '',
            title: prod.title || '',
            source: platformLower
          });
          console.log(`[Delete Platform Listing] Created DeletedProduct tombstone for synced product: ${prod.title}`);
        } catch (tombErr) {
          console.warn(`[Delete Platform Listing] Failed to create DeletedProduct tombstone:`, tombErr.message);
        }
      }

      const Product = require('../models/Product');
      await Product.findByIdAndDelete(prod._id);
      return res.status(200).json({ success: true, message: `Successfully deleted product from ${platform}` });
    }

    // Now handle when Listing model exists
    let statusField = `${platformLower}Status`;
    let idField = `${platformLower}ListingId`;
    let urlField = `${platformLower}Url`;

    const activeId = listing[idField] || (prod && prod[idField]);
    if (!isDisconnect && activeId) {
      try {
        console.log(`[Delete Platform Listing] Listing is active/published. Trying to delist from ${platformLower} first...`);
        if (platformLower === 'ebay') {
          const token = await getValidToken(req.user.id);
          if (token) {
            const sku = listing.sku || (prod && prod.sku);
            const { getOffers, withdrawOffer } = require('../services/ebayService');
            const offers = await getOffers(token, sku);
            if (offers && offers.length > 0) {
              for (const offer of offers) {
                if (offer.status === 'PUBLISHED') {
                  await withdrawOffer(token, offer.offerId);
                }
              }
            }
          }
        } else if (platformLower === 'poshmark' && user.poshmarkAccount?.connected) {
          const { deletePoshmarkListing } = require('../services/backendPublishService');
          await deletePoshmarkListing(activeId, user.poshmarkAccount);
        } else if (platformLower === 'etsy' && user.etsyAccount?.connected && user.etsyAccount?.shopId) {
          const { deleteListing } = require('../services/etsyService');
          await deleteListing(req.user.id, user.etsyAccount.shopId, activeId);
        } else if (platformLower === 'depop') {
          const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
          const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
          const sku = listing.sku || (prod && prod.sku);
          if (isPartner && apiKey && sku) {
            const { deleteFromDepopPartner } = require('../services/depopPartnerService');
            await deleteFromDepopPartner(sku, apiKey);
          } else if (user.depopAccount) {
            const { deleteDepopListing } = require('../services/backendPublishService');
            await deleteDepopListing(activeId, user.depopAccount);
          }
        } else if (platformLower === 'mercari' && user.mercariAccount?.connected && user.mercariAccount?.sessionCookie) {
          const { deleteFromMercari } = require('../services/mercariService');
          await deleteFromMercari(activeId, user.mercariAccount);
        }
      } catch (delistErr) {
        console.warn(`[Delete Platform Listing] Delist attempt failed during platform delete:`, delistErr.message);
      }
    }

    // Clear platform fields
    listing[idField] = undefined;
    listing[urlField] = undefined;
    listing[statusField] = 'none';

    if (listing.platforms && listing.platforms[platformLower]) {
      delete listing.platforms[platformLower];
      listing.markModified('platforms');
    }
    if (listing.crosslistingDetails && listing.crosslistingDetails[platformLower]) {
      delete listing.crosslistingDetails[platformLower];
      listing.markModified('crosslistingDetails');
    }

    // Check if any platform has remaining active / draft / delisted status
    const remainingPlatforms = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari'].filter(p => {
      const st = listing[`${p}Status`];
      return st && st !== 'none' && st !== 'unlisted';
    });

    let itemDeleted = false;
    if (remainingPlatforms.length === 0) {
      // All platforms removed / disconnected -> Delete the entire listing document from DB!
      await Listing.findByIdAndDelete(listing._id);
      itemDeleted = true;
      console.log(`[Delete Platform Listing] Listing ${listing._id} (${listing.title}) deleted completely because no platforms remain.`);
    } else {
      if (listing.platform === platformLower) {
        listing.platform = remainingPlatforms[0];
      }
      const hasActive = remainingPlatforms.some(p => listing[`${p}Status`] === 'published');
      if (!hasActive && listing.status === 'published') {
        listing.status = 'draft';
      }
      await listing.save();
    }

    // Sync synced cache Product status / delete it
    try {
      const Product = require('../models/Product');
      await Product.findOneAndDelete({ user: listing.user, sku: listing.sku, source: platformLower });
      console.log(`[Delete Platform Listing] Deleted synced Product cache entry for platform: ${platformLower}, SKU: ${listing.sku}`);
      
      if (!isDisconnect) {
        const DeletedProduct = require('../models/DeletedProduct');
        await DeletedProduct.create({
          user: req.user.id,
          sku: listing.sku || '',
          title: listing.title || '',
          source: platformLower
        });
        console.log(`[Delete Platform Listing] Created DeletedProduct tombstone for listing: ${listing.title}`);
      }
    } catch (cacheErr) {
      console.warn(`[Delete Platform Listing] Failed to delete cache or create tombstone:`, cacheErr.message);
    }

    console.log(`[Delete Platform Listing] Successfully deleted item ${listing.title} platform details for ${platformLower}`);
    res.status(200).json({
      success: true,
      message: `Successfully deleted listing from ${platform}`,
      data: itemDeleted ? null : listing,
      itemDeleted
    });
  } catch (err) {
    console.error(`[Delete Platform Listing] Failed to delete from ${req.body.platform}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Move a channel listing out of current item and create a new independent item row
// @route   POST /api/listings/:id/move-to-new-item
// @access  Private
exports.moveToNewItem = async (req, res) => {
  try {
    const { platform } = req.body;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform is required' });
    }

    const platformLower = platform.toLowerCase();

    let listing = await Listing.findById(req.params.id);
    let prod = null;
    if (!listing) {
      const Product = require('../models/Product');
      prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
      }
    }

    if (!listing && !prod) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing && listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    console.log(`[Move To New Item] Splitting ${platformLower} out of listing ID: ${req.params.id}`);

    // Extract platform-specific information
    const platformDetails = (listing && listing.platforms?.[platformLower]) || (listing && listing.crosslistingDetails?.[platformLower]) || {};
    const platformStatus = (listing && listing[`${platformLower}Status`]) || (prod && prod.status) || 'draft';
    const platformListingId = (listing && listing[`${platformLower}ListingId`]) || (prod && prod[`${platformLower}ListingId`]);
    const platformUrl = (listing && listing[`${platformLower}Url`]) || (prod && prod[`${platformLower}Url`]);

    const baseTitle = platformDetails.title || (listing && listing.title) || (prod && prod.title) || 'Untitled Item';
    const baseDesc = platformDetails.description || (listing && listing.description) || (prod && prod.description) || '';
    const basePrice = String(platformDetails.price || (listing && listing.price) || (prod && prod.selling_price) || '0');
    const baseImages = platformDetails.images?.length > 0 ? platformDetails.images : ((listing && listing.images) || (prod && prod.images) || []);
    const baseThumbnail = baseImages[0] || (listing && listing.thumbnail) || '';
    const baseCategory = platformDetails.category || (listing && listing.category) || 'General';
    const baseBrand = platformDetails.brand || (listing && listing.brand) || (prod && prod.brand) || '';
    const baseSize = platformDetails.size || (listing && listing.size) || (prod && prod.size) || '';
    const baseColor = platformDetails.color || (listing && listing.color) || (prod && prod.color) || '';

    // Generate a unique SKU for the new item
    const timestamp = Date.now().toString().slice(-4);
    const origSku = (listing && listing.sku) || (prod && prod.sku) || 'ITEM';
    const newSku = `${origSku}-${platformLower.toUpperCase()}-${timestamp}`;

    // Create the new independent Listing document
    const newListing = new Listing({
      user: req.user.id,
      title: baseTitle,
      description: baseDesc,
      price: basePrice,
      sku: newSku,
      category: baseCategory,
      categoryId: platformDetails.categoryId || (listing && listing.categoryId) || (prod && prod.categoryId),
      departmentId: platformDetails.departmentId || (listing && listing.departmentId),
      subcategoryIds: platformDetails.subcategoryIds || (listing && listing.subcategoryIds) || [],
      images: baseImages,
      thumbnail: baseThumbnail,
      brand: baseBrand,
      size: baseSize,
      color: baseColor,
      quantity: (listing && listing.quantity) || 1,
      status: platformStatus === 'published' ? 'published' : 'draft',
      platform: platformLower,
      [`${platformLower}Status`]: platformStatus,
      [`${platformLower}ListingId`]: platformListingId,
      [`${platformLower}Url`]: platformUrl,
      // Ensure all other platforms are 'none' (empty/not listed)
      ebayStatus: platformLower === 'ebay' ? platformStatus : 'none',
      poshmarkStatus: platformLower === 'poshmark' ? platformStatus : 'none',
      depopStatus: platformLower === 'depop' ? platformStatus : 'none',
      etsyStatus: platformLower === 'etsy' ? platformStatus : 'none',
      mercariStatus: platformLower === 'mercari' ? platformStatus : 'none',
      platforms: {
        [platformLower]: {
          ...platformDetails,
          status: platformStatus,
          listingId: platformListingId,
          url: platformUrl
        }
      }
    });

    await newListing.save();

    // Now remove / unlink the platform from the original listing
    if (listing) {
      listing[`${platformLower}ListingId`] = undefined;
      listing[`${platformLower}Url`] = undefined;
      listing[`${platformLower}Status`] = 'none';

      if (listing.platforms && listing.platforms[platformLower]) {
        delete listing.platforms[platformLower];
        listing.markModified('platforms');
      }
      if (listing.crosslistingDetails && listing.crosslistingDetails[platformLower]) {
        delete listing.crosslistingDetails[platformLower];
        listing.markModified('crosslistingDetails');
      }

      // If the original listing's primary platform was this platform, switch it to another active or draft platform
      if (listing.platform === platformLower) {
        const otherPlatform = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari'].find(p => 
          p !== platformLower && (listing[`${p}Status`] === 'published' || listing[`${p}Status`] === 'draft')
        );
        if (otherPlatform) {
          listing.platform = otherPlatform;
        }
      }

      // Update global status
      const hasOtherActive = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari'].some(p => 
        p !== platformLower && listing[`${p}Status`] === 'published'
      );
      if (!hasOtherActive && listing.status === 'published') {
        listing.status = 'draft';
      }

      await listing.save();
    }

    // Sync any product cache if exists
    try {
      const Product = require('../models/Product');
      const existingProd = await Product.findOne({ user: req.user.id, source: platformLower, sku: origSku });
      if (existingProd) {
        existingProd.sku = newSku;
        await existingProd.save();
      }
    } catch (prodErr) {
      console.warn('[Move To New Item] Product cache sync note:', prodErr.message);
    }

    console.log(`[Move To New Item] Successfully moved ${platformLower} to new item SKU: ${newSku}`);
    res.status(200).json({
      success: true,
      message: `Successfully moved ${platformLower} to a new item!`,
      newListing,
      originalListing: listing
    });
  } catch (err) {
    console.error(`[Move To New Item] Error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Merge a channel listing from a source item into a target item (Drag & Drop Pick & Drop)
// @route   POST /api/listings/merge-channel
// @access  Private
exports.mergeChannel = async (req, res) => {
  try {
    const { sourceListingId, targetListingId, platform } = req.body;
    if (!sourceListingId || !targetListingId || !platform) {
      return res.status(400).json({ success: false, message: 'Source listing, target listing, and platform are required.' });
    }

    if (sourceListingId === targetListingId) {
      return res.status(400).json({ success: false, message: 'Source and target listings must be different.' });
    }

    const platformLower = platform.toLowerCase();

    const sourceListing = await Listing.findById(sourceListingId);
    const targetListing = await Listing.findById(targetListingId);

    if (!sourceListing || !targetListing) {
      return res.status(404).json({ success: false, message: 'Source or target listing not found.' });
    }

    if (sourceListing.user.toString() !== req.user.id || targetListing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    // STRICT MATCHING VALIDATION: Ensure Title (80%+) or Image or SKU matches!
    const matchResult = isListingMatch(sourceListing, targetListing, 0.75);
    if (!matchResult.isMatch) {
      console.warn(`[Merge Channel Rejected] ${matchResult.reason} | Source: "${sourceListing.title}" vs Target: "${targetListing.title}"`);
      return res.status(400).json({
        success: false,
        message: `Cannot merge: Products do not match! Items must be the same physical product (80%+ title similarity or matching images). Source: "${sourceListing.title || 'Untitled'}" vs Target: "${targetListing.title || 'Untitled'}"`
      });
    }

    console.log(`[Merge Channel Approved] Match Reason: ${matchResult.reason} (${Math.round(matchResult.score * 100)}%). Merging ${platformLower} from Source ${sourceListingId} into Target ${targetListingId}`);

    // Extract platform details from source
    const platformDetails = (sourceListing.platforms?.[platformLower]) || (sourceListing.crosslistingDetails?.[platformLower]) || {};
    const platformStatus = sourceListing[`${platformLower}Status`] || (sourceListing.platform === platformLower ? sourceListing.status : 'draft');
    const platformListingId = sourceListing[`${platformLower}ListingId`];
    const platformUrl = sourceListing[`${platformLower}Url`];

    // Transfer platform details into target listing
    targetListing[`${platformLower}Status`] = platformStatus;
    targetListing[`${platformLower}ListingId`] = platformListingId;
    targetListing[`${platformLower}Url`] = platformUrl;

    if (!targetListing.platforms) targetListing.platforms = {};
    targetListing.platforms[platformLower] = {
      ...platformDetails,
      status: platformStatus,
      listingId: platformListingId,
      url: platformUrl
    };
    targetListing.markModified('platforms');

    if (!targetListing.crosslistingDetails) targetListing.crosslistingDetails = {};
    targetListing.crosslistingDetails[platformLower] = {
      ...platformDetails,
      status: platformStatus,
      listingId: platformListingId,
      url: platformUrl
    };
    targetListing.markModified('crosslistingDetails');

    // Merge source images into target if target is missing any
    if (Array.isArray(sourceListing.images) && sourceListing.images.length > 0) {
      const existingImgs = new Set(targetListing.images || []);
      const newImgs = sourceListing.images.filter(img => img && !existingImgs.has(img));
      if (newImgs.length > 0) {
        targetListing.images = [...(targetListing.images || []), ...newImgs];
      }
    }

    // If target is draft and source had published status, update target status
    if (targetListing.status === 'draft' && platformStatus === 'published') {
      targetListing.status = 'published';
    }

    await targetListing.save();

    // Now remove platform from source listing
    sourceListing[`${platformLower}ListingId`] = undefined;
    sourceListing[`${platformLower}Url`] = undefined;
    sourceListing[`${platformLower}Status`] = 'none';

    if (sourceListing.platforms && sourceListing.platforms[platformLower]) {
      delete sourceListing.platforms[platformLower];
      sourceListing.markModified('platforms');
    }
    if (sourceListing.crosslistingDetails && sourceListing.crosslistingDetails[platformLower]) {
      delete sourceListing.crosslistingDetails[platformLower];
      sourceListing.markModified('crosslistingDetails');
    }

    // Check if source listing has any remaining active / draft / delisted platforms
    const remainingPlatforms = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari'].filter(p => {
      const st = sourceListing[`${p}Status`];
      return st && st !== 'none' && st !== 'unlisted';
    });

    let sourceDeleted = false;
    if (remainingPlatforms.length === 0) {
      // Source item has no channels left and was fully merged into matching target -> Delete it safely
      await Listing.findByIdAndDelete(sourceListing._id);
      sourceDeleted = true;
      console.log(`[Merge Channel] Source listing ${sourceListing._id} deleted because all channels were successfully merged into matching target.`);
    } else {
      // If primary platform was the one merged out, switch primary platform to another remaining platform
      if (sourceListing.platform === platformLower) {
        sourceListing.platform = remainingPlatforms[0];
      }
      // Update global status
      const hasOtherActive = remainingPlatforms.some(p => sourceListing[`${p}Status`] === 'published');
      if (!hasOtherActive && sourceListing.status === 'published') {
        sourceListing.status = 'draft';
      }
      await sourceListing.save();
    }

    res.status(200).json({
      success: true,
      message: `Successfully merged ${platform} into item!`,
      targetListing,
      sourceDeleted
    });
  } catch (err) {
    console.error(`[Merge Channel] Error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get preview of all active channel listings grouped & matched across platforms
// @route   GET /api/listings/active-channel-preview
// @access  Private
exports.getActiveChannelImportPreview = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch all active items across channels for this user
    const activeProducts = await Product.find({
      user: userId,
      status: { $in: ['active', 'live', 'published'] }
    }).sort({ updated_at: -1, createdAt: -1 });

    // 2. Fetch existing listings to detect items already present in local database
    const existingListings = await Listing.find({ user: userId });

        const groups = [];
    const skuToGroup = new Map();
    const imageToGroup = new Map();
    const tokenToGroups = new Map();

    const addGroupToIndexes = (group) => {
      if (group.sku && group.sku.trim()) {
        const cleanSku = group.sku.trim().toLowerCase();
        if (cleanSku && cleanSku !== '-' && cleanSku !== 'none' && cleanSku !== 'n/a' && cleanSku !== 'default' && cleanSku.length > 3) {
          skuToGroup.set(cleanSku, group);
        }
      }
      if (Array.isArray(group.images)) {
        for (const img of group.images) {
          const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
          if (k) imageToGroup.set(k, group);
        }
      }
      if (group.title) {
        const tokens = cleanAndTokenize(group.title);
        for (const t of tokens) {
          if (!tokenToGroups.has(t)) {
            tokenToGroups.set(t, new Set());
          }
          tokenToGroups.get(t).add(group);
        }
      }
    };

    // 2. Iterate through products and group by matches
    for (const prod of activeProducts) {
      const src = (prod.source || 'ebay').toLowerCase();
      const prodImages = Array.isArray(prod.images) && prod.images.length > 0
        ? prod.images
        : (prod.thumbnail ? [prod.thumbnail] : []);

      let liveId = '';
      let url = '';
      if (src === 'ebay') {
        liveId = String(prod.ebayListingId || prod.itemId || prod.original_id || '');
        url = prod.ebayUrl || prod.url || '';
      } else if (src === 'poshmark') {
        liveId = String(prod.poshmarkListingId || prod.sku || '');
        url = prod.poshmarkUrl || prod.url || '';
      } else if (src === 'mercari') {
        liveId = String(prod.mercariListingId || prod.sku || '');
        url = prod.mercariUrl || prod.url || '';
      } else if (src === 'depop') {
        liveId = String(prod.depopListingId || prod.sku || '');
        url = prod.depopUrl || prod.url || '';
      } else if (src === 'etsy') {
        liveId = String(prod.etsyListingId || prod.sku || '');
        url = prod.etsyUrl || prod.url || '';
      } else {
        liveId = String(prod.sku || prod._id);
        url = prod.url || '';
      }

      const channelItem = {
        productId: prod._id,
        liveId: liveId || String(prod._id),
        title: prod.title || 'Untitled Item',
        price: Number(prod.selling_price) || 0,
        originalPrice: prod.originalPrice || '',
        url: url,
        sku: prod.sku || '',
        thumbnail: prod.thumbnail || prodImages[0] || '',
        images: prodImages,
        source: src,
        brand: prod.brand || '',
        size: prod.size || '',
        color: prod.color || '',
        category: prod.category || prod.category_name || '',
        categoryId: prod.categoryId || '',
        departmentId: prod.departmentId || '',
        subcategoryIds: prod.subcategoryIds || [],
        condition: prod.condition || prod.condition_name || prod.selectedCondition || '',
        description: prod.description || prod.title || '',
        itemSpecifics: src === 'ebay' ? (prod.itemSpecifics || {}) : {}
      };

      let matchedGroup = null;

      // 1. Try SKU match (validated)
      if (channelItem.sku && channelItem.sku.trim()) {
        const cleanSku = channelItem.sku.trim().toLowerCase();
        if (cleanSku && cleanSku !== '-' && cleanSku !== 'none' && cleanSku !== 'n/a' && cleanSku !== 'default' && cleanSku.length > 3) {
          const candidate = skuToGroup.get(cleanSku);
          if (candidate && !candidate.channels[src]) {
            const match = isListingMatch(
              { title: channelItem.title, images: channelItem.images, sku: channelItem.sku, size: channelItem.size },
              { title: candidate.title, images: candidate.images, sku: candidate.sku, size: candidate.size },
              0.80
            );
            if (match.isMatch) {
              matchedGroup = candidate;
            }
          }
        }
      }

      // 2. Try Image match (validated)
      if (!matchedGroup && prodImages.length > 0) {
        for (const img of prodImages) {
          const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
          if (k && imageToGroup.has(k)) {
            const candidate = imageToGroup.get(k);
            if (candidate && !candidate.channels[src]) {
              const match = isListingMatch(
                { title: channelItem.title, images: channelItem.images, sku: channelItem.sku, size: channelItem.size },
                { title: candidate.title, images: candidate.images, sku: candidate.sku, size: candidate.size },
                0.80
              );
              if (match.isMatch) {
                matchedGroup = candidate;
                break;
              }
            }
          }
        }
      }

      // 3. Try Candidate Title Token overlap
      if (!matchedGroup && channelItem.title) {
        const tokens = cleanAndTokenize(channelItem.title);
        const candidateCounts = new Map();
        for (const t of tokens) {
          if (tokenToGroups.has(t)) {
            for (const candidate of tokenToGroups.get(t)) {
              if (!candidate.channels[src]) {
                candidateCounts.set(candidate, (candidateCounts.get(candidate) || 0) + 1);
              }
            }
          }
        }

        const minCommon = tokens.length <= 2 ? 1 : 2;
        let highestScore = 0;

        const sortedCandidates = Array.from(candidateCounts.entries())
          .filter(([_, count]) => count >= minCommon)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [candidate] of sortedCandidates) {
          const match = isListingMatch(
            { title: channelItem.title, images: channelItem.images, sku: channelItem.sku, size: channelItem.size },
            { title: candidate.title, images: candidate.images, sku: candidate.sku, size: candidate.size },
            0.85
          );
          if (match.isMatch && match.score > highestScore) {
            matchedGroup = candidate;
            highestScore = match.score;
            if (match.score >= 0.90) break;
          }
        }
      }

      if (matchedGroup) {
        // Add to existing group
        matchedGroup.channels[src] = {
          ...channelItem,
          selected: true
        };
        matchedGroup.channelCount += 1;

        // Merge images
        const existingImgs = new Set(matchedGroup.images);
        for (const img of prodImages) {
          if (img && !existingImgs.has(img)) {
            matchedGroup.images.push(img);
            existingImgs.add(img);
            const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
            if (k) imageToGroup.set(k, matchedGroup);
          }
        }
        if (!matchedGroup.thumbnail && matchedGroup.images.length > 0) {
          matchedGroup.thumbnail = matchedGroup.images[0];
        }
        if (!matchedGroup.sku && channelItem.sku) {
          matchedGroup.sku = channelItem.sku;
          const cleanSku = channelItem.sku.trim().toLowerCase();
          if (cleanSku && cleanSku !== '-' && cleanSku !== 'none') skuToGroup.set(cleanSku, matchedGroup);
        }
        if (!matchedGroup.brand && channelItem.brand) matchedGroup.brand = channelItem.brand;
        if (!matchedGroup.size && channelItem.size) matchedGroup.size = channelItem.size;
        if (!matchedGroup.color && channelItem.color) matchedGroup.color = channelItem.color;
        if (!matchedGroup.price && channelItem.price) matchedGroup.price = channelItem.price;
        if (!matchedGroup.description && channelItem.description) matchedGroup.description = channelItem.description;
      } else {
        // Create new group
        const newGroup = {
          groupId: `grp_${groups.length + 1}_${prod._id}`,
          title: channelItem.title,
          sku: channelItem.sku || '',
          price: channelItem.price || 0,
          brand: channelItem.brand || '',
          size: channelItem.size || '',
          color: channelItem.color || '',
          category: channelItem.category || 'Clothing',
          categoryId: channelItem.categoryId || '',
          description: channelItem.description || channelItem.title || '',
          images: prodImages,
          thumbnail: prodImages[0] || prod.thumbnail || '',
          itemSpecifics: channelItem.itemSpecifics || {},
          channels: {
            ebay: null,
            poshmark: null,
            mercari: null,
            depop: null,
            etsy: null
          },
          channelCount: 1,
          alreadyInLocal: false,
          localListingId: null,
          localStatus: null
        };
        newGroup.channels[src] = {
          ...channelItem,
          selected: true
        };
        groups.push(newGroup);
        addGroupToIndexes(newGroup);
      }
    }

    // 3. Mark groups already in local database using fast index
    const localSkuMap = new Map();
    const localPlatformMap = new Map();
    const localTokenMap = new Map();

    for (const listing of existingListings) {
      if (listing.sku && listing.sku.trim()) {
        const s = listing.sku.trim().toLowerCase();
        if (s && s !== '-' && s !== 'none') localSkuMap.set(s, listing);
      }
      if (listing.ebayListingId) localPlatformMap.set(`ebay_${listing.ebayListingId}`, listing);
      if (listing.poshmarkListingId) localPlatformMap.set(`poshmark_${listing.poshmarkListingId}`, listing);
      if (listing.mercariListingId) localPlatformMap.set(`mercari_${listing.mercariListingId}`, listing);
      if (listing.depopListingId) localPlatformMap.set(`depop_${listing.depopListingId}`, listing);
      if (listing.etsyListingId) localPlatformMap.set(`etsy_${listing.etsyListingId}`, listing);

      const tokens = cleanAndTokenize(listing.title);
      for (const t of tokens) {
        if (!localTokenMap.has(t)) localTokenMap.set(t, new Set());
        localTokenMap.get(t).add(listing);
      }
    }

    for (const group of groups) {
      let matchedListing = null;

      if (group.sku && group.sku.trim()) {
        const s = group.sku.trim().toLowerCase();
        if (localSkuMap.has(s)) matchedListing = localSkuMap.get(s);
      }

      if (!matchedListing) {
        for (const p of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
          const liveId = group.channels[p]?.liveId;
          if (liveId && localPlatformMap.has(`${p}_${liveId}`)) {
            matchedListing = localPlatformMap.get(`${p}_${liveId}`);
            break;
          }
        }
      }

      if (!matchedListing && group.title) {
        const tokens = cleanAndTokenize(group.title);
        const localCandidateCounts = new Map();
        for (const t of tokens) {
          if (localTokenMap.has(t)) {
            for (const l of localTokenMap.get(t)) {
              localCandidateCounts.set(l, (localCandidateCounts.get(l) || 0) + 1);
            }
          }
        }

        const sortedLocalCandidates = Array.from(localCandidateCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [l] of sortedLocalCandidates) {
          const match = isListingMatch(
            { title: l.title, images: l.images, sku: l.sku, size: l.size, color: l.color },
            { title: group.title, images: group.images, sku: group.sku, size: group.size, color: group.color },
            0.90
          );
          // Require confirmed image match or identical title to prevent distinct items with similar titles from falsely marking as already in DB
          const hasImageMatch = checkImageMatch(l.images, group.images);
          const isExactTitle = l.title && group.title && l.title.trim().toLowerCase() === group.title.trim().toLowerCase();
          
          if (match.isMatch && (hasImageMatch || isExactTitle)) {
            matchedListing = l;
            break;
          }
        }
      }

      if (matchedListing) {
        group.localListingId = matchedListing._id;
        group.localStatus = matchedListing.status;

        let allChannelsInLocal = true;
        let someChannelsInLocal = false;
        let unlinkedCount = 0;

        for (const p of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
          if (group.channels[p]) {
            const liveId = group.channels[p].liveId;
            const hasLiveId = !!(matchedListing[`${p}ListingId`] || (liveId && String(matchedListing[`${p}ListingId`]) === String(liveId)));
            const isPlatformPublished = matchedListing[`${p}Status`] === 'published' || (matchedListing.platform === p && matchedListing.status === 'published');
            const hasPlatformData = !!(matchedListing.platformData && matchedListing.platformData[p]);

            const isLinked = hasLiveId || hasPlatformData || (isPlatformPublished && matchedListing.platform === p);
            group.channels[p].alreadyInLocal = isLinked;

            if (isLinked) {
              someChannelsInLocal = true;
              group.channels[p].selected = false;
            } else {
              allChannelsInLocal = false;
              unlinkedCount++;
              group.channels[p].selected = true;
            }
          }
        }

        group.alreadyInLocal = allChannelsInLocal;
        group.partiallyInLocal = someChannelsInLocal && !allChannelsInLocal;
        group.unlinkedChannelCount = unlinkedCount;
      } else {
        group.alreadyInLocal = false;
        group.partiallyInLocal = false;
        group.unlinkedChannelCount = group.channelCount;
        for (const p of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
          if (group.channels[p]) {
            group.channels[p].alreadyInLocal = false;
            group.channels[p].selected = true;
          }
        }
      }
    }

    // Sort groups: items with unlinked channels first at top, fully imported items in local DB at bottom
    groups.sort((a, b) => {
      if (!a.alreadyInLocal && b.alreadyInLocal) return -1;
      if (a.alreadyInLocal && !b.alreadyInLocal) return 1;
      if ((b.unlinkedChannelCount || 0) !== (a.unlinkedChannelCount || 0)) {
        return (b.unlinkedChannelCount || 0) - (a.unlinkedChannelCount || 0);
      }
      return b.channelCount - a.channelCount;
    });

    res.status(200).json({
      success: true,
      totalActiveProducts: activeProducts.length,
      groupedCount: groups.length,
      groups: groups
    });
  } catch (err) {
    console.error('[Get Active Channel Preview] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Import selected active channel groups into Local Database
// @route   POST /api/listings/import-active-channels
// @access  Private
exports.importActiveChannelsToLocal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items selected for import.' });
    }

    let importedCount = 0;
    let updatedCount = 0;
    const importedListingIds = [];

    for (const item of items) {
      // Determine which platforms are selected for this item
      const channels = item.channels || {};
      const activeSelectedPlatforms = Object.keys(channels).filter(plat => {
        const ch = channels[plat];
        return ch && (ch.selected !== false);
      });

      if (activeSelectedPlatforms.length === 0) {
        continue;
      }

      // Check if listing already exists
      let listing = null;
      if (item.localListingId) {
        listing = await Listing.findOne({ _id: item.localListingId, user: userId });
      }

      if (!listing && item.sku && item.sku.trim()) {
        listing = await Listing.findOne({ user: userId, sku: item.sku.trim() });
      }

      if (!listing) {
        // Try matching by platform live IDs
        for (const plat of activeSelectedPlatforms) {
          const liveId = channels[plat]?.liveId;
          if (liveId) {
            const query = { user: userId };
            query[`${plat}ListingId`] = liveId;
            listing = await Listing.findOne(query);
            if (listing) break;
          }
        }
      }

      const images = Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : (item.thumbnail ? [item.thumbnail] : []);

      if (listing) {
        // Update existing listing
        listing.platformData = listing.platformData || {};

        for (const plat of ['ebay', 'poshmark', 'mercari', 'depop', 'etsy']) {
          if (activeSelectedPlatforms.includes(plat)) {
            const ch = channels[plat];
            listing[`${plat}ListingId`] = ch.liveId || listing[`${plat}ListingId`];
            listing[`${plat}Url`] = ch.url || listing[`${plat}Url`];
            listing[`${plat}Status`] = 'published';

            // Store distinct platform data with complete image sets and preserved attributes
            listing.platformData[plat] = {
              title: ch.title || listing.title,
              description: ch.description || (plat === listing.platform ? listing.description : ''),
              price: ch.price !== undefined && ch.price !== null ? String(ch.price) : String(listing.price),
              originalPrice: ch.originalPrice ? String(ch.originalPrice) : (listing.originalPrice || ''),
              sku: ch.sku || listing.sku,
              brand: ch.brand || listing.brand || item.brand || '',
              size: ch.size || listing.size || item.size || '',
              color: ch.color || listing.color || item.color || '',
              category: ch.category || (plat === listing.platform ? listing.category : (item.category || '')),
              categoryId: ch.categoryId || (plat === listing.platform ? listing.categoryId : (item.categoryId || '')),
              departmentId: ch.departmentId || item.departmentId || '',
              subcategoryIds: ch.subcategoryIds || item.subcategoryIds || [],
              condition: ch.condition || (plat === listing.platform ? (listing.selectedCondition || listing.condition) : (item.condition || '')),
              itemSpecifics: plat === 'ebay' ? (ch.itemSpecifics && Object.keys(ch.itemSpecifics).length > 0 ? ch.itemSpecifics : (item.itemSpecifics || listing.itemSpecifics || {})) : {},
              url: ch.url || listing[`${plat}Url`] || '',
              liveId: ch.liveId || listing[`${plat}ListingId`],
              status: 'published',
              images: (images && images.length > 0) ? images : (ch.images || listing.images || []),
              thumbnail: ch.thumbnail || listing.thumbnail || (images && images[0]) || ''
            };
          }
        }

        // Merge missing images
        if (images.length > 0) {
          const existingImgs = new Set(listing.images || []);
          for (const img of images) {
            if (img && !existingImgs.has(img)) {
              listing.images = listing.images || [];
              listing.images.push(img);
              existingImgs.add(img);
            }
          }
        }

        // Ensure all platformData entries also have access to the merged full images
        if (listing.images && listing.images.length > 0) {
          for (const plat of Object.keys(listing.platformData || {})) {
            if (!listing.platformData[plat].images || listing.platformData[plat].images.length < listing.images.length) {
              listing.platformData[plat].images = listing.images;
            }
          }
        }

        if (!listing.thumbnail && images[0]) {
          listing.thumbnail = images[0];
        }
        if (!listing.brand && item.brand) listing.brand = item.brand;
        if (!listing.size && item.size) listing.size = item.size;
        if (!listing.color && item.color) listing.color = item.color;
        if ((!listing.price || listing.price === '0') && item.price) listing.price = String(item.price);
        
        listing.status = 'published';
        listing.markModified('platformData');
        await listing.save();
        updatedCount++;
        importedListingIds.push(listing._id);
      } else {
        // Create new master Listing in local database
        const primaryPlatform = activeSelectedPlatforms[0] || 'ebay';
        const primaryChannel = channels[primaryPlatform] || item;
        const finalSku = item.sku && item.sku.trim() 
          ? item.sku.trim() 
          : `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

        const newListing = new Listing({
          user: userId,
          title: primaryChannel.title || item.title || 'Untitled Imported Item',
          description: primaryChannel.description || item.description || item.title || 'Imported item',
          price: String(primaryChannel.price !== undefined ? primaryChannel.price : (item.price || 0)),
          sku: finalSku,
          category: primaryChannel.category || item.category || 'Clothing',
          categoryId: primaryChannel.categoryId || item.categoryId || '',
          brand: primaryChannel.brand || item.brand || '',
          size: primaryChannel.size || item.size || '',
          color: primaryChannel.color || item.color || '',
          images: images,
          thumbnail: item.thumbnail || images[0] || '',
          itemSpecifics: primaryPlatform === 'ebay' ? (primaryChannel.itemSpecifics || item.itemSpecifics || {}) : (item.itemSpecifics || {}),
          status: 'published',
          platform: primaryPlatform,
          ebayStatus: 'none',
          poshmarkStatus: 'none',
          mercariStatus: 'none',
          depopStatus: 'none',
          etsyStatus: 'none',
          platformData: {}
        });

        for (const plat of ['ebay', 'poshmark', 'mercari', 'depop', 'etsy']) {
          if (activeSelectedPlatforms.includes(plat)) {
            const ch = channels[plat];
            newListing[`${plat}ListingId`] = ch.liveId;
            newListing[`${plat}Url`] = ch.url || '';
            newListing[`${plat}Status`] = 'published';

            newListing.platformData[plat] = {
              title: ch.title || newListing.title,
              description: ch.description || (plat === primaryPlatform ? newListing.description : ''),
              price: ch.price !== undefined && ch.price !== null ? String(ch.price) : String(newListing.price),
              originalPrice: ch.originalPrice ? String(ch.originalPrice) : (item.originalPrice || ''),
              sku: ch.sku || newListing.sku,
              brand: ch.brand || newListing.brand || item.brand || '',
              size: ch.size || newListing.size || item.size || '',
              color: ch.color || newListing.color || item.color || '',
              category: ch.category || (plat === primaryPlatform ? newListing.category : (item.category || '')),
              categoryId: ch.categoryId || (plat === primaryPlatform ? newListing.categoryId : (item.categoryId || '')),
              departmentId: ch.departmentId || item.departmentId || '',
              subcategoryIds: ch.subcategoryIds || item.subcategoryIds || [],
              condition: ch.condition || (plat === primaryPlatform ? (newListing.selectedCondition || newListing.condition) : (item.condition || '')),
              itemSpecifics: plat === 'ebay' ? (ch.itemSpecifics && Object.keys(ch.itemSpecifics).length > 0 ? ch.itemSpecifics : (newListing.itemSpecifics || item.itemSpecifics || {})) : {},
              url: ch.url || '',
              liveId: ch.liveId,
              status: 'published',
              images: (images && images.length > 0) ? images : (ch.images || newListing.images || []),
              thumbnail: ch.thumbnail || newListing.thumbnail || (images && images[0]) || ''
            };
          }
        }

        newListing.markModified('platformData');
        await newListing.save();
        importedCount++;
        importedListingIds.push(newListing._id);
      }
    }

    res.status(200).json({
      success: true,
      importedCount,
      updatedCount,
      totalProcessed: importedCount + updatedCount,
      message: `Successfully imported ${importedCount} new and updated ${updatedCount} listings in Local Database!`
    });
  } catch (err) {
    console.error('[Import Active Channels] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get preview of local listings that can be merged (duplicates across channels)
// @route   GET /api/listings/local-merge-preview
// @access  Private
exports.getLocalMergePreview = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch all local listings for this user
    const listings = await Listing.find({ user: userId }).sort({ createdAt: -1 });

    const groups = [];
    const skuToGroup = new Map();
    const imageToGroup = new Map();
    const tokenToGroups = new Map();

    const addGroupToIndexes = (group) => {
      if (group.sku && group.sku.trim()) {
        const cleanSku = group.sku.trim().toLowerCase();
        if (cleanSku && cleanSku !== '-' && cleanSku !== 'none' && cleanSku !== 'n/a' && cleanSku !== 'default' && cleanSku.length > 3) {
          skuToGroup.set(cleanSku, group);
        }
      }
      if (Array.isArray(group.images)) {
        for (const img of group.images) {
          const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
          if (k) imageToGroup.set(k, group);
        }
      }
      const tokens = cleanAndTokenize(group.title);
      for (const t of tokens) {
        if (!tokenToGroups.has(t)) {
          tokenToGroups.set(t, new Set());
        }
        tokenToGroups.get(t).add(group);
      }
    };

    for (const listing of listings) {
      const listingImgs = Array.isArray(listing.images) ? listing.images.filter(Boolean) : (listing.thumbnail ? [listing.thumbnail] : []);
      
      // Determine what platforms this listing is already active on
      const platformsPresent = {};
      for (const plat of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
        const liveId = listing[`${plat}ListingId`];
        const status = listing[`${plat}Status`];
        if ((liveId && liveId !== 'undefined' && liveId !== 'null') || (status && status === 'published') || (listing.platform === plat && listing.status === 'published')) {
          platformsPresent[plat] = {
            listingId: listing._id,
            liveId: liveId || listing._id.toString(),
            url: listing[`${plat}Url`] || '',
            status: status || (listing.platform === plat ? listing.status : 'published'),
            selected: true
          };
        }
      }

      // If listing has primary platform with no explicit platformStatus, record it
      if (Object.keys(platformsPresent).length === 0 && listing.platform) {
        platformsPresent[listing.platform] = {
          listingId: listing._id,
          liveId: listing._id.toString(),
          url: '',
          status: listing.status || 'draft',
          selected: true
        };
      }

      let matchedGroup = null;

      // 1. Check SKU match (validated)
      if (listing.sku && listing.sku.trim()) {
        const cleanSku = listing.sku.trim().toLowerCase();
        if (cleanSku && cleanSku !== '-' && cleanSku !== 'none' && cleanSku !== 'n/a' && cleanSku !== 'default' && cleanSku.length > 3) {
          const candidate = skuToGroup.get(cleanSku);
          if (candidate && candidate.masterListing._id.toString() !== listing._id.toString()) {
            const match = isListingMatch(
              { title: listing.title, images: listingImgs, sku: listing.sku, size: listing.size },
              { title: candidate.masterListing.title, images: candidate.masterListing.images, sku: candidate.masterListing.sku, size: candidate.masterListing.size },
              0.80
            );
            if (match.isMatch) {
              matchedGroup = candidate;
            }
          }
        }
      }

      // 2. Check Image match (validated)
      if (!matchedGroup && listingImgs.length > 0) {
        for (const img of listingImgs) {
          const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
          if (k && imageToGroup.has(k)) {
            const candidate = imageToGroup.get(k);
            if (candidate && candidate.masterListing._id.toString() !== listing._id.toString()) {
              const match = isListingMatch(
                { title: listing.title, images: listingImgs, sku: listing.sku, size: listing.size },
                { title: candidate.masterListing.title, images: candidate.masterListing.images, sku: candidate.masterListing.sku, size: candidate.masterListing.size },
                0.80
              );
              if (match.isMatch) {
                matchedGroup = candidate;
                break;
              }
            }
          }
        }
      }

      // 3. Check Title Token overlap
      if (!matchedGroup && listing.title) {
        const tokens = cleanAndTokenize(listing.title);
        const candidateCounts = new Map();
        for (const t of tokens) {
          if (tokenToGroups.has(t)) {
            for (const candidate of tokenToGroups.get(t)) {
              candidateCounts.set(candidate, (candidateCounts.get(candidate) || 0) + 1);
            }
          }
        }

        const minCommon = tokens.length <= 2 ? 1 : 2;
        let highestScore = 0;

        const sortedCandidates = Array.from(candidateCounts.entries())
          .filter(([_, count]) => count >= minCommon)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [candidate] of sortedCandidates) {
          const match = isListingMatch(
            { title: listing.title, images: listingImgs, sku: listing.sku, size: listing.size },
            { title: candidate.title, images: candidate.images, sku: candidate.sku, size: candidate.size },
            0.85
          );
          if (match.isMatch && match.score > highestScore) {
            matchedGroup = candidate;
            highestScore = match.score;
            if (match.score >= 0.90) break;
          }
        }
      }

      if (matchedGroup) {
        matchedGroup.items.push(listing);
        // Merge platforms
        for (const [plat, data] of Object.entries(platformsPresent)) {
          if (!matchedGroup.channels[plat]) {
            matchedGroup.channels[plat] = data;
          }
        }
        // Merge images
        const existingImgs = new Set(matchedGroup.images);
        for (const img of listingImgs) {
          if (img && !existingImgs.has(img)) {
            matchedGroup.images.push(img);
            existingImgs.add(img);
            const k = extractUniqueImageKey(typeof img === 'string' ? img : img?.url);
            if (k) imageToGroup.set(k, matchedGroup);
          }
        }
      } else {
        const newGroup = {
          groupId: `local_grp_${groups.length + 1}_${listing._id}`,
          masterListing: listing,
          title: listing.title,
          sku: listing.sku || '',
          price: listing.price || 0,
          images: listingImgs,
          thumbnail: listingImgs[0] || listing.thumbnail || '',
          brand: listing.brand || '',
          size: listing.size || '',
          channels: { ...platformsPresent },
          items: [listing]
        };
        groups.push(newGroup);
        addGroupToIndexes(newGroup);
      }
    }

    // Filter only groups that have 2 or MORE listings (actual merge candidates!)
    const mergeCandidates = groups
      .filter(g => g.items.length >= 2)
      .map(g => {
        // Elect best master listing
        const sortedItems = [...g.items].sort((a, b) => {
          if (a.status === 'published' && b.status !== 'published') return -1;
          if (b.status === 'published' && a.status !== 'published') return 1;
          return (b.images?.length || 0) - (a.images?.length || 0);
        });

        const master = sortedItems[0];
        const duplicates = sortedItems.slice(1);

        return {
          groupId: g.groupId,
          masterListingId: master._id,
          masterListing: {
            _id: master._id,
            title: master.title,
            sku: master.sku,
            price: master.price,
            images: master.images,
            thumbnail: master.thumbnail || (master.images && master.images[0]) || '',
            status: master.status,
            platform: master.platform
          },
          duplicateListings: duplicates.map(d => ({
            _id: d._id,
            title: d.title,
            sku: d.sku,
            price: d.price,
            thumbnail: d.thumbnail || (d.images && d.images[0]) || '',
            status: d.status,
            platform: d.platform
          })),
          duplicateCount: duplicates.length,
          totalListingsInGroup: g.items.length,
          channels: g.channels,
          channelCount: Object.keys(g.channels).length,
          selected: true
        };
      });

    res.status(200).json({
      success: true,
      totalMergeableGroups: mergeCandidates.length,
      groups: mergeCandidates
    });
  } catch (err) {
    console.error('[Get Local Merge Preview] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Execute bulk merge of local listings
// @route   POST /api/listings/bulk-merge
// @access  Private
exports.bulkMergeListings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groups } = req.body;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ success: false, message: 'No merge groups provided.' });
    }

    let mergedGroupsCount = 0;
    let deletedDuplicatesCount = 0;

    for (const grp of groups) {
      const masterListingId = grp.masterListingId;
      const duplicateIds = Array.isArray(grp.duplicateListings) 
        ? grp.duplicateListings.map(d => (typeof d === 'string' ? d : d._id))
        : [];

      if (!masterListingId || duplicateIds.length === 0) continue;

      const master = await Listing.findOne({ _id: masterListingId, user: userId });
      if (!master) continue;

      for (const dupId of duplicateIds) {
        const dup = await Listing.findOne({ _id: dupId, user: userId });
        if (!dup) continue;

        // Merge platforms from duplicate into master
        for (const plat of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
          const liveId = dup[`${plat}ListingId`];
          const url = dup[`${plat}Url`];
          const status = dup[`${plat}Status`];

          if (liveId && liveId !== 'undefined' && liveId !== 'null') {
            master[`${plat}ListingId`] = liveId;
          }
          if (url) {
            master[`${plat}Url`] = url;
          }
          if (status && status !== 'none' && status !== 'unlisted') {
            master[`${plat}Status`] = status;
          } else if (dup.platform === plat && dup.status === 'published') {
            master[`${plat}Status`] = 'published';
          }
        }

        // Merge platformData & platforms map & crosslistingDetails
        master.platformData = master.platformData || {};
        if (dup.platformData) {
          master.platformData = { ...master.platformData, ...dup.platformData };
        }
        if (dup.platform && !master.platformData[dup.platform]) {
          master.platformData[dup.platform] = {
            title: dup.title,
            description: dup.description,
            price: dup.price,
            brand: dup.brand,
            size: dup.size,
            color: dup.color,
            category: dup.category,
            categoryId: dup.categoryId,
            departmentId: dup.departmentId || '',
            subcategoryIds: dup.subcategoryIds || [],
            condition: dup.condition || dup.selectedCondition || '',
            itemSpecifics: dup.platform === 'ebay' ? (dup.itemSpecifics || {}) : {},
            url: dup[`${dup.platform}Url`] || dup.url || '',
            liveId: dup[`${dup.platform}ListingId`] || dup.liveId || dup._id,
            status: dup[`${dup.platform}Status`] || dup.status || 'published',
            images: dup.images,
            thumbnail: dup.thumbnail
          };
        }
        master.markModified('platformData');

        if (dup.platforms) {
          master.platforms = { ...(master.platforms || {}), ...dup.platforms };
          master.markModified('platforms');
        }
        if (dup.crosslistingDetails) {
          master.crosslistingDetails = { ...(master.crosslistingDetails || {}), ...dup.crosslistingDetails };
          master.markModified('crosslistingDetails');
        }

        // Merge images
        if (Array.isArray(dup.images) && dup.images.length > 0) {
          const existing = new Set(master.images || []);
          for (const img of dup.images) {
            if (img && !existing.has(img)) {
              master.images = master.images || [];
              master.images.push(img);
              existing.add(img);
            }
          }
        }

        // Ensure all platformData objects have the complete set of merged images
        if (master.images && master.images.length > 0 && master.platformData) {
          for (const plat of Object.keys(master.platformData)) {
            if (!master.platformData[plat].images || master.platformData[plat].images.length < master.images.length) {
              master.platformData[plat].images = master.images;
            }
          }
        }

        // If master is draft and dup was published, promote master status
        if (master.status === 'draft' && dup.status === 'published') {
          master.status = 'published';
        }

        // Safely delete duplicate listing document
        await Listing.findByIdAndDelete(dup._id);
        deletedDuplicatesCount++;
      }

      await master.save();
      mergedGroupsCount++;
    }

    res.status(200).json({
      success: true,
      mergedGroupsCount,
      deletedDuplicatesCount,
      message: `Successfully merged ${mergedGroupsCount} item clusters and cleaned up ${deletedDuplicatesCount} duplicate listings!`
    });
  } catch (err) {
    console.error('[Bulk Merge Listings] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};






