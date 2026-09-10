const Order = require('../models/Order');
const axios = require('axios');
const { syncOrders: syncEbayOrders } = require('./ebayController');
const { syncPoshmarkOrders } = require('../services/poshmarkOrderService');

// @desc    Get all orders/sales for the logged-in user
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).sort({ createdDate: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve sales data',
      error: error.message
    });
  }
};

// @desc    Sync sales from connected platforms (eBay, Depop, Poshmark, Mercari, Etsy)
// @route   POST /api/orders/sync
// @access  Private
exports.syncOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');
    const user = await User.findById(userId);

    let ebaySyncStatus = 'skipped';
    let ebayCount = 0;

    // 1. Try to sync real eBay orders
    try {
      console.log('[OrderController] Syncing eBay orders...');
      const ebayResult = await syncEbayOrders(req, null);
      if (ebayResult && ebayResult.success) {
        ebaySyncStatus = 'success';
        ebayCount = ebayResult.count;
      }
    } catch (err) {
      console.warn('[OrderController] eBay order sync failed or not connected:', err.message);
      ebaySyncStatus = 'failed';
    }

    // 2. Try to sync Mercari orders (both trading & sold_out)
    let mercariSyncStatus = 'skipped';
    let mercariCount = 0;
    try {
      if (user?.mercariAccount?.connected && user?.mercariAccount?.sessionCookie) {
        console.log('[OrderController] Syncing Mercari orders...');
        const { syncMercariOrders } = require('../services/mercariService');
        const mercResult = await syncMercariOrders(user.mercariAccount, userId);
        if (mercResult && mercResult.success) {
          mercariSyncStatus = 'success';
          mercariCount = mercResult.count;
        }
      }
    } catch (mercErr) {
      console.warn('[OrderController] Mercari order sync failed:', mercErr.message);
      mercariSyncStatus = 'failed';
    }

    // 3. Try to sync Poshmark orders via Direct REST API
    let poshmarkSyncStatus = 'skipped';
    let poshmarkCount = 0;
    try {
      if (user?.poshmarkAccount?.connected && user?.poshmarkAccount?.sessionCookie) {
        console.log('[OrderController] Syncing Poshmark orders...');
        const poshResult = await syncPoshmarkOrders(user.poshmarkAccount, userId);
        if (poshResult && poshResult.success) {
          poshmarkSyncStatus = 'success';
          poshmarkCount = poshResult.count;
        }
      }
    } catch (poshErr) {
      console.warn('[OrderController] Poshmark order sync failed:', poshErr.message);
      poshmarkSyncStatus = 'failed';
    }

    const updatedOrders = await Order.find({ user: userId }).sort({ createdDate: -1 });

    return res.status(200).json({
      success: true,
      message: 'Sales synchronized successfully',
      ebayStatus: ebaySyncStatus,
      ebayCount: ebayCount,
      mercariStatus: mercariSyncStatus,
      mercariCount: mercariCount,
      poshmarkStatus: poshmarkSyncStatus,
      poshmarkCount: poshmarkCount,
      count: updatedOrders.length,
      data: updatedOrders
    });
  } catch (error) {
    console.error('Error syncing orders:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync sales',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status, updated_at: Date.now() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
};

// Helper: extract brand from title
const KNOWN_BRANDS = [
  'Lucky Brand', 'Hugo Boss', 'Eddie Bauer', 'Levi\'s', 'Levis', 'Nike', 'Adidas',
  'Under Armour', 'Columbia', 'The North Face', 'Tommy Bahama', 'Duluth Trading Co.',
  'Duluth Trading', 'American Eagle Outfitters', 'American Eagle', 'Silver Jeans',
  'Wrangler', 'Polo Ralph Lauren', 'Ralph Lauren', 'Carhartt', 'Patagonia', 'Lacoste',
  'Anthropologie', 'Free People', 'Lululemon', 'Hoka', 'Jordan', 'Reebok', 'Victoria\'s Secret',
  'Abercrombie & Fitch', 'Hollister', 'Guess', 'Calvin Klein', 'Tommy Hilfiger', 'Vans', 'Converse'
];

function extractBrandFromTitle(title) {
  if (!title) return '';
  for (const b of KNOWN_BRANDS) {
    const reg = new RegExp('\\b' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (reg.test(title)) return b;
  }
  return '';
}

function extractSizeFromTitle(title) {
  if (!title) return '';
  const wxL = title.match(/\b(\d{2,3}\s*[xX]\s*\d{2,3})\b/);
  if (wxL) return wxL[1].toLowerCase().replace(/\s+/g, '');
  const letter = title.match(/\b(?:Size\s+|Mens\s+|Womens\s+|Men's\s+|Women's\s+)?(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)\b/i);
  if (letter) return letter[1].toUpperCase();
  const shoe = title.match(/\bSize\s*(\d{1,2}(?:\.\d)?\s*[A-Z]?)\b/i);
  if (shoe) return shoe[1];
  return '';
}

function extractColorFromTitle(title) {
  if (!title) return '';
  const colors = ['Navy Blue', 'Navy', 'Black', 'Blue', 'Beige', 'Charcoal', 'Grey', 'Gray', 'White', 'Red', 'Green', 'Olive Green', 'Olive', 'Khaki', 'Brown', 'Tan', 'Pink', 'Purple', 'Orange', 'Yellow'];
  for (const c of colors) {
    const reg = new RegExp('\\b' + c + '\\b', 'i');
    if (reg.test(title)) return c;
  }
  return '';
}

function extractCategoryFromTitle(title) {
  if (!title) return 'Clothing';
  const t = title.toLowerCase();
  const isMen = t.includes('mens') || t.includes("men's") || t.includes(' men ');
  const isWomen = t.includes('womens') || t.includes("women's") || t.includes(' women ');
  const prefix = isWomen ? 'Women' : (isMen ? 'Men' : 'Unisex');

  if (t.includes('jean')) return `${prefix} > Jeans`;
  if (t.includes('pant') || t.includes('chino') || t.includes('trouser')) return `${prefix} > Pants`;
  if (t.includes('jacket') || t.includes('coat') || t.includes('windbreaker')) return `${prefix} > Coats & jackets`;
  if (t.includes('shirt') || t.includes('tee') || t.includes('t-shirt') || t.includes('top') || t.includes('polo')) return `${prefix} > Tops`;
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('boot')) return `${prefix} > Shoes`;
  if (t.includes('short')) return `${prefix} > Shorts`;
  if (t.includes('dress') || t.includes('skirt')) return `Women > Dresses`;
  return 'Clothing';
}

// @desc    Relist order item(s) by copying/creating them in Local Database listings
// @route   POST /api/orders/:id/relist
// @access  Private
exports.relistOrder = async (req, res) => {
  try {
    const Listing = require('../models/Listing');
    const Product = require('../models/Product');
    const User = require('../models/User');

    const user = await User.findById(req.user.id);
    const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const { lineItemId } = req.body || {};
    let targetItems = order.lineItems || [];

    // If specific lineItemId requested, filter to that item only
    if (lineItemId) {
      targetItems = targetItems.filter(li => li.lineItemId === lineItemId);
    }

    if (targetItems.length === 0) {
      targetItems = [{
        title: `Relisted Order ${order.orderId}`,
        price: order.totalAmount || 0,
        sku: '',
        thumbnail: ''
      }];
    }

    const createdListings = [];

    for (const lineItem of targetItems) {
      const title = lineItem?.title || `Relisted Order ${order.orderId}`;
      const price = lineItem?.price ? String(lineItem.price) : String(order.totalAmount || 0);
      const itemId = lineItem?.lineItemId || '';
      const originalSku = lineItem?.sku || '';
      const orderPlatform = (order.platform || 'ebay').toLowerCase();

      // 1. Search existing Listing or Product in DB
      let existingListing = null;
      if (itemId) {
        existingListing = await Listing.findOne({
          user: req.user.id,
          $or: [
            { mercariListingId: itemId },
            { ebayListingId: itemId },
            { poshmarkListingId: itemId },
            { depopListingId: itemId },
            { etsyListingId: itemId },
            { 'marketplaces.mercari.listingId': itemId },
            { 'marketplaces.poshmark.listingId': itemId }
          ]
        });
      }
      if (!existingListing && originalSku) {
        existingListing = await Listing.findOne({ user: req.user.id, sku: originalSku });
      }
      if (!existingListing && title) {
        existingListing = await Listing.findOne({ user: req.user.id, title: title });
      }

      // 2. Fetch live data from connected marketplace platform APIs
      let liveImages = [];
      let liveBrand = '';
      let liveBrandId = '';
      let liveSize = '';
      let liveSizeId = '';
      let liveColor = '';
      let liveCategory = '';
      let liveCategoryId = '';
      let liveDescription = '';
      let liveCondition = 'good';
      let liveConditionId = '';
      let liveOriginalPrice = '';
      let liveStyleTags = '';
      let liveShipping = null;

      // POSHMARK live fetch
      if (orderPlatform === 'poshmark' && user?.poshmarkAccount?.sessionCookie) {
        try {
          let postId = itemId;
          if (!postId || postId === order.orderId) {
            const thumbMatch = (lineItem?.thumbnail || '').match(/posts\/\d{4}\/\d{2}\/\d{2}\/([a-f0-9]+)/i);
            if (thumbMatch) postId = thumbMatch[1];
          }
          if (postId) {
            console.log(`[Relist Order] Fetching Poshmark post ${postId}...`);
            const poshRes = await axios.get(`https://poshmark.com/vm-rest/posts/${postId}`, {
              headers: {
                'cookie': user.poshmarkAccount.sessionCookie,
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
              },
              timeout: 10000
            });
            const pData = poshRes.data?.data || poshRes.data;
            if (pData) {
              liveImages = (pData.pictures || []).map(p => p.url).filter(Boolean);
              liveBrand = pData.brand || '';
              liveSize = pData.size || '';
              liveDescription = pData.description || '';
              if (pData.category_features?.[0]?.display) {
                liveCategory = `${pData.department?.display || 'Clothing'} > ${pData.category_features[0].display}`;
                liveCategoryId = pData.category_features[0].id || '';
              }
              liveOriginalPrice = String(pData.original_price_amount?.val || '');
            }
          }
        } catch (poshFetchErr) {
          console.warn('[Relist Order] Could not fetch Poshmark live details:', poshFetchErr.message);
        }
      }

      // MERCARI live fetch
      if (orderPlatform === 'mercari' && user?.mercariAccount?.connected) {
        try {
          const mercId = itemId && itemId.startsWith('m') ? itemId : (order.orderUrl ? order.orderUrl.split('/item/')[1]?.replace('/', '') : '');
          if (mercId) {
            console.log(`[Relist Order] Fetching Mercari item ${mercId}...`);
            const { fetchMercariItemDetails } = require('../services/mercariService');
            const mDetails = await fetchMercariItemDetails(mercId, user.mercariAccount);
            if (mDetails) {
              liveImages = mDetails.images || [];
              liveBrand = mDetails.brand || '';
              liveBrandId = mDetails.brandId || '';
              liveSize = mDetails.size || '';
              liveSizeId = mDetails.sizeId || '';
              liveCategory = mDetails.category || '';
              liveCategoryId = mDetails.categoryId || '';
              liveDescription = mDetails.description || '';
              liveCondition = mDetails.selectedCondition || 'good';
              liveConditionId = mDetails.conditionId || '';
              liveShipping = {
                shippingPayer: mDetails.shippingPayer || 'buyer',
                shippingMethod: 'prepaid',
                shippingWeightLbs: 1,
                shippingWeightOz: 0,
                shippingCarrier: 'USPS Ground Advantage',
                shippingPrice: '4.30'
              };
            }
          }
        } catch (mercFetchErr) {
          console.warn('[Relist Order] Could not fetch Mercari live details:', mercFetchErr.message);
        }
      }

      // 3. Fallbacks and combining data
      const finalImages = (liveImages.length > 0)
        ? liveImages
        : (existingListing?.images?.length > 0)
          ? existingListing.images
          : (lineItem?.thumbnail ? [lineItem.thumbnail] : []);

      const finalBrand = liveBrand || existingListing?.brand || extractBrandFromTitle(title);
      const finalSize = liveSize || existingListing?.size || extractSizeFromTitle(title);
      const finalColor = liveColor || existingListing?.color || extractColorFromTitle(title);
      const finalCategory = liveCategory || existingListing?.category || extractCategoryFromTitle(title);
      const finalDescription = liveDescription || existingListing?.description || `${title}.\n- Brand: ${finalBrand || 'N/A'}\n- Size: ${finalSize || 'N/A'}\n- Condition: Pre-owned in good condition.`;

      const skuTimestamp = Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
      const newSku = originalSku 
        ? `${originalSku.replace(/-RELIST-\d+$/i, '')}-RELIST-${skuTimestamp}`
        : `RL-${skuTimestamp}`;

      const listingData = {
        user: req.user.id,
        title: existingListing?.title || title,
        description: finalDescription,
        price: price || '0',
        originalPrice: liveOriginalPrice || existingListing?.originalPrice || '',
        sku: newSku,
        category: finalCategory,
        categoryId: liveCategoryId || existingListing?.categoryId || '',
        brand: finalBrand,
        brandId: liveBrandId || existingListing?.brandId || '',
        size: finalSize,
        sizeId: liveSizeId || existingListing?.sizeId || '',
        color: finalColor,
        styleTag: liveStyleTags || existingListing?.styleTag || '',
        images: finalImages,
        thumbnail: finalImages[0] || lineItem?.thumbnail || '',
        selectedCondition: liveCondition,
        conditionId: liveConditionId || existingListing?.conditionId || '',
        status: 'draft',
        platform: orderPlatform,
        source: orderPlatform,
        itemSpecifics: existingListing?.itemSpecifics || {
          ...(finalBrand ? { 'Brand': finalBrand } : {}),
          ...(finalSize ? { 'Size': finalSize } : {}),
          ...(finalColor ? { 'Color': finalColor } : {})
        },
        ...(liveShipping || {}),
        createdDate: new Date(),
        updated_at: new Date()
      };

      if (orderPlatform === 'mercari') {
        listingData.mercariStatus = 'draft';
      } else if (orderPlatform === 'poshmark') {
        listingData.poshmarkStatus = 'draft';
      } else if (orderPlatform === 'depop') {
        listingData.depopStatus = 'draft';
      } else if (orderPlatform === 'etsy') {
        listingData.etsyStatus = 'draft';
      } else {
        listingData.ebayStatus = 'draft';
      }

      const newListing = new Listing(listingData);
      await newListing.save();
      createdListings.push(newListing);
    }

    return res.status(201).json({
      success: true,
      message: `${createdListings.length} item(s) successfully copied to Local Database drafts!`,
      data: createdListings.length === 1 ? createdListings[0] : createdListings,
      count: createdListings.length
    });
  } catch (error) {
    console.error('Error relisting order item:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to relist order item',
      error: error.message
    });
  }
};

