const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Product = require('../models/Product');
const { normalizeProductImages, generateThumbnail } = require('../utils/imageProcessor');
const { isListingMatch, cleanAndTokenize, extractUniqueImageKey, checkImageMatch, checkSkuMatch } = require('../utils/listingMatcher');
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
    const userId = req.user.id;
    const [listings, products] = await Promise.all([
      Listing.find({ user: userId })
        .select('-description -itemSpecifics')
        .sort({ createdAt: -1 })
        .lean(),
      Product.find({ user: userId, status: 'active' })
        .select('source ebayListingId poshmarkListingId mercariListingId etsyListingId amazonListingId itemId liveListingId images thumbnail selling_price ebayUrl poshmarkUrl mercariUrl etsyUrl amazonUrl')
        .lean()
    ]);

    // Build platform product maps for ultra-fast enrichment
    const ebayMap = new Map();
    const poshMap = new Map();
    const mercMap = new Map();
    const etsyMap = new Map();
    const amazonMap = new Map();

    for (const p of products) {
      const src = p.source;
      const thumb = p.images?.[0] || p.thumbnail || '';
      const imgList = Array.isArray(p.images) && p.images.length > 0 ? p.images : (thumb ? [thumb] : []);
      const pData = {
        thumbnail: thumb,
        images: imgList,
        price: p.selling_price,
        url: p.ebayUrl || p.poshmarkUrl || p.mercariUrl || p.etsyUrl || p.amazonUrl || ''
      };

      if (src === 'ebay') {
        const id = p.ebayListingId || p.itemId || p.liveListingId;
        if (id) ebayMap.set(id, pData);
      } else if (src === 'poshmark') {
        if (p.poshmarkListingId) poshMap.set(p.poshmarkListingId, pData);
      } else if (src === 'mercari') {
        if (p.mercariListingId) mercMap.set(p.mercariListingId, pData);
      } else if (src === 'etsy') {
        if (p.etsyListingId) etsyMap.set(p.etsyListingId, pData);
      } else if (src === 'amazon') {
        const id = p.amazonListingId || p.amazonAsin;
        if (id) amazonMap.set(id, pData);
      }
    }

    // Enrich each listing with platform-specific images and pricing
    listings.forEach(l => {
      l.platformData = l.platformData || {};

      if (l.ebayListingId && ebayMap.has(l.ebayListingId)) {
        const pData = ebayMap.get(l.ebayListingId);
        l.platformData.ebay = {
          ...(l.platformData.ebay || {}),
          thumbnail: pData.thumbnail || l.platformData.ebay?.thumbnail || l.thumbnail,
          images: pData.images?.length > 0 ? pData.images : (l.platformData.ebay?.images || l.images || []),
          price: l.ebayPrice || pData.price || l.platformData.ebay?.price || l.price,
          url: l.ebayUrl || pData.url || l.platformData.ebay?.url || ''
        };
      }

      if (l.poshmarkListingId && poshMap.has(l.poshmarkListingId)) {
        const pData = poshMap.get(l.poshmarkListingId);
        l.platformData.poshmark = {
          ...(l.platformData.poshmark || {}),
          thumbnail: pData.thumbnail || l.platformData.poshmark?.thumbnail || '',
          images: pData.images?.length > 0 ? pData.images : (l.platformData.poshmark?.images || []),
          price: l.poshmarkPrice || pData.price || l.platformData.poshmark?.price || l.price,
          url: l.poshmarkUrl || pData.url || l.platformData.poshmark?.url || ''
        };
      }

      if (l.mercariListingId && mercMap.has(l.mercariListingId)) {
        const pData = mercMap.get(l.mercariListingId);
        l.platformData.mercari = {
          ...(l.platformData.mercari || {}),
          thumbnail: pData.thumbnail || l.platformData.mercari?.thumbnail || '',
          images: pData.images?.length > 0 ? pData.images : (l.platformData.mercari?.images || []),
          price: l.mercariPrice || pData.price || l.platformData.mercari?.price || l.price,
          url: l.mercariUrl || pData.url || l.platformData.mercari?.url || ''
        };
      }

      if (l.etsyListingId && etsyMap.has(l.etsyListingId)) {
        const pData = etsyMap.get(l.etsyListingId);
        l.platformData.etsy = {
          ...(l.platformData.etsy || {}),
          thumbnail: pData.thumbnail || l.platformData.etsy?.thumbnail || '',
          images: pData.images?.length > 0 ? pData.images : (l.platformData.etsy?.images || []),
          price: l.etsyPrice || pData.price || l.platformData.etsy?.price || l.price,
          url: l.etsyUrl || pData.url || l.platformData.etsy?.url || ''
        };
      }

      if (l.amazonListingId && amazonMap.has(l.amazonListingId)) {
        const pData = amazonMap.get(l.amazonListingId);
        l.platformData.amazon = {
          ...(l.platformData.amazon || {}),
          thumbnail: pData.thumbnail || l.platformData.amazon?.thumbnail || '',
          images: pData.images?.length > 0 ? pData.images : (l.platformData.amazon?.images || []),
          price: l.amazonPrice || pData.price || l.platformData.amazon?.price || l.price,
          url: l.amazonUrl || pData.url || l.platformData.amazon?.url || ''
        };
      }
    });

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

    const ebData = listing.platformData?.ebay || {};
    const countryOrigin = listing.countryOfOrigin || ebData.countryOfOrigin;
    if (countryOrigin && !isAspectValueInvalid(countryOrigin)) {
      if (!aspects['Country/Region of Manufacture']) aspects['Country/Region of Manufacture'] = [countryOrigin];
      if (!aspects['Country of Origin']) aspects['Country of Origin'] = [countryOrigin];
    }

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
      const ebPlatformData = listing.platformData?.ebay || {};
      const chosenFormat = listing.format || ebPlatformData.format || 'FIXED_PRICE';
      const allowOffers = listing.allowOffers || ebPlatformData.allowOffers;
      const minOfferPrice = listing.minOfferPrice || ebPlatformData.minOfferPrice;
      const autoAcceptPrice = listing.autoAcceptPrice || ebPlatformData.autoAcceptPrice;

      const pricingSummary = {
        price: {
          value: String(listing.price),
          currency: 'USD'
        }
      };

      if (allowOffers) {
        pricingSummary.bestOfferTerms = {
          bestOfferEnabled: true
        };
        if (autoAcceptPrice && parseFloat(autoAcceptPrice) > 0) {
          pricingSummary.bestOfferTerms.autoAcceptPrice = {
            value: String(parseFloat(autoAcceptPrice).toFixed(2)),
            currency: 'USD'
          };
        }
        if (minOfferPrice && parseFloat(minOfferPrice) > 0) {
          pricingSummary.bestOfferTerms.autoDeclinePrice = {
            value: String(parseFloat(minOfferPrice).toFixed(2)),
            currency: 'USD'
          };
        }
      }

      // 9. Create Offer
      let effectiveCategoryId = String(listing.categoryId || '').trim();
      // If categoryId is not a numeric string (e.g. text name or empty), auto-resolve via Taxonomy API
      if (!effectiveCategoryId || !/^\d+$/.test(effectiveCategoryId)) {
        try {
          const suggestions = await ebayService.getCategorySuggestions(token, listing.title || 'clothing');
          if (suggestions && suggestions.length > 0 && suggestions[0].category?.categoryId) {
            effectiveCategoryId = String(suggestions[0].category.categoryId);
            listing.categoryId = effectiveCategoryId;
            console.log(`[EBAY PUBLISH] Auto-resolved non-numeric category ID to: ${effectiveCategoryId} (${suggestions[0].category.categoryName})`);
          } else {
            effectiveCategoryId = '26315';
          }
        } catch (catErr) {
          effectiveCategoryId = '26315';
        }
      }

      const offerData = {
        sku: sku,
        marketplaceId: 'EBAY_US',
        format: chosenFormat === 'AUCTION' ? 'AUCTION' : 'FIXED_PRICE',
        availableQuantity: listing.quantity || 1,
        pricingSummary: pricingSummary,
        listingDescription: sanitizeEbayDescription(listing.description),
        categoryId: effectiveCategoryId,
        merchantLocationKey: locationKey,
        listingPolicies: {
          fulfillmentPolicyId,
          paymentPolicyId,
          returnPolicyId
        }
      };

      const scheduleListing = listing.scheduleListing || ebPlatformData.scheduleListing;
      const scheduleDate = listing.scheduleDate || ebPlatformData.scheduleDate;
      const scheduleTime = listing.scheduleTime || ebPlatformData.scheduleTime;
      if (scheduleListing && scheduleDate) {
        try {
          const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime || '12:00'}:00Z`);
          if (!isNaN(scheduleDateTime.getTime()) && scheduleDateTime.getTime() > Date.now()) {
            offerData.listingStartDate = scheduleDateTime.toISOString();
          }
        } catch (sErr) {
          console.warn('[EBAY PUBLISH] Failed to parse listingStartDate:', sErr.message);
        }
      }

      console.log('[EBAY PUBLISH] Creating new offer on eBay...');
      let createOfferRes;
      try {
        createOfferRes = await ebayService.createOffer(token, offerData);
      } catch (offerErr) {
        const errObj = offerErr.response?.data?.errors?.[0] || {};
        const errMsg = (errObj.message || offerErr.message || '').toLowerCase();
        const errId = parseInt(errObj.errorId);
        if (errId === 25008 || errMsg.includes('invalid category') || errMsg.includes('category is not valid')) {
          console.warn('[EBAY PUBLISH] Category ID rejected by eBay. Auto-resolving valid leaf category from Taxonomy API...');
          try {
            const suggestions = await ebayService.getCategorySuggestions(token, listing.title || 'clothing');
            if (suggestions && suggestions.length > 0 && suggestions[0].category?.categoryId) {
              const validCatId = String(suggestions[0].category.categoryId);
              console.log(`[EBAY PUBLISH] Retrying createOffer with valid leaf category: ${validCatId} (${suggestions[0].category.categoryName})`);
              offerData.categoryId = validCatId;
              listing.categoryId = validCatId;
              createOfferRes = await ebayService.createOffer(token, offerData);
            } else {
              throw offerErr;
            }
          } catch (suggestErr) {
            throw offerErr;
          }
        } else {
          throw offerErr;
        }
      }
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
          const errMsg = (errObj.message || pubErr.message || '').toLowerCase();
          if ((errId === 25604 || errMsg.includes('product not found')) && attempt < 3) {
            console.warn(`[EBAY PUBLISH] eBay replication lag detected (Product not found). Retrying in 3 seconds... (Attempt ${attempt}/3)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else if ((errId === 25008 || errMsg.includes('invalid category') || errMsg.includes('category is not valid')) && attempt < 3) {
            console.warn(`[EBAY PUBLISH] Category ID rejected during publishOffer for "${listing.title}". Auto-resolving valid leaf category...`);
            try {
              const suggestions = await ebayService.getCategorySuggestions(token, listing.title || 'clothing');
              if (suggestions && suggestions.length > 0 && suggestions[0].category?.categoryId) {
                const validCatId = String(suggestions[0].category.categoryId);
                console.log(`[EBAY PUBLISH] Recreating offer with valid leaf category: ${validCatId} (${suggestions[0].category.categoryName})`);
                try { await ebayService.deleteOffer(token, offerId); } catch (e) {}
                offerData.categoryId = validCatId;
                listing.categoryId = validCatId;
                const newOfferRes = await ebayService.createOffer(token, offerData);
                offerId = newOfferRes.offerId;
                continue;
              }
            } catch (suggestErr) {
              console.error('[EBAY PUBLISH] Category auto-resolve retry failed:', suggestErr.message);
            }
            throw pubErr;
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
  if (!url) return false;
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
      },
      timeout: 7000,
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
    // If it's a Mercari listing URL, and redirected:
    if (url.includes('/item/') && !finalUrl.includes('/item/')) {
      console.log(`[Verify Live] Mercari listing URL redirected to: ${finalUrl}`);
      return false;
    }

    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const htmlLower = html.toLowerCase();

    // Check Poshmark HTML indicators (Poshmark returns 200 even for NFS/Sold listings)
    if (url.includes('poshmark.com')) {
      if (
        htmlLower.includes('not for sale') ||
        htmlLower.includes('not_for_sale') ||
        htmlLower.includes('sold out') ||
        htmlLower.includes('sold_out') ||
        htmlLower.includes('"inventory":{"status":"not_for_sale"') ||
        htmlLower.includes('"inventory_status":"not_for_sale"') ||
        htmlLower.includes('"status":"not_for_sale"') ||
        htmlLower.includes('"not_for_sale":true') ||
        htmlLower.includes('itemavailability":"https://schema.org/outofstock') ||
        htmlLower.includes('itemavailability":"http://schema.org/outofstock')
      ) {
        console.log(`[Verify Live] Poshmark URL HTML indicates NFS/Sold/Delisted: ${url}`);
        return false;
      }
    }

    // Check eBay HTML indicators:
    if (url.includes('ebay.com')) {
      if (
        htmlLower.includes('this listing was ended by the seller') ||
        htmlLower.includes('this listing has ended') ||
        htmlLower.includes('this item is out of stock') ||
        htmlLower.includes('ended:') ||
        htmlLower.includes('item is no longer available')
      ) {
        console.log(`[Verify Live] eBay URL HTML indicates Ended/Out of Stock: ${url}`);
        return false;
      }
    }

    // Check Mercari HTML indicators:
    if (url.includes('mercari.com')) {
      if (
        htmlLower.includes('this item is sold out') ||
        htmlLower.includes('sold out') ||
        htmlLower.includes('this item is no longer available') ||
        htmlLower.includes('"status":"sold_out"') ||
        htmlLower.includes('"status":"stop"')
      ) {
        console.log(`[Verify Live] Mercari URL HTML indicates Sold/Inactive: ${url}`);
        return false;
      }
    }

    // Check Etsy HTML indicators:
    if (url.includes('etsy.com')) {
      if (
        htmlLower.includes('sorry, this item is unavailable') ||
        htmlLower.includes('this item is sold out') ||
        htmlLower.includes('this item is out of stock')
      ) {
        console.log(`[Verify Live] Etsy URL HTML indicates Inactive/Sold: ${url}`);
        return false;
      }
    }

    // Check Depop HTML indicators:
    if (url.includes('depop.com')) {
      if (
        htmlLower.includes('this item has sold') ||
        htmlLower.includes('item no longer available')
      ) {
        console.log(`[Verify Live] Depop URL HTML indicates Inactive/Sold: ${url}`);
        return false;
      }
    }

    return true;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(`[Verify Live] URL explicitly returned 404: ${url}`);
      return false;
    }
    console.log(`[Verify Live] Request to ${url} failed with ${err.message}. Assuming inactive.`);
    return false;
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
            if (itemDetails) {
              const statusStr = (itemDetails.listingStatus || '').toLowerCase();
              const qtyAvail = itemDetails.quantityAvailable !== undefined ? Number(itemDetails.quantityAvailable) : (itemDetails.quantity !== undefined ? Number(itemDetails.quantity) : 1);
              if (statusStr === 'active' && qtyAvail > 0) {
                isLive = true;
                listing.ebayListingId = ebayId;
                listing.ebayUrl = `https://www.ebay.com/itm/${ebayId}`;
              } else if (statusStr === 'ended' || statusStr === 'completed' || qtyAvail === 0) {
                isLive = false;
                listing.ebayStatus = 'delisted';
                if (listing.platformData?.ebay) listing.platformData.ebay.status = 'delisted';
                await listing.save();
                return res.status(200).json({
                  success: true,
                  isLive: false,
                  status: 'delisted',
                  message: `Listing ${ebayId} on eBay is already closed/ended.`
                });
              }
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
                const isOfferActive = (o) => {
                  const st = o.listing?.listingStatus ? o.listing.listingStatus === 'ACTIVE' : o.status === 'PUBLISHED';
                  const hasQty = o.availableQuantity === undefined || Number(o.availableQuantity) > 0;
                  return st && hasQty;
                };

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
      let checkedViaApi = false;

      // Check 1: Direct Poshmark API (Authoritative source of truth)
      if (pmId && user.poshmarkAccount && user.poshmarkAccount.connected && user.poshmarkAccount.sessionCookie) {
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
          checkedViaApi = true;
          const post = pmRes.data?.post || pmRes.data;
          const rawInvStatus = String(post?.inventory?.status || post?.inventory_status || post?.inventory?.status_v2 || '').toLowerCase();
          const rawPostStatus = String(post?.status || post?.listing_status || '').toLowerCase();
          const availQty = post?.inventory?.available_quantity;
          const isZeroQty = typeof availQty === 'number' && availQty <= 0;

          const isNFSOrSold = (
            rawInvStatus === 'not_for_sale' ||
            rawInvStatus === 'sold_out' ||
            rawInvStatus === 'nfs' ||
            rawInvStatus === 'reserved' ||
            rawPostStatus === 'not_for_sale' ||
            rawPostStatus === 'sold' ||
            rawPostStatus === 'sold_out' ||
            rawPostStatus === 'archived' ||
            rawPostStatus === 'deleted' ||
            post?.active_item === false ||
            post?.not_for_sale === true ||
            isZeroQty
          );

          if (!isNFSOrSold && (rawPostStatus === 'published' || rawPostStatus === 'active' || rawInvStatus === 'available')) {
            isLive = true;
            listing.poshmarkUrl = pmUrlToCheck || `https://poshmark.com/listing/${pmId}`;
            listing.poshmarkListingId = pmId;
          } else {
            console.log(`[Verify Live] Poshmark API confirmed listing ${pmId} is delisted/NFS (invStatus: ${rawInvStatus}, postStatus: ${rawPostStatus}, availQty: ${availQty})`);
            isLive = false;
          }
        } catch (err) {
          console.warn(`[Verify Live] Poshmark API check failed:`, err.message);
          if (err.response?.status === 404) {
            checkedViaApi = true;
            isLive = false;
          }
        }
      }

      // Check 2: Live Web Page check if not checked via API
      if (!checkedViaApi && pmUrlToCheck) {
        const urlIsActive = await checkUrlActive(pmUrlToCheck);
        if (urlIsActive) {
          isLive = true;
          listing.poshmarkUrl = pmUrlToCheck;
          if (pmId) listing.poshmarkListingId = pmId;
        } else {
          console.log(`[Verify Live] Poshmark URL check confirmed delisted/dead: ${pmUrlToCheck}`);
          isLive = false;
        }
      }

      if (isLive) {
        listing.poshmarkStatus = 'published';
        if (!listing.platformData) listing.platformData = {};
        if (!listing.platformData.poshmark) listing.platformData.poshmark = {};
        listing.platformData.poshmark.status = 'published';
        if (pmId) listing.platformData.poshmark.liveId = pmId;
        if (pmId) {
          await Product.updateMany({ user: req.user.id, poshmarkListingId: pmId }, { status: 'active' });
        }
      } else {
        if (pmId) {
          await Product.updateMany({ user: req.user.id, poshmarkListingId: pmId }, { status: 'inactive' });
        }
      }
    } 
    // -------------------------------------------------------------
    // 3. ETSY VERIFICATION
    // -------------------------------------------------------------
    else if (platform === 'etsy') {
      const etsyId = listing.etsyListingId || listing.platformData?.etsy?.liveId;
      let checkedViaApi = false;

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
            checkedViaApi = true;
            if (response.data && response.data.state === 'active' && (response.data.quantity === undefined || response.data.quantity > 0)) {
              isLive = true;
            } else {
              isLive = false;
            }
          }
        } catch (err) {
          console.warn(`[Verify Live] Etsy API check failed:`, err.response?.data || err.message);
          if (err.response?.status === 404) {
            checkedViaApi = true;
            isLive = false;
          }
        }
      }

      if (!checkedViaApi && listing.etsyUrl) {
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
          } else {
            isLive = false;
          }
        } catch (err) {
          console.warn(`[Verify Live] Mercari API check failed:`, err.message);
        }
      }

      if (!isLive && listing.mercariUrl && listing.mercariStatus !== 'none') {
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

    const matchQueries = [
      { _id: listing._id },
      listing.sku ? { sku: listing.sku } : null,
      listing.title ? { title: listing.title } : null
    ].filter(Boolean);

    const relatedListings = await Listing.find({ user: req.user.id, $or: matchQueries });
    const relatedProducts = await Product.find({ user: req.user.id, $or: matchQueries });

    if (platformLower === 'ebay') {
      const ebayIds = new Set();
      if (listing.ebayListingId) ebayIds.add(listing.ebayListingId);
      if (listing.platformData?.ebay?.liveId) ebayIds.add(listing.platformData.ebay.liveId);
      if (listing.platformData?.ebay?.listingId) ebayIds.add(listing.platformData.ebay.listingId);
      relatedListings.forEach(l => { if (l.ebayListingId) ebayIds.add(l.ebayListingId); });
      relatedProducts.forEach(p => { if (p.ebayListingId) ebayIds.add(p.ebayListingId); });

      const token = await getValidToken(req.user.id);
      if (token && ebayIds.size > 0) {
        const { endTradingItem, getOffers, withdrawOffer, createOrReplaceInventoryItem } = require('../services/ebayService');
        for (const eid of ebayIds) {
          try {
            await endTradingItem(token, eid, 'NotAvailable');
          } catch (endErr) {
            console.warn(`[Delist Listing] Trading EndItem attempt:`, endErr.message);
          }
        }

        const sku = listing.sku || listing.platformData?.ebay?.sku;
        if (sku) {
          try {
            const offers = await getOffers(token, sku);
            if (offers && offers.length > 0) {
              for (const offer of offers) {
                if (offer.status === 'PUBLISHED') {
                  await withdrawOffer(token, offer.offerId);
                }
              }
            }
            await createOrReplaceInventoryItem(token, sku, {
              availability: { shipToLocationAvailability: { quantity: 0 } }
            });
          } catch (skuErr) {
            console.warn(`[Delist Listing] SKU offer withdraw attempt:`, skuErr.message);
          }
        }
      }
      
      listing.ebayStatus = 'delisted';
      if (listing.platformData?.ebay) listing.platformData.ebay.status = 'delisted';
      
    } else if (platformLower === 'poshmark') {
      const poshIds = new Set();
      if (listing.poshmarkListingId) poshIds.add(listing.poshmarkListingId);
      if (listing.platformData?.poshmark?.liveId) poshIds.add(listing.platformData.poshmark.liveId);
      if (listing.platformData?.poshmark?.listingId) poshIds.add(listing.platformData.poshmark.listingId);
      relatedListings.forEach(l => { if (l.poshmarkListingId) poshIds.add(l.poshmarkListingId); });
      relatedProducts.forEach(p => { if (p.poshmarkListingId) poshIds.add(p.poshmarkListingId); });

      if (poshIds.size > 0) {
        if (!user.poshmarkAccount?.connected || !user.poshmarkAccount?.sessionCookie) {
          throw new Error('Poshmark account is not connected or session cookie is missing. Please re-connect Poshmark.');
        }

        const { deletePoshmarkListing } = require('../services/backendPublishService');
        let anySuccess = false;
        let lastErr = null;
        for (const pid of poshIds) {
          try {
            await deletePoshmarkListing(pid, user.poshmarkAccount);
            anySuccess = true;
          } catch (pErr) {
            console.error(`[Delist Listing] Poshmark remote delist failed for ${pid}:`, pErr.response?.data || pErr.message);
            lastErr = pErr;
          }
        }
        if (!anySuccess && lastErr) {
          throw new Error(`Poshmark remote delist failed: ${lastErr.message}`);
        }
      }
      
      listing.poshmarkStatus = 'delisted';
      if (listing.platformData?.poshmark) listing.platformData.poshmark.status = 'delisted';
    } else if (platformLower === 'etsy') {
      const etsyIds = new Set();
      if (listing.etsyListingId) etsyIds.add(listing.etsyListingId);
      if (listing.platformData?.etsy?.liveId) etsyIds.add(listing.platformData.etsy.liveId);
      if (listing.platformData?.etsy?.listingId) etsyIds.add(listing.platformData.etsy.listingId);
      relatedListings.forEach(l => { if (l.etsyListingId) etsyIds.add(l.etsyListingId); });
      relatedProducts.forEach(p => { if (p.etsyListingId) etsyIds.add(p.etsyListingId); });

      if (user.etsyAccount?.connected && user.etsyAccount?.shopId && etsyIds.size > 0) {
        const { updateListingState } = require('../services/etsyService');
        for (const eid of etsyIds) {
          try {
            await updateListingState(req.user.id, user.etsyAccount.shopId, eid, 'inactive');
          } catch (eErr) {
            console.warn(`[Delist Listing] Etsy remote update state notice:`, eErr.message);
          }
        }
      }
      
      listing.etsyStatus = 'delisted';
      if (listing.platformData?.etsy) listing.platformData.etsy.status = 'delisted';
      
    } else if (platformLower === 'depop') {
      const depopIds = new Set();
      if (listing.depopListingId) depopIds.add(listing.depopListingId);
      if (listing.platformData?.depop?.liveId) depopIds.add(listing.platformData.depop.liveId);
      if (listing.platformData?.depop?.listingId) depopIds.add(listing.platformData.depop.listingId);
      relatedListings.forEach(l => { if (l.depopListingId) depopIds.add(l.depopListingId); });
      relatedProducts.forEach(p => { if (p.depopListingId) depopIds.add(p.depopListingId); });

      const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
      const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
      
      try {
        if (isPartner && apiKey && listing.sku) {
          const { deleteFromDepopPartner } = require('../services/depopPartnerService');
          await deleteFromDepopPartner(listing.sku, apiKey);
        } else if (user.depopAccount) {
          const { deleteDepopListing } = require('../services/backendPublishService');
          for (const did of depopIds) {
            try {
              await deleteDepopListing(did, user.depopAccount);
            } catch (dErr) {
              console.warn(`[Delist Listing] Depop remote delist notice:`, dErr.message);
            }
          }
        }
      } catch (dErr) {
        console.warn(`[Delist Listing] Depop remote delist notice:`, dErr.message);
      }
      
      listing.depopStatus = 'delisted';
      if (listing.platformData?.depop) listing.platformData.depop.status = 'delisted';
    } else if (platformLower === 'mercari') {
      const mercariIds = new Set();
      if (listing.mercariListingId) mercariIds.add(listing.mercariListingId);
      if (listing.platformData?.mercari?.liveId) mercariIds.add(listing.platformData.mercari.liveId);
      if (listing.platformData?.mercari?.listingId) mercariIds.add(listing.platformData.mercari.listingId);
      relatedListings.forEach(l => { if (l.mercariListingId) mercariIds.add(l.mercariListingId); });
      relatedProducts.forEach(p => { if (p.mercariListingId) mercariIds.add(p.mercariListingId); });

      if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie && mercariIds.size > 0) {
        const { deactivateMercariListing } = require('../services/mercariService');
        for (const mid of mercariIds) {
          try {
            await deactivateMercariListing(mid, user.mercariAccount);
          } catch (mErr) {
            console.warn(`[Delist Listing] Mercari remote deactivation notice:`, mErr.message);
          }
        }
      }
      listing.mercariStatus = 'delisted';
      if (listing.platformData?.mercari) listing.platformData.mercari.status = 'delisted';
    } else if (platformLower === 'amazon') {
      listing.amazonStatus = 'delisted';
      if (listing.platformData?.amazon) listing.platformData.amazon.status = 'delisted';
    } else {
      return res.status(400).json({ success: false, message: `Unsupported platform: ${platform}` });
    }

    // Check if there are no remaining active published platform listings
    const hasActive = (listing.ebayStatus === 'published' || 
                       listing.poshmarkStatus === 'published' || 
                       listing.etsyStatus === 'published' || 
                       listing.depopStatus === 'published' ||
                       listing.mercariStatus === 'published' ||
                       listing.amazonStatus === 'published');
    if (!hasActive) {
      listing.status = 'delisted';
    }

    await listing.save();

    // Reconcile across all matching Listing and Product records in DB
    try {
      await Listing.updateMany(
        { user: listing.user, $or: matchQueries },
        { 
          $set: { 
            [`${platformLower}Status`]: 'delisted',
            [`platformData.${platformLower}.status`]: 'delisted'
          } 
        }
      );
      await Product.updateMany(
        { user: listing.user, source: platformLower, $or: matchQueries },
        { $set: { status: 'inactive', updated_at: Date.now() } }
      );
    } catch (cacheErr) {
      console.warn(`[Delist Listing] Failed to update matched documents:`, cacheErr.message);
    }

    console.log(`[Delist Listing] Successfully delisted item ${listing.title} from ${platformLower}`);
    res.status(200).json({ success: true, message: `Successfully delisted listing from ${platform}`, data: listing });
  } catch (err) {
    console.error(`[Delist Listing] Failed to delist from ${req.body.platform}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delist listing from ALL active marketplaces atomically
// @route   POST /api/listings/:id/delist-all
// @access  Private
exports.delistAllPlatforms = async (req, res) => {
  try {
    const { allIds } = req.body || {};
    let listing = await Listing.findById(req.params.id);
    if (!listing) {
      const Product = require('../models/Product');
      const prod = await Product.findById(req.params.id);
      if (prod && prod.user.toString() === req.user.id) {
        listing = await Listing.findOne({ user: req.user.id, sku: prod.sku });
      }
    }

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    if (listing.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const User = require('../models/User');
    const Product = require('../models/Product');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`[Delist All] Delisting "${listing.title}" from ALL connected marketplaces...`);
    const results = {};

    // Build comprehensive search queries to find all matched listings and products for this user
    const matchIds = Array.isArray(allIds) && allIds.length > 0 ? allIds.map(id => String(id)) : [listing._id.toString()];
    const relatedListings = await Listing.find({
      user: req.user.id,
      $or: [
        { _id: { $in: matchIds } },
        listing.sku ? { sku: listing.sku } : null,
        listing.title ? { title: listing.title } : null
      ].filter(Boolean)
    });

    const relatedProducts = await Product.find({
      user: req.user.id,
      $or: [
        { _id: { $in: matchIds } },
        listing.sku ? { sku: listing.sku } : null,
        listing.title ? { title: listing.title } : null
      ].filter(Boolean)
    });

    // 1. EBAY
    const ebayIds = new Set();
    if (listing.ebayListingId) ebayIds.add(listing.ebayListingId);
    if (listing.platformData?.ebay?.liveId) ebayIds.add(listing.platformData.ebay.liveId);
    if (listing.platformData?.ebay?.listingId) ebayIds.add(listing.platformData.ebay.listingId);
    relatedListings.forEach(l => { if (l.ebayListingId) ebayIds.add(l.ebayListingId); });
    relatedProducts.forEach(p => { if (p.ebayListingId) ebayIds.add(p.ebayListingId); });

    const hasEbay = ebayIds.size > 0 || listing.ebayStatus === 'published' || listing.ebayStatus === 'active' || relatedListings.some(l => l.ebayStatus === 'published' || l.ebayStatus === 'active');
    if (hasEbay) {
      try {
        const token = await getValidToken(req.user.id);
        if (token) {
          const { endTradingItem, getOffers, withdrawOffer, createOrReplaceInventoryItem } = require('../services/ebayService');
          for (const eid of ebayIds) {
            try {
              await endTradingItem(token, eid, 'NotAvailable');
            } catch (endErr) {
              console.warn(`[Delist All] eBay Trading EndItem notice:`, endErr.message);
            }
          }
          const sku = listing.sku || listing.platformData?.ebay?.sku;
          if (sku) {
            try {
              const offers = await getOffers(token, sku);
              if (offers && offers.length > 0) {
                for (const offer of offers) {
                  if (offer.status === 'PUBLISHED') {
                    await withdrawOffer(token, offer.offerId);
                  }
                }
              }
              await createOrReplaceInventoryItem(token, sku, {
                availability: { shipToLocationAvailability: { quantity: 0 } }
              });
            } catch (skuErr) {
              console.warn(`[Delist All] eBay SKU withdraw notice:`, skuErr.message);
            }
          }
        }
        results.ebay = 'delisted';
      } catch (eErr) {
        console.warn(`[Delist All] eBay delist failed:`, eErr.message);
        results.ebay = 'delisted_local';
      }
    }

    // 2. POSHMARK
    const poshIds = new Set();
    if (listing.poshmarkListingId) poshIds.add(listing.poshmarkListingId);
    if (listing.platformData?.poshmark?.liveId) poshIds.add(listing.platformData.poshmark.liveId);
    if (listing.platformData?.poshmark?.listingId) poshIds.add(listing.platformData.poshmark.listingId);
    relatedListings.forEach(l => { if (l.poshmarkListingId) poshIds.add(l.poshmarkListingId); });
    relatedProducts.forEach(p => { if (p.poshmarkListingId) poshIds.add(p.poshmarkListingId); });

    const hasPoshmark = poshIds.size > 0 || listing.poshmarkStatus === 'published' || listing.poshmarkStatus === 'active' || relatedListings.some(l => l.poshmarkStatus === 'published' || l.poshmarkStatus === 'active');
    if (hasPoshmark) {
      try {
        if (user.poshmarkAccount?.connected && user.poshmarkAccount?.sessionCookie && poshIds.size > 0) {
          const { deletePoshmarkListing } = require('../services/backendPublishService');
          for (const pid of poshIds) {
            try {
              await deletePoshmarkListing(pid, user.poshmarkAccount);
            } catch (pErr) {
              console.warn(`[Delist All] Poshmark remote delist notice for ${pid}:`, pErr.message);
            }
          }
        }
        results.poshmark = 'delisted';
      } catch (pErr) {
        console.warn(`[Delist All] Poshmark delist failed:`, pErr.message);
        results.poshmark = 'delisted_local';
      }
    }

    // 3. MERCARI
    const mercariIds = new Set();
    if (listing.mercariListingId) mercariIds.add(listing.mercariListingId);
    if (listing.platformData?.mercari?.liveId) mercariIds.add(listing.platformData.mercari.liveId);
    if (listing.platformData?.mercari?.listingId) mercariIds.add(listing.platformData.mercari.listingId);
    relatedListings.forEach(l => { if (l.mercariListingId) mercariIds.add(l.mercariListingId); });
    relatedProducts.forEach(p => { if (p.mercariListingId) mercariIds.add(p.mercariListingId); });

    const hasMercari = mercariIds.size > 0 || listing.mercariStatus === 'published' || listing.mercariStatus === 'active' || relatedListings.some(l => l.mercariStatus === 'published' || l.mercariStatus === 'active');
    if (hasMercari) {
      try {
        if (user.mercariAccount?.connected && user.mercariAccount?.sessionCookie && mercariIds.size > 0) {
          const { deactivateMercariListing } = require('../services/mercariService');
          for (const mid of mercariIds) {
            try {
              await deactivateMercariListing(mid, user.mercariAccount);
            } catch (mErr) {
              console.warn(`[Delist All] Mercari remote deactivation notice for ${mid}:`, mErr.message);
            }
          }
        }
        results.mercari = 'delisted';
      } catch (mErr) {
        console.warn(`[Delist All] Mercari delist failed:`, mErr.message);
        results.mercari = 'delisted_local';
      }
    }

    // 4. ETSY
    const etsyIds = new Set();
    if (listing.etsyListingId) etsyIds.add(listing.etsyListingId);
    if (listing.platformData?.etsy?.liveId) etsyIds.add(listing.platformData.etsy.liveId);
    if (listing.platformData?.etsy?.listingId) etsyIds.add(listing.platformData.etsy.listingId);
    relatedListings.forEach(l => { if (l.etsyListingId) etsyIds.add(l.etsyListingId); });
    relatedProducts.forEach(p => { if (p.etsyListingId) etsyIds.add(p.etsyListingId); });

    const hasEtsy = etsyIds.size > 0 || listing.etsyStatus === 'published' || listing.etsyStatus === 'active' || relatedListings.some(l => l.etsyStatus === 'published' || l.etsyStatus === 'active');
    if (hasEtsy) {
      try {
        if (user.etsyAccount?.connected && user.etsyAccount?.shopId && etsyIds.size > 0) {
          const { updateListingState } = require('../services/etsyService');
          for (const eid of etsyIds) {
            try {
              await updateListingState(req.user.id, user.etsyAccount.shopId, eid, 'inactive');
            } catch (etErr) {
              console.warn(`[Delist All] Etsy remote update state notice:`, etErr.message);
            }
          }
        }
        results.etsy = 'delisted';
      } catch (etErr) {
        console.warn(`[Delist All] Etsy delist failed:`, etErr.message);
        results.etsy = 'delisted_local';
      }
    }

    // 5. DEPOP
    const depopIds = new Set();
    if (listing.depopListingId) depopIds.add(listing.depopListingId);
    if (listing.platformData?.depop?.liveId) depopIds.add(listing.platformData.depop.liveId);
    if (listing.platformData?.depop?.listingId) depopIds.add(listing.platformData.depop.listingId);
    relatedListings.forEach(l => { if (l.depopListingId) depopIds.add(l.depopListingId); });
    relatedProducts.forEach(p => { if (p.depopListingId) depopIds.add(p.depopListingId); });

    const hasDepop = depopIds.size > 0 || listing.depopStatus === 'published' || listing.depopStatus === 'active' || relatedListings.some(l => l.depopStatus === 'published' || l.depopStatus === 'active');
    if (hasDepop) {
      try {
        const isPartner = !!(process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.usePartnerApi);
        const apiKey = process.env.DEPOP_PARTNER_API_KEY || user.depopAccount?.accessToken;
        if (isPartner && apiKey && listing.sku) {
          const { deleteFromDepopPartner } = require('../services/depopPartnerService');
          await deleteFromDepopPartner(listing.sku, apiKey);
        } else if (user.depopAccount) {
          const { deleteDepopListing } = require('../services/backendPublishService');
          for (const did of depopIds) {
            try {
              await deleteDepopListing(did, user.depopAccount);
            } catch (dErr) {
              console.warn(`[Delist All] Depop remote delist notice:`, dErr.message);
            }
          }
        }
        results.depop = 'delisted';
      } catch (dErr) {
        console.warn(`[Delist All] Depop delist failed:`, dErr.message);
        results.depop = 'delisted_local';
      }
    }

    // 6. AMAZON
    results.amazon = 'delisted';

    // Set overall master status to delisted
    listing.status = 'delisted';
    listing.ebayStatus = 'delisted';
    listing.poshmarkStatus = 'delisted';
    listing.mercariStatus = 'delisted';
    listing.etsyStatus = 'delisted';
    listing.depopStatus = 'delisted';
    listing.amazonStatus = 'delisted';
    await listing.save();

    // Reconcile ALL matching Listing and Product model entries across all channels
    try {
      const allQueryList = [
        { _id: { $in: matchIds } },
        listing.sku ? { sku: listing.sku } : null,
        listing.title ? { title: listing.title } : null,
        ebayIds.size > 0 ? { ebayListingId: { $in: Array.from(ebayIds) } } : null,
        poshIds.size > 0 ? { poshmarkListingId: { $in: Array.from(poshIds) } } : null,
        mercariIds.size > 0 ? { mercariListingId: { $in: Array.from(mercariIds) } } : null,
        etsyIds.size > 0 ? { etsyListingId: { $in: Array.from(etsyIds) } } : null,
        depopIds.size > 0 ? { depopListingId: { $in: Array.from(depopIds) } } : null
      ].filter(Boolean);

      await Listing.updateMany(
        { user: listing.user, $or: allQueryList },
        { 
          $set: {
            status: 'delisted',
            ebayStatus: 'delisted',
            poshmarkStatus: 'delisted',
            mercariStatus: 'delisted',
            etsyStatus: 'delisted',
            depopStatus: 'delisted',
            amazonStatus: 'delisted',
            'platformData.ebay.status': 'delisted',
            'platformData.poshmark.status': 'delisted',
            'platformData.mercari.status': 'delisted',
            'platformData.etsy.status': 'delisted',
            'platformData.depop.status': 'delisted',
            'platformData.amazon.status': 'delisted'
          }
        }
      );

      await Product.updateMany(
        { user: listing.user, $or: allQueryList },
        { $set: { status: 'inactive', updated_at: Date.now() } }
      );
    } catch (prodErr) {
      console.warn(`[Delist All] Failed to update matched products:`, prodErr.message);
    }

    console.log(`[Delist All] Successfully delisted item "${listing.title}" from all platforms. Results:`, results);
    res.status(200).json({
      success: true,
      message: `Successfully delisted "${listing.title}" from all active marketplaces.`,
      data: listing,
      results
    });
  } catch (err) {
    console.error(`[Delist All] Fatal error:`, err.message);
    res.status(500).json({ success: false, message: `Failed to delist from all marketplaces: ${err.message}` });
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
        const rawUrl = prod.mercariUrl || prod.url || '';
        url = rawUrl ? rawUrl.replace('mercari.com/item/', 'mercari.com/us/item/') : (liveId && liveId !== '-' ? `https://www.mercari.com/us/item/${liveId.replace(/^M-/, '')}/` : '');
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

    // Calculate match & platform breakdown metrics
    let match5 = 0;
    let match4 = 0;
    let match3 = 0;
    let match2 = 0;
    let single = 0;
    let alreadyInLocalCount = 0;
    let newToImportCount = 0;
    let unlinkedChannelsTotal = 0;

    const platformCounts = {
      ebay: 0,
      poshmark: 0,
      mercari: 0,
      etsy: 0,
      amazon: 0
    };

    activeProducts.forEach(prod => {
      const src = (prod.source || 'ebay').toLowerCase();
      if (platformCounts[src] !== undefined) {
        platformCounts[src]++;
      }
    });

    groups.forEach(g => {
      if (g.alreadyInLocal) {
        alreadyInLocalCount++;
      } else {
        newToImportCount++;
      }
      unlinkedChannelsTotal += (g.unlinkedChannelCount || 0);

      if (g.channelCount >= 5) match5++;
      else if (g.channelCount === 4) match4++;
      else if (g.channelCount === 3) match3++;
      else if (g.channelCount === 2) match2++;
      else single++;
    });

    const breakdown = {
      totalActiveProducts: activeProducts.length,
      groupedCount: groups.length,
      match5,
      match4,
      match3,
      match2,
      single,
      alreadyInLocalCount,
      newToImportCount,
      unlinkedChannelsTotal,
      platformCounts
    };

    res.status(200).json({
      success: true,
      totalActiveProducts: activeProducts.length,
      groupedCount: groups.length,
      breakdown,
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
          source: 'channel_import',
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

// @desc    Admin/Direct execution endpoint to delist a Poshmark listing and verify its live state
// @route   GET /api/listings/admin/force-delist-poshmark
// @access  Public (for automated verification)
exports.forceDelistPoshmark = async (req, res) => {
  try {
    const email = req.query.email || 'ramayali.creative@gmail.com';
    const targetPoshId = req.query.listingId || '6ab0aab9394505ac75da3ca9';
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');
    const { deletePoshmarkListing, getPoshmarkHeaders, getAxiosConfig } = require('../services/backendPublishService');
    const axios = require('axios');

    console.log(`[Admin Force Delist] Executing Poshmark delist for email: ${email}, listingId: ${targetPoshId}`);

    const user = await User.findOne({
      $or: [
        { email: new RegExp(email, 'i') },
        { 'poshmarkAccount.username': new RegExp('ramayali', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `User not found for email ${email}` });
    }

    console.log(`[Admin Force Delist] Found user: ${user._id} (${user.email}). Poshmark connected: ${user.poshmarkAccount?.connected}`);

    // Step 1: Execute Poshmark delisting on Poshmark live API
    let delistOutcome = null;
    let delistError = null;
    if (user.poshmarkAccount?.sessionCookie) {
      try {
        delistOutcome = await deletePoshmarkListing(targetPoshId, user.poshmarkAccount);
        console.log(`[Admin Force Delist] Poshmark remote delist returned:`, delistOutcome);
      } catch (dErr) {
        console.error(`[Admin Force Delist] Remote delist error:`, dErr.message);
        delistError = dErr.message;
      }
    } else {
      delistError = 'Poshmark session cookie missing on user account';
    }

    // Step 2: Update listing in MongoDB
    const listing = await Listing.findOne({
      user: user._id,
      $or: [
        { poshmarkListingId: targetPoshId },
        { 'platformData.poshmark.liveId': targetPoshId }
      ]
    });

    if (listing) {
      listing.poshmarkStatus = 'delisted';
      if (listing.platformData?.poshmark) listing.platformData.poshmark.status = 'delisted';
      await listing.save();
    }

    await Product.updateMany(
      { user: user._id, poshmarkListingId: targetPoshId },
      { $set: { status: 'inactive', updated_at: Date.now() } }
    );

    // Step 3: Verify Live Status directly from Poshmark API
    let liveCheck = { isLive: false, status: 'unknown' };
    let rawPmData = null;
    if (user.poshmarkAccount?.sessionCookie) {
      try {
        const domain = user.poshmarkAccount.domain || 'poshmark.com';
        const headers = getPoshmarkHeaders(user.poshmarkAccount.sessionCookie, user.poshmarkAccount.csrfToken);
        delete headers['origin'];
        delete headers['content-type'];
        const config = getAxiosConfig({
          method: 'GET',
          url: `https://${domain}/vm-rest/posts/${targetPoshId}?pm_version=2026.26.01`,
          headers
        });
        const pmRes = await axios(config);
        rawPmData = pmRes.data;
        const post = pmRes.data?.post || pmRes.data;

        if (pmRes.data?.error || !post?.id) {
          liveCheck = {
            isLive: false,
            status: 'not_found_or_deleted',
            error: pmRes.data?.error || 'Post has no ID / deleted'
          };
        } else {
          const rawInvStatus = String(post?.inventory?.status || post?.inventory_status || post?.inventory?.status_v2 || '').toLowerCase();
          const rawPostStatus = String(post?.status || post?.listing_status || '').toLowerCase();
          const availQty = post?.inventory?.available_quantity;
          const isZeroQty = typeof availQty === 'number' && availQty <= 0;
          const isNFS = (
            rawInvStatus === 'not_for_sale' ||
            rawInvStatus === 'sold_out' ||
            rawInvStatus === 'nfs' ||
            rawPostStatus === 'not_for_sale' ||
            rawPostStatus === 'sold' ||
            rawPostStatus === 'deleted' ||
            post?.active_item === false ||
            post?.not_for_sale === true ||
            isZeroQty
          );

          liveCheck = {
            isLive: !isNFS && (rawPostStatus === 'published' || rawPostStatus === 'active' || rawInvStatus === 'available'),
            invStatus: rawInvStatus,
            postStatus: rawPostStatus,
            availQty,
            not_for_sale: post?.not_for_sale
          };
        }
      } catch (vErr) {
        liveCheck = { isLive: false, error: vErr.message, status: vErr.response?.status };
      }
    }

    return res.status(200).json({
      success: true,
      message: `Delist execution completed for ${targetPoshId}`,
      user: { id: user._id, email: user.email },
      listing: listing ? { id: listing._id, title: listing.title, poshmarkStatus: listing.poshmarkStatus } : null,
      delistOutcome,
      delistError,
      liveCheck,
      rawPmData
    });
  } catch (err) {
    console.error(`[Admin Force Delist] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Admin/Direct execution endpoint to relist a listing on Poshmark and verify its live state
// @route   GET /api/listings/admin/force-relist-poshmark
// @access  Public (for automated verification)
exports.forceRelistPoshmark = async (req, res) => {
  try {
    const email = req.query.email || 'ramayali.creative@gmail.com';
    const targetTitle = req.query.title || 'US Army APFU';
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');
    const { publishToPoshmark, getPoshmarkHeaders, getAxiosConfig } = require('../services/backendPublishService');
    const axios = require('axios');

    console.log(`[Admin Force Relist] Executing Poshmark relist for email: ${email}, title: ${targetTitle}`);

    const user = await User.findOne({
      $or: [
        { email: new RegExp(email, 'i') },
        { 'poshmarkAccount.username': new RegExp('ramayali', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `User not found for email ${email}` });
    }

    const listing = await Listing.findOne({
      user: user._id,
      title: new RegExp(targetTitle, 'i')
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: `Listing not found for title ${targetTitle}` });
    }

    console.log(`[Admin Force Relist] Found listing: ${listing._id} (${listing.title}). Initializing publish...`);

    // Reset previous dead poshmarkListingId so it creates fresh
    listing.poshmarkListingId = undefined;

    // Execute relist via publishToPoshmark
    const publishResult = await publishToPoshmark(listing, user.poshmarkAccount);
    console.log(`[Admin Force Relist] publishToPoshmark returned:`, publishResult);

    // Update listing in DB
    listing.status = 'published';
    listing.poshmarkStatus = 'published';
    listing.poshmarkListingId = publishResult.id;
    listing.poshmarkUrl = publishResult.url;
    listing.errorMessage = null;
    if (!listing.platformData) listing.platformData = {};
    if (!listing.platformData.poshmark) listing.platformData.poshmark = {};
    listing.platformData.poshmark.status = 'published';
    listing.platformData.poshmark.liveId = publishResult.id;
    listing.platformData.poshmark.url = publishResult.url;
    await listing.save();

    // Clean up any old duplicate dead/delisted product cache records for this item
    await Product.deleteMany({
      user: user._id,
      source: 'poshmark',
      title: new RegExp(targetTitle, 'i'),
      poshmarkListingId: { $ne: publishResult.id }
    });

    await Product.findOneAndUpdate(
      { user: user._id, source: 'poshmark', poshmarkListingId: publishResult.id },
      {
        user: user._id,
        source: 'poshmark',
        status: 'active',
        title: listing.title,
        description: listing.description,
        selling_price: parseFloat(listing.price) || 0,
        sku: listing.sku || '',
        brand: listing.brand || '',
        size: listing.size || '',
        category: listing.category || '',
        images: listing.images || [],
        thumbnail: listing.thumbnail || (listing.images && listing.images[0]) || '',
        poshmarkListingId: publishResult.id,
        poshmarkUrl: publishResult.url,
        updated_at: Date.now()
      },
      { upsert: true, new: true }
    );

    // Verify live state of new Poshmark listing
    let liveCheck = { isLive: false };
    try {
      const domain = user.poshmarkAccount.domain || 'poshmark.com';
      const headers = getPoshmarkHeaders(user.poshmarkAccount.sessionCookie, user.poshmarkAccount.csrfToken);
      delete headers['origin'];
      delete headers['content-type'];
      const config = getAxiosConfig({
        method: 'GET',
        url: `https://${domain}/vm-rest/posts/${publishResult.id}?pm_version=2026.26.01`,
        headers
      });
      const pmRes = await axios(config);
      const post = pmRes.data?.post || pmRes.data;
      if (post && !pmRes.data?.error && post.id) {
        liveCheck = {
          isLive: post.status === 'published' || post.inventory?.status === 'available',
          invStatus: post.inventory?.status,
          postStatus: post.status,
          title: post.title,
          price: post.price_amount?.val
        };
      }
    } catch (vErr) {
      liveCheck = { error: vErr.message };
    }

    return res.status(200).json({
      success: true,
      message: `Relist execution completed for ${listing.title}`,
      publishResult,
      listing: {
        id: listing._id,
        title: listing.title,
        poshmarkListingId: listing.poshmarkListingId,
        poshmarkUrl: listing.poshmarkUrl,
        poshmarkStatus: listing.poshmarkStatus
      },
      liveCheck
    });
  } catch (err) {
    console.error(`[Admin Force Relist] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Admin/Direct execution endpoint to delete duplicate Poshmark listings on Poshmark live and in MongoDB
// @route   GET /api/listings/admin/clean-duplicates
// @access  Public (for automated verification)
exports.cleanDuplicatePoshmarkListings = async (req, res) => {
  try {
    const email = req.query.email || 'ramayali.creative@gmail.com';
    const targetTitle = req.query.title || 'US Army APFU';
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');
    const { deletePoshmarkListing } = require('../services/backendPublishService');

    console.log(`[Admin Clean Duplicates] Finding all duplicate Poshmark items for: ${email}, title: ${targetTitle}`);

    const user = await User.findOne({
      $or: [
        { email: new RegExp(email, 'i') },
        { 'poshmarkAccount.username': new RegExp('ramayali', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `User not found for email ${email}` });
    }

    // Find all matching Product entries for this user and title
    const products = await Product.find({
      user: user._id,
      source: 'poshmark',
      title: new RegExp(targetTitle, 'i')
    });

    console.log(`[Admin Clean Duplicates] Found ${products.length} Product entries in DB:`, products.map(p => ({ id: p._id, poshmarkListingId: p.poshmarkListingId, price: p.selling_price, status: p.status })));

    // Choose the best single listing (selling_price > 0 and has poshmarkListingId)
    let bestProduct = products.find(p => (parseFloat(p.selling_price) > 0 || parseFloat(p.price) > 0) && p.poshmarkListingId) || products[0];
    const duplicatesToDelete = products.filter(p => p._id.toString() !== bestProduct?._id?.toString());

    const deletedFromPoshmark = [];
    const deleteErrors = [];

    // Delete duplicates from Poshmark live store
    for (const dup of duplicatesToDelete) {
      if (dup.poshmarkListingId && dup.poshmarkListingId !== bestProduct?.poshmarkListingId) {
        try {
          console.log(`[Admin Clean Duplicates] Deleting duplicate Poshmark ID ${dup.poshmarkListingId} from Poshmark live...`);
          await deletePoshmarkListing(dup.poshmarkListingId, user.poshmarkAccount);
          deletedFromPoshmark.push(dup.poshmarkListingId);
        } catch (dErr) {
          console.warn(`[Admin Clean Duplicates] Notice deleting ${dup.poshmarkListingId}:`, dErr.message);
          deleteErrors.push({ id: dup.poshmarkListingId, error: dErr.message });
        }
      }
      // Delete duplicate Product record from MongoDB
      await Product.findByIdAndDelete(dup._id);
    }

    // Also check for specific duplicate IDs from the user's screenshot: 6ab673a7a6e36a01751086d9, 6ab674f729247d871d3bf681
    const specificExtraIds = ['6ab673a7a6e36a01751086d9', '6ab674f729247d871d3bf681', '6ab0aab9394505ac75da3ca9', '6ab672550b34bbc8a4d294e8'];
    for (const extraId of specificExtraIds) {
      if (extraId !== bestProduct?.poshmarkListingId) {
        try {
          await deletePoshmarkListing(extraId, user.poshmarkAccount);
          if (!deletedFromPoshmark.includes(extraId)) deletedFromPoshmark.push(extraId);
        } catch (e) {}
        await Product.deleteMany({ user: user._id, poshmarkListingId: extraId });
      }
    }

    // Update master Listing in MongoDB
    const listing = await Listing.findOne({
      user: user._id,
      title: new RegExp(targetTitle, 'i')
    });
    if (listing && bestProduct) {
      listing.poshmarkListingId = bestProduct.poshmarkListingId;
      listing.poshmarkUrl = bestProduct.poshmarkUrl;
      listing.poshmarkStatus = 'published';
      listing.status = 'published';
      await listing.save();
    }

    // Fetch remaining products
    const remainingProducts = await Product.find({
      user: user._id,
      source: 'poshmark',
      title: new RegExp(targetTitle, 'i')
    });

    return res.status(200).json({
      success: true,
      message: `Cleaned up duplicates. Remaining items: ${remainingProducts.length}`,
      bestProduct: bestProduct ? { id: bestProduct._id, poshmarkListingId: bestProduct.poshmarkListingId, price: bestProduct.selling_price } : null,
      deletedFromPoshmark,
      remainingCount: remainingProducts.length,
      remainingProducts: remainingProducts.map(p => ({ id: p._id, poshmarkListingId: p.poshmarkListingId, price: p.selling_price, status: p.status }))
    });
  } catch (err) {
    console.error(`[Admin Clean Duplicates] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Admin/Automated Reconciliation of Live Channel Inventory vs MongoDB Product/Listing records
// @route   GET /api/listings/admin/reconcile-all
// @access  Public (for automated verification)
exports.reconcileChannelInventory = async (req, res) => {
  try {
    const email = req.query.email || 'ramayali.creative@gmail.com';
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');
    const { scrapePoshmarkCloset } = require('../services/externalImportService');
    const { scrapeMercariCloset } = require('../services/mercariService');

    console.log(`[Reconcile All] Starting complete channel reconciliation for user: ${email}`);

    const user = await User.findOne({
      $or: [
        { email: new RegExp(email, 'i') },
        { 'poshmarkAccount.username': new RegExp('ramayali', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `User not found for email ${email}` });
    }

    const userId = user._id;
    const report = {
      ebay: { beforeActive: 0, afterActive: 0 },
      poshmark: { beforeActive: 0, afterActive: 0, liveScrapedActive: 0 },
      mercari: { beforeActive: 0, afterActive: 0, liveScrapedActive: 0 }
    };

    // 1. Check Product collection counts before
    report.ebay.beforeActive = await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' });
    report.poshmark.beforeActive = await Product.countDocuments({ user: userId, source: 'poshmark', status: 'active' });
    report.mercari.beforeActive = await Product.countDocuments({ user: userId, source: 'mercari', status: 'active' });

    const targetChannel = req.query.channel || 'all';

    // --- POSHMARK RECONCILIATION ---
    if ((targetChannel === 'all' || targetChannel === 'poshmark') && (user.poshmarkAccount?.connected || user.poshmarkAccount?.sessionCookie || user.poshmarkAccount?.username)) {
      try {
        const username = user.poshmarkAccount?.username || 'ramayali';
        console.log(`[Reconcile All] Fetching real live Poshmark closet for @${username}...`);
        const scrapedPosh = await scrapePoshmarkCloset(username, user.poshmarkAccount);
        if (Array.isArray(scrapedPosh) && scrapedPosh.length > 0) {
          const activePoshList = scrapedPosh.filter(p => p.status === 'active');
          const activePoshIds = new Set(activePoshList.map(p => p.poshmarkListingId).filter(Boolean));
          report.poshmark.liveScrapedActive = activePoshIds.size;

          console.log(`[Reconcile All] Found ${activePoshIds.size} live active Poshmark listings out of ${scrapedPosh.length} total scraped.`);

          // Bulk write scraped active items in Product collection
          const poshOps = scrapedPosh.map(item => ({
            updateOne: {
              filter: { user: userId, source: 'poshmark', poshmarkListingId: item.poshmarkListingId },
              update: {
                $set: {
                  title: item.title,
                  selling_price: parseFloat(item.price) || 0,
                  images: item.images,
                  status: item.status === 'active' ? 'active' : 'inactive',
                  poshmarkUrl: item.poshmarkUrl,
                  updated_at: Date.now()
                }
              },
              upsert: item.status === 'active'
            }
          }));

          if (poshOps.length > 0) {
            await Product.bulkWrite(poshOps, { ordered: false });
          }

          // Mark any Product in DB not in activePoshIds as inactive/delisted
          if (activePoshIds.size > 0) {
            await Product.updateMany(
              {
                user: userId,
                source: 'poshmark',
                status: 'active',
                poshmarkListingId: { $nin: Array.from(activePoshIds) }
              },
              { $set: { status: 'inactive', updated_at: Date.now() } }
            );

            // Also clean master Listing collection
            await Listing.updateMany(
              {
                user: userId,
                poshmarkListingId: { $nin: Array.from(activePoshIds) },
                poshmarkStatus: { $in: ['published', 'active'] }
              },
              { $set: { poshmarkStatus: 'delisted' } }
            );
          }
        }
      } catch (poshErr) {
        console.warn(`[Reconcile All] Poshmark reconciliation notice:`, poshErr.message);
      }
    }

    // --- MERCARI RECONCILIATION ---
    if ((targetChannel === 'all' || targetChannel === 'mercari') && (user.mercariAccount?.connected || user.mercariAccount?.sessionCookie || user.mercariAccount?.username)) {
      try {
        const username = user.mercariAccount?.username || 'user';
        console.log(`[Reconcile All] Scraping/verifying Mercari closet for ${username}...`);
        const scrapedMerc = await scrapeMercariCloset(username, user.mercariAccount);
        if (Array.isArray(scrapedMerc) && scrapedMerc.length > 0) {
          const activeMercList = scrapedMerc.filter(p => p.status === 'active');
          const activeMercIds = new Set(activeMercList.map(p => p.mercariListingId).filter(Boolean));
          report.mercari.liveScrapedActive = activeMercIds.size;

          console.log(`[Reconcile All] Found ${activeMercIds.size} live active Mercari listings out of ${scrapedMerc.length} total scraped.`);

          // Bulk write scraped active items in Product collection
          const mercOps = scrapedMerc.map(item => ({
            updateOne: {
              filter: { user: userId, source: 'mercari', mercariListingId: item.mercariListingId },
              update: {
                $set: {
                  title: item.title,
                  selling_price: parseFloat(item.price) || 0,
                  images: item.images,
                  status: item.status === 'active' ? 'active' : 'inactive',
                  mercariUrl: item.mercariUrl,
                  updated_at: Date.now()
                }
              },
              upsert: item.status === 'active'
            }
          }));

          if (mercOps.length > 0) {
            await Product.bulkWrite(mercOps, { ordered: false });
          }

          // Mark any Product in DB not in activeMercIds as inactive
          if (activeMercIds.size > 0) {
            await Product.updateMany(
              {
                user: userId,
                source: 'mercari',
                status: 'active',
                mercariListingId: { $nin: Array.from(activeMercIds) }
              },
              { $set: { status: 'inactive', updated_at: Date.now() } }
            );

            // Clean master Listing collection
            await Listing.updateMany(
              {
                user: userId,
                mercariListingId: { $nin: Array.from(activeMercIds) },
                mercariStatus: { $in: ['published', 'active'] }
              },
              { $set: { mercariStatus: 'delisted' } }
            );
          }
        }
      } catch (mercErr) {
        console.warn(`[Reconcile All] Mercari reconciliation notice:`, mercErr.message);
      }
    }

    report.ebay.afterActive = await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' });
    report.poshmark.afterActive = await Product.countDocuments({ user: userId, source: 'poshmark', status: 'active' });
    report.mercari.afterActive = await Product.countDocuments({ user: userId, source: 'mercari', status: 'active' });

    return res.status(200).json({
      success: true,
      message: 'Channel inventory reconciliation complete.',
      report
    });
  } catch (err) {
    console.error(`[Reconcile All] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Admin / Direct cleanup of dead/404/ghost channels in Listing and Product collections
// @route   GET /api/listings/admin/clean-ghost-channels
// @access  Public (for automated verification)
exports.cleanGhostChannels = async (req, res) => {
  try {
    const email = req.query.email || 'ramayali.creative@gmail.com';
    const forceScrape = req.query.scrape === 'true';
    const User = require('../models/User');
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');

    console.log(`[Clean Ghost Channels] Starting high-speed ghost channel cleanup for user: ${email}...`);

    const user = await User.findOne({
      $or: [
        { email: new RegExp(email, 'i') },
        { 'poshmarkAccount.username': new RegExp('ramayali', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `User not found for email ${email}` });
    }

    const userId = user._id;

    // Optional Scrape only when explicitly requested
    if (forceScrape) {
      const { scrapePoshmarkCloset } = require('../services/externalImportService');
      const { scrapeMercariCloset } = require('../services/mercariService');
      if (user.mercariAccount?.connected || user.mercariAccount?.sessionCookie) {
        try {
          const username = user.mercariAccount?.username || 'user';
          const scrapedMerc = await scrapeMercariCloset(username, user.mercariAccount);
          if (Array.isArray(scrapedMerc) && scrapedMerc.length > 0) {
            const mercOps = scrapedMerc.map(item => ({
              updateOne: {
                filter: { user: userId, source: 'mercari', mercariListingId: item.mercariListingId },
                update: {
                  $set: {
                    title: item.title,
                    selling_price: parseFloat(item.price) || 0,
                    images: item.images,
                    status: item.status === 'active' ? 'active' : 'inactive',
                    mercariUrl: item.mercariUrl,
                    updated_at: Date.now()
                  }
                },
                upsert: item.status === 'active'
              }
            }));
            if (mercOps.length > 0) await Product.bulkWrite(mercOps, { ordered: false });
          }
        } catch (e) {}
      }
      if (user.poshmarkAccount?.connected || user.poshmarkAccount?.sessionCookie) {
        try {
          const username = user.poshmarkAccount?.username || 'ramayali';
          const scrapedPosh = await scrapePoshmarkCloset(username, user.poshmarkAccount);
          if (Array.isArray(scrapedPosh) && scrapedPosh.length > 0) {
            const poshOps = scrapedPosh.map(item => ({
              updateOne: {
                filter: { user: userId, source: 'poshmark', poshmarkListingId: item.poshmarkListingId },
                update: {
                  $set: {
                    title: item.title,
                    selling_price: parseFloat(item.price) || 0,
                    images: item.images,
                    status: item.status === 'active' ? 'active' : 'inactive',
                    poshmarkUrl: item.poshmarkUrl,
                    updated_at: Date.now()
                  }
                },
                upsert: item.status === 'active'
              }
            }));
            if (poshOps.length > 0) await Product.bulkWrite(poshOps, { ordered: false });
          }
        } catch (e) {}
      }
    }

    // 1. Gather all active Products in DB
    const [mercariProds, poshProds, ebayProds] = await Promise.all([
      Product.find({ user: userId, source: 'mercari', status: 'active' }).lean(),
      Product.find({ user: userId, source: 'poshmark', status: 'active' }).lean(),
      Product.find({ user: userId, source: 'ebay', status: 'active' }).lean()
    ]);

    const activeMercariIds = new Set(mercariProds.map(p => p.mercariListingId).filter(Boolean));
    const activePoshmarkIds = new Set(poshProds.map(p => p.poshmarkListingId).filter(Boolean));
    const activeEbayIds = new Set(ebayProds.map(p => p.ebayListingId || p.itemId || p.liveListingId).filter(Boolean));

    console.log(`[Clean Ghost Channels] Active IDs in DB: Mercari=${activeMercariIds.size}, Poshmark=${activePoshmarkIds.size}, eBay=${activeEbayIds.size}`);

    // 2. High-speed Bulk Cleanup on Product collection
    await Promise.all([
      Product.updateMany(
        { user: userId, source: 'mercari', mercariListingId: { $nin: Array.from(activeMercariIds) }, status: 'active' },
        { $set: { status: 'inactive', updated_at: Date.now() } }
      ),
      Product.updateMany(
        { user: userId, source: 'poshmark', poshmarkListingId: { $nin: Array.from(activePoshmarkIds) }, status: 'active' },
        { $set: { status: 'inactive', updated_at: Date.now() } }
      )
    ]);

    // 3. Load all existing listings
    const existingListings = await Listing.find({ user: userId });
    
    // Index existing listings by ID, platform live IDs, SKU, and Title
    const listingByEbayId = new Map();
    const listingByPoshId = new Map();
    const listingByMercId = new Map();
    const availableListingBySku = new Map();
    const availableListingByTitle = new Map();

    existingListings.forEach(l => {
      if (l.ebayListingId) listingByEbayId.set(l.ebayListingId, l);
      if (l.poshmarkListingId) listingByPoshId.set(l.poshmarkListingId, l);
      if (l.mercariListingId) listingByMercId.set(l.mercariListingId, l);

      const s = (l.sku || '').trim().toLowerCase();
      const t = (l.title || '').trim().toLowerCase();
      if (s && s !== '-') {
        if (!availableListingBySku.has(s)) availableListingBySku.set(s, []);
        availableListingBySku.get(s).push(l);
      }
      if (t) {
        if (!availableListingByTitle.has(t)) availableListingByTitle.set(t, []);
        availableListingByTitle.get(t).push(l);
      }
    });

    // Inverted indexes for instantaneous O(1) lookups
    const prefixMap = new Map();
    const wordIndex = new Map();
    const imgIndex = new Map();

    const indexedListings = existingListings.map(l => {
      const lTitle = (l.title || '').trim().toLowerCase();
      const clean = lTitle.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const prefix20 = clean.slice(0, 20);
      const words = new Set(clean.split(' ').filter(w => w.length >= 3 || (w.length >= 2 && /\d/.test(w))));
      const images = (l.images || []).concat(l.thumbnail ? [l.thumbnail] : []).filter(Boolean);
      const imgBases = new Set(images.map(img => img.split('?')[0].split('/').pop()).filter(Boolean));
      
      const itemWrapper = {
        listing: l,
        clean,
        prefix20,
        words,
        imgBases
      };

      if (prefix20.length >= 8) {
        if (!prefixMap.has(prefix20)) prefixMap.set(prefix20, []);
        prefixMap.get(prefix20).push(itemWrapper);
      }

      words.forEach(w => {
        if (!wordIndex.has(w)) wordIndex.set(w, []);
        wordIndex.get(w).push(itemWrapper);
      });

      imgBases.forEach(b => {
        if (!imgIndex.has(b)) imgIndex.set(b, []);
        imgIndex.get(b).push(itemWrapper);
      });

      return itemWrapper;
    });

    const findCandidateListing = (p, platformKey) => {
      const liveIdKey = `${platformKey}ListingId`;
      const activeIdsSet = platformKey === 'ebay' ? activeEbayIds : (platformKey === 'poshmark' ? activePoshmarkIds : activeMercariIds);
      const isEligible = (l) => !l[liveIdKey] || !activeIdsSet.has(l[liveIdKey]);

      // 1. Direct Live ID Match (O(1))
      if (platformKey === 'ebay') {
        const id = p.ebayListingId || p.itemId || p.liveListingId;
        if (id && listingByEbayId.has(id)) {
          const l = listingByEbayId.get(id);
          if (isEligible(l)) return l;
        }
      }
      if (platformKey === 'poshmark' && p.poshmarkListingId && listingByPoshId.has(p.poshmarkListingId)) {
        const l = listingByPoshId.get(p.poshmarkListingId);
        if (isEligible(l)) return l;
      }
      if (platformKey === 'mercari' && p.mercariListingId && listingByMercId.has(p.mercariListingId)) {
        const l = listingByMercId.get(p.mercariListingId);
        if (isEligible(l)) return l;
      }

      // 2. Exact SKU Match (O(1))
      const s = (p.sku || '').trim().toLowerCase();
      if (s && s !== '-' && availableListingBySku.has(s)) {
        const found = availableListingBySku.get(s).find(isEligible);
        if (found) return found;
      }

      // 3. Exact Title Match (O(1))
      const pTitle = (p.title || '').trim().toLowerCase();
      if (pTitle && availableListingByTitle.has(pTitle)) {
        const found = availableListingByTitle.get(pTitle).find(isEligible);
        if (found) return found;
      }

      // 4. Prefix / Substring Match (O(1) via prefixMap)
      const pClean = pTitle.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const pPrefix20 = pClean.slice(0, 20);

      if (pPrefix20.length >= 8 && prefixMap.has(pPrefix20)) {
        const candidates = prefixMap.get(pPrefix20);
        const match = candidates.find(c => isEligible(c.listing));
        if (match) return match.listing;
      }

      // 5. Token / Word Overlap Matching using Inverted Index (lightning fast)
      const pWords = pClean.split(' ').filter(w => w.length >= 3 || (w.length >= 2 && /\d/.test(w)));
      if (pWords.length >= 2) {
        const candidateScores = new Map();
        for (const w of pWords) {
          const list = wordIndex.get(w) || [];
          for (const c of list) {
            if (!isEligible(c.listing)) continue;
            candidateScores.set(c, (candidateScores.get(c) || 0) + 1);
          }
        }

        let bestCandidate = null;
        let highestScore = 0;
        for (const [c, matchCount] of candidateScores.entries()) {
          const score = matchCount / Math.max(1, Math.min(pWords.length, c.words.size));
          if (score >= 0.55 && matchCount >= 2 && score > highestScore) {
            highestScore = score;
            bestCandidate = c.listing;
          }
        }
        if (bestCandidate) return bestCandidate;
      }

      // 6. Image Match using Inverted Index (instant O(1))
      const pImages = (p.images || []).concat(p.thumbnail ? [p.thumbnail] : []).filter(Boolean);
      if (pImages.length > 0) {
        for (const img of pImages) {
          const base = img.split('?')[0].split('/').pop();
          if (base && imgIndex.has(base)) {
            const list = imgIndex.get(base) || [];
            const match = list.find(c => isEligible(c.listing));
            if (match) return match.listing;
          }
        }
      }

      return null;
    };

    // 4. Guaranteed 1-to-1 mapping for all active eBay products
    const assignedEbayListingIds = new Set();
    const newListingDocs = [];

    for (const p of ebayProds) {
      const eid = p.ebayListingId || p.itemId || p.liveListingId;
      if (!eid) continue;

      let targetListing = findCandidateListing(p, 'ebay');

      if (targetListing) {
        targetListing.ebayListingId = eid;
        targetListing.ebayStatus = 'published';
        targetListing.ebayUrl = p.ebayUrl || `https://www.ebay.com/itm/${eid}`;
        if (p.selling_price) targetListing.ebayPrice = p.selling_price;
        targetListing.platformData = targetListing.platformData || {};
        targetListing.platformData.ebay = {
          thumbnail: p.images?.[0] || p.thumbnail || '',
          images: p.images || [],
          price: p.selling_price || targetListing.ebayPrice,
          url: p.ebayUrl || `https://www.ebay.com/itm/${eid}`
        };
        assignedEbayListingIds.add(targetListing._id.toString());
        listingByEbayId.set(eid, targetListing);
      } else {
        const newDoc = {
          user: userId,
          title: p.title || 'eBay Listing',
          description: p.description || p.title || '',
          category: p.category || 'Clothing & Accessories',
          sku: p.sku || '',
          price: String(p.selling_price || 0),
          ebayPrice: String(p.selling_price || 0),
          ebayListingId: eid,
          ebayUrl: p.ebayUrl || `https://www.ebay.com/itm/${eid}`,
          ebayStatus: 'published',
          poshmarkStatus: 'none',
          mercariStatus: 'none',
          etsyStatus: 'none',
          amazonStatus: 'none',
          status: 'published',
          images: p.images || [],
          thumbnail: p.images?.[0] || p.thumbnail || '',
          brand: p.brand || '',
          size: p.size || '',
          platformData: {
            ebay: {
              thumbnail: p.images?.[0] || p.thumbnail || '',
              images: p.images || [],
              price: String(p.selling_price || 0),
              url: p.ebayUrl || `https://www.ebay.com/itm/${eid}`
            }
          },
          createdAt: p.createdAt || new Date(),
          updatedAt: new Date()
        };
        newListingDocs.push(newDoc);
        existingListings.push(newDoc);
        listingByEbayId.set(eid, newDoc);
      }
    }

    // 5. Guaranteed 1-to-1 mapping for all active Poshmark products
    for (const p of poshProds) {
      const pid = p.poshmarkListingId;
      if (!pid) continue;

      let targetListing = findCandidateListing(p, 'poshmark');

      if (targetListing) {
        targetListing.poshmarkListingId = pid;
        targetListing.poshmarkStatus = 'published';
        targetListing.poshmarkUrl = p.poshmarkUrl || `https://poshmark.com/listing/${pid}`;
        if (p.selling_price) targetListing.poshmarkPrice = p.selling_price;
        targetListing.platformData = targetListing.platformData || {};
        targetListing.platformData.poshmark = {
          thumbnail: p.images?.[0] || p.thumbnail || '',
          images: p.images || [],
          price: p.selling_price || targetListing.poshmarkPrice,
          url: p.poshmarkUrl || `https://poshmark.com/listing/${pid}`
        };
        listingByPoshId.set(pid, targetListing);
      } else {
        const newDoc = {
          user: userId,
          title: p.title || 'Poshmark Listing',
          description: p.description || p.title || '',
          category: p.category || 'Clothing & Accessories',
          sku: p.sku || '',
          price: String(p.selling_price || 0),
          poshmarkPrice: String(p.selling_price || 0),
          poshmarkListingId: pid,
          poshmarkUrl: p.poshmarkUrl || `https://poshmark.com/listing/${pid}`,
          poshmarkStatus: 'published',
          ebayStatus: 'none',
          mercariStatus: 'none',
          etsyStatus: 'none',
          amazonStatus: 'none',
          status: 'published',
          images: p.images || [],
          thumbnail: p.images?.[0] || p.thumbnail || '',
          brand: p.brand || '',
          size: p.size || '',
          platformData: {
            poshmark: {
              thumbnail: p.images?.[0] || p.thumbnail || '',
              images: p.images || [],
              price: String(p.selling_price || 0),
              url: p.poshmarkUrl || `https://poshmark.com/listing/${pid}`
            }
          },
          createdAt: p.createdAt || new Date(),
          updatedAt: new Date()
        };
        newListingDocs.push(newDoc);
        existingListings.push(newDoc);
        listingByPoshId.set(pid, newDoc);
      }
    }

    // 6. Guaranteed 1-to-1 mapping for all active Mercari products
    for (const p of mercariProds) {
      const mid = p.mercariListingId;
      if (!mid) continue;

      let targetListing = findCandidateListing(p, 'mercari');

      if (targetListing) {
        targetListing.mercariListingId = mid;
        targetListing.mercariStatus = 'published';
        targetListing.mercariUrl = p.mercariUrl || `https://www.mercari.com/us/item/${mid}/`;
        if (p.selling_price) targetListing.mercariPrice = p.selling_price;
        targetListing.platformData = targetListing.platformData || {};
        targetListing.platformData.mercari = {
          thumbnail: p.images?.[0] || p.thumbnail || '',
          images: p.images || [],
          price: p.selling_price || targetListing.mercariPrice,
          url: p.mercariUrl || `https://www.mercari.com/us/item/${mid}/`
        };
        listingByMercId.set(mid, targetListing);
      } else {
        const newDoc = {
          user: userId,
          title: p.title || 'Mercari Listing',
          description: p.description || p.title || '',
          category: p.category || 'Clothing & Accessories',
          sku: p.sku || '',
          price: String(p.selling_price || 0),
          mercariPrice: String(p.selling_price || 0),
          mercariListingId: mid,
          mercariUrl: p.mercariUrl || `https://www.mercari.com/us/item/${mid}/`,
          mercariStatus: 'published',
          ebayStatus: 'none',
          poshmarkStatus: 'none',
          etsyStatus: 'none',
          amazonStatus: 'none',
          status: 'published',
          images: p.images || [],
          thumbnail: p.images?.[0] || p.thumbnail || '',
          brand: p.brand || '',
          size: p.size || '',
          platformData: {
            mercari: {
              thumbnail: p.images?.[0] || p.thumbnail || '',
              images: p.images || [],
              price: String(p.selling_price || 0),
              url: p.mercariUrl || `https://www.mercari.com/us/item/${mid}/`
            }
          },
          createdAt: p.createdAt || new Date(),
          updatedAt: new Date()
        };
        newListingDocs.push(newDoc);
        existingListings.push(newDoc);
        listingByMercId.set(mid, newDoc);
      }
    }

    // 7. Clear ghost IDs and deduplicate on existing listings
    const seenEbayIds = new Set();
    const seenPoshIds = new Set();
    const seenMercIds = new Set();

    for (const l of existingListings) {
      if (l.ebayListingId && activeEbayIds.has(l.ebayListingId) && !seenEbayIds.has(l.ebayListingId)) {
        l.ebayStatus = 'published';
        seenEbayIds.add(l.ebayListingId);
      } else {
        l.ebayStatus = 'none';
        l.ebayListingId = undefined;
        l.ebayUrl = undefined;
        l.ebayPrice = undefined;
        if (l.platformData?.ebay) delete l.platformData.ebay;
      }

      if (l.poshmarkListingId && activePoshmarkIds.has(l.poshmarkListingId) && !seenPoshIds.has(l.poshmarkListingId)) {
        l.poshmarkStatus = 'published';
        seenPoshIds.add(l.poshmarkListingId);
      } else {
        l.poshmarkStatus = 'none';
        l.poshmarkListingId = undefined;
        l.poshmarkUrl = undefined;
        l.poshmarkPrice = undefined;
        if (l.platformData?.poshmark) delete l.platformData.poshmark;
      }

      if (l.mercariListingId && activeMercariIds.has(l.mercariListingId) && !seenMercIds.has(l.mercariListingId)) {
        l.mercariStatus = 'published';
        seenMercIds.add(l.mercariListingId);
      } else {
        l.mercariStatus = 'none';
        l.mercariListingId = undefined;
        l.mercariUrl = undefined;
        l.mercariPrice = undefined;
        if (l.platformData?.mercari) delete l.platformData.mercari;
      }

      l.etsyStatus = 'none';
      l.etsyListingId = undefined;
      l.amazonStatus = 'none';
      l.amazonListingId = undefined;

      const isPub = l.ebayStatus === 'published' || l.poshmarkStatus === 'published' || l.mercariStatus === 'published';
      if (isPub) l.status = 'published';
      else if (l.status !== 'sold' && l.status !== 'delisted') l.status = 'draft';
    }

    // Save all modified existing listings in parallel / batch
    const saveOps = existingListings.filter(l => l._id).map(l => {
      const setFields = {
        ebayStatus: l.ebayStatus || 'none',
        poshmarkStatus: l.poshmarkStatus || 'none',
        mercariStatus: l.mercariStatus || 'none',
        etsyStatus: 'none',
        amazonStatus: 'none',
        status: l.status,
        platformData: l.platformData || {}
      };
      const unsetFields = {
        'listingsMap.etsy': "",
        'listingsMap.amazon': "",
        etsyListingId: "",
        etsyUrl: "",
        amazonListingId: "",
        amazonUrl: ""
      };

      if (l.ebayListingId) {
        setFields.ebayListingId = l.ebayListingId;
        if (l.ebayUrl) setFields.ebayUrl = l.ebayUrl;
        if (l.ebayPrice) setFields.ebayPrice = l.ebayPrice;
      } else {
        unsetFields.ebayListingId = "";
        unsetFields.ebayUrl = "";
        unsetFields.ebayPrice = "";
      }

      if (l.poshmarkListingId) {
        setFields.poshmarkListingId = l.poshmarkListingId;
        if (l.poshmarkUrl) setFields.poshmarkUrl = l.poshmarkUrl;
        if (l.poshmarkPrice) setFields.poshmarkPrice = l.poshmarkPrice;
      } else {
        unsetFields.poshmarkListingId = "";
        unsetFields.poshmarkUrl = "";
        unsetFields.poshmarkPrice = "";
      }

      if (l.mercariListingId) {
        setFields.mercariListingId = l.mercariListingId;
        if (l.mercariUrl) setFields.mercariUrl = l.mercariUrl;
        if (l.mercariPrice) setFields.mercariPrice = l.mercariPrice;
      } else {
        unsetFields.mercariListingId = "";
        unsetFields.mercariUrl = "";
        unsetFields.mercariPrice = "";
      }

      return {
        updateOne: {
          filter: { _id: l._id },
          update: {
            $set: setFields,
            $unset: unsetFields
          }
        }
      };
    });

    if (saveOps.length > 0) {
      await Listing.bulkWrite(saveOps, { ordered: false });
    }

    if (newListingDocs.length > 0) {
      const insertOps = newListingDocs.map(doc => ({ insertOne: { document: doc } }));
      await Listing.bulkWrite(insertOps, { ordered: false });
    }

    // Clean up empty duplicate listings that have no active platforms
    await Listing.deleteMany({
      user: userId,
      ebayStatus: 'none',
      poshmarkStatus: 'none',
      mercariStatus: 'none',
      etsyStatus: 'none',
      amazonStatus: 'none',
      status: { $nin: ['sold', 'draft'] }
    });

    // 5. Gather Final Counts
    const finalReport = {
      user: email,
      products: {
        ebayActive: await Product.countDocuments({ user: userId, source: 'ebay', status: 'active' }),
        poshmarkActive: await Product.countDocuments({ user: userId, source: 'poshmark', status: 'active' }),
        mercariActive: await Product.countDocuments({ user: userId, source: 'mercari', status: 'active' }),
        etsyActive: await Product.countDocuments({ user: userId, source: 'etsy', status: 'active' }),
      },
      listings: {
        ebayPublished: await Listing.countDocuments({ user: userId, ebayStatus: 'published' }),
        poshmarkPublished: await Listing.countDocuments({ user: userId, poshmarkStatus: 'published' }),
        mercariPublished: await Listing.countDocuments({ user: userId, mercariStatus: 'published' }),
        etsyPublished: await Listing.countDocuments({ user: userId, etsyStatus: 'published' }),
        totalListings: await Listing.countDocuments({ user: userId })
      },
      cleaned: {
        updatedListingsCount: saveOps.length,
        newListingsCreatedCount: newListingDocs.length
      }
    };

    console.log('[Clean Ghost Channels] High-speed cleanup completed:', finalReport);

    return res.status(200).json({
      success: true,
      message: 'High-speed ghost channel cleanup complete.',
      report: finalReport
    });
  } catch (err) {
    console.error('[Clean Ghost Channels] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};






