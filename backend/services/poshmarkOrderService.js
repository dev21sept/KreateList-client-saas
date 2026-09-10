const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Listing = require('../models/Listing');

/**
 * Extract domain from session cookie
 */
function getDomainFromCookie(sessionCookie) {
  if (sessionCookie) {
    const match = sessionCookie.match(/elister_domain=([^;]+)/);
    if (match) {
      return match[1].trim().replace(/^www\./i, '');
    }
  }
  return 'poshmark.com';
}

/**
 * Clean domain metadata from cookie string
 */
function cleanCookieHeader(sessionCookie) {
  if (!sessionCookie) return '';
  return sessionCookie.replace(/;\s*elister_domain=[^;]+/, '').replace(/elister_domain=[^;]+;\s*/, '').trim();
}

/**
 * Extract Poshmark user ID from JWT or UI cookie
 */
function getUserIdFromSessionCookie(sessionCookie) {
  if (sessionCookie) {
    // 1. Try parsing from jwt cookie
    const jwtMatch = sessionCookie.match(/jwt=([^;]+)/);
    if (jwtMatch) {
      try {
        const payloadBase64 = jwtMatch[1].split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        if (payload.user_id) {
          return payload.user_id;
        }
      } catch (e) {
        console.warn('[Poshmark Order Sync] Error parsing user ID from jwt:', e.message);
      }
    }

    // 2. Try parsing from ui cookie
    const uiMatch = sessionCookie.match(/ui=([^;]+)/);
    if (uiMatch) {
      try {
        const decoded = decodeURIComponent(uiMatch[1]);
        const uiObj = JSON.parse(decoded);
        if (uiObj && uiObj.uid) {
          return uiObj.uid;
        }
      } catch (e) {
        console.warn('[Poshmark Order Sync] Error parsing user ID from ui cookie:', e.message);
      }
    }
  }
  return null;
}

/**
 * Normalize Poshmark order status to standard system format
 */
function normalizePoshmarkOrderStatus(statusStr, displayStatusStr) {
  const s = String(statusStr || '').toLowerCase().trim();
  const d = String(displayStatusStr || '').toLowerCase().trim();

  if (s.includes('deliver') || d.includes('deliver') || s.includes('complete') || d.includes('complete')) return 'Delivered';
  if (s.includes('ship') || d.includes('ship') || s.includes('transit') || d.includes('transit')) return 'Shipped';
  if (s.includes('cancel') || d.includes('cancel') || s.includes('refund') || d.includes('refund')) return 'Cancelled';
  if (s.includes('confirm') || s.includes('pending') || d.includes('pending') || s.includes('sold') || d.includes('sold')) return 'Pending';
  return 'Pending';
}

/**
 * Fetch and sync sales/orders from Poshmark
 * @param {Object} credentials { sessionCookie, csrfToken, username }
 * @param {string} userId MongoDB User ID
 * @returns {Promise<Object>} Outcome metrics
 */
async function syncPoshmarkOrders(credentials = {}, userId = null) {
  console.log(`[Poshmark Order Sync] Initializing order sync for User: ${userId}...`);

  if (!credentials.sessionCookie) {
    throw new Error('Poshmark session cookie is missing.');
  }

  const domain = getDomainFromCookie(credentials.sessionCookie);
  const cleanCookie = cleanCookieHeader(credentials.sessionCookie);
  const csrfToken = credentials.csrfToken || '';

  const headers = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'cookie': cleanCookie,
    'x-xsrf-token': csrfToken,
    'x-csrf-token': csrfToken,
    'origin': `https://${domain}`,
    'referer': `https://${domain}/order/sales`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin'
  };

  // 1. Resolve Poshmark User ID
  let poshmarkUserId = getUserIdFromSessionCookie(credentials.sessionCookie);
  if (!poshmarkUserId && credentials.username) {
    try {
      console.log(`[Poshmark Order Sync] Attempting to resolve User ID for ${credentials.username}...`);
      const selfRes = await axios.get(`https://${domain}/vm-rest/users/${credentials.username}`, {
        headers,
        timeout: 10000
      });
      poshmarkUserId = selfRes.data?.data?.id || selfRes.data?.id;
    } catch (selfErr) {
      console.warn('[Poshmark Order Sync] Could not resolve user ID via profile endpoint:', selfErr.message);
    }
  }

  // Fallback to username if ID still not found
  const userIdentifier = poshmarkUserId || credentials.username || 'self';
  console.log(`[Poshmark Order Sync] Querying Poshmark sales endpoint for user identifier: ${userIdentifier}`);

  let allSales = [];
  let maxId = null;
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const requestPayload = { filters: {}, count: 100 };
    if (maxId) requestPayload.max_id = maxId;

    const apiUrl = `https://${domain}/vm-rest/users/${userIdentifier}/orders/sales?request=${encodeURIComponent(JSON.stringify(requestPayload))}&pm_version=vue3.2026.36.00`;

    try {
      const response = await axios.get(apiUrl, {
        headers,
        timeout: 20000
      });

      const responseData = response.data;
      const salesBatch = responseData?.data?.sales_summary || responseData?.data || responseData?.orders || (Array.isArray(responseData) ? responseData : []);
      
      if (!Array.isArray(salesBatch) || salesBatch.length === 0) {
        break;
      }

      allSales.push(...salesBatch);

      const more = responseData?.more;
      if (more && more.next_max_id && salesBatch.length >= 100) {
        maxId = more.next_max_id;
        page++;
      } else {
        break;
      }
    } catch (err) {
      console.error(`[Poshmark Order Sync] Error fetching sales page ${page}:`, err.response?.data || err.message);
      if (allSales.length === 0) {
        throw new Error(`Failed to fetch Poshmark sales: ${err.response?.data?.error?.errorMessage || err.message}`);
      }
      break;
    }
  }

  console.log(`[Poshmark Order Sync] Total raw sales fetched: ${allSales.length}`);

  let syncedCount = 0;
  for (const sale of allSales) {
    try {
      const orderId = sale.id || sale.order_id || sale.order_number || sale._id;
      if (!orderId) continue;

      // Extract Buyer
      const buyerUsername = sale.buyer?.username || sale.buyer?.display_handle || sale.shipping_address?.name || sale.buyer?.full_name || 'poshmark_buyer';

      // Extract Amount & Currency
      let totalAmount = 0;
      if (sale.total_price_amount?.val !== undefined) {
        totalAmount = parseFloat(sale.total_price_amount.val) || 0;
      } else if (sale.order_total?.amount !== undefined) {
        totalAmount = parseFloat(sale.order_total.amount) || 0;
      } else if (sale.total?.amount !== undefined) {
        totalAmount = parseFloat(sale.total.amount) || 0;
      } else if (sale.seller_earning_amount?.val !== undefined) {
        totalAmount = parseFloat(sale.seller_earning_amount.val) || 0;
      } else if (sale.price !== undefined) {
        totalAmount = parseFloat(sale.price) || 0;
      } else if (typeof sale.order_total === 'number') {
        totalAmount = sale.order_total;
      }

      const currency = sale.total_price_amount?.currency_code || sale.order_total?.currency || 'USD';
      const status = normalizePoshmarkOrderStatus(sale.state || sale.status || sale.order_status, sale.display_status);
      const createdDate = sale.inventory_booked_at || sale.created_at || sale.order_created_at || sale.date_created || new Date();

      // Extract Line Items (handles single items, multi-item bundle orders, and nested posts)
      const rawPosts = sale.posts || sale.items || sale.order_items || (sale.post ? [sale.post] : []);
      const lineItems = [];

      if (rawPosts && rawPosts.length > 0) {
        for (const item of rawPosts) {
          const itemId = item.id || item.post_id || '';
          const title = item.title || item.name || 'Poshmark Listing';
          const price = parseFloat(item.price || item.inventory?.price || item.selling_price || 0);
          const quantity = item.count || item.quantity || 1;
          let sku = item.inventory?.sku || item.sku || '';
          let thumbnail = item.cover_shot?.url || item.pictures?.[0]?.url || item.picture_url || item.thumbnail || '';

          // Enrich from DB if thumbnail or sku is missing
          if (!thumbnail || !sku) {
            try {
              const matchedProd = await Product.findOne({
                user: userId,
                $or: [
                  { poshmarkListingId: itemId ? itemId : '___NONE___' },
                  { title: title }
                ]
              }).select('images sku');

              if (matchedProd) {
                if (!thumbnail && matchedProd.images?.length > 0) thumbnail = matchedProd.images[0];
                if (!sku && matchedProd.sku) sku = matchedProd.sku;
              } else {
                const matchedListing = await Listing.findOne({
                  user: userId,
                  $or: [
                    { poshmarkListingId: itemId ? itemId : '___NONE___' },
                    { title: title }
                  ]
                }).select('images photoUrls sku');

                if (matchedListing) {
                  if (!thumbnail) thumbnail = matchedListing.images?.[0] || matchedListing.photoUrls?.[0] || '';
                  if (!sku && matchedListing.sku) sku = matchedListing.sku;
                }
              }
            } catch (enrichErr) {}
          }

          lineItems.push({
            lineItemId: itemId,
            title,
            sku,
            quantity,
            price: price || totalAmount,
            thumbnail: thumbnail || ''
          });
        }
      } else {
        // Direct item in sales_summary
        let thumbnail = sale.picture_url || sale.cover_shot?.url || '';
        let sku = '';
        const title = sale.title || `Poshmark Sale #${orderId}`;

        try {
          const matchedProd = await Product.findOne({
            user: userId,
            title: title
          }).select('images sku poshmarkListingId');

          if (matchedProd) {
            if (!thumbnail && matchedProd.images?.length > 0) thumbnail = matchedProd.images[0];
            if (matchedProd.sku) sku = matchedProd.sku;
          } else {
            const matchedListing = await Listing.findOne({
              user: userId,
              title: title
            }).select('images photoUrls sku poshmarkListingId');

            if (matchedListing) {
              if (!thumbnail) thumbnail = matchedListing.images?.[0] || matchedListing.photoUrls?.[0] || '';
              if (matchedListing.sku) sku = matchedListing.sku;
            }
          }
        } catch (enrichErr) {}

        lineItems.push({
          lineItemId: String(orderId),
          title,
          sku,
          quantity: sale.bundle_size || 1,
          price: totalAmount,
          thumbnail: thumbnail || ''
        });
      }

      const orderPayload = {
        user: userId,
        orderId: String(orderId),
        sellerId: String(userIdentifier),
        buyerUsername,
        totalAmount,
        currency,
        status,
        paymentStatus: 'PAID',
        createdDate: new Date(createdDate),
        paidDate: new Date(createdDate),
        lineItems,
        platform: 'poshmark',
        orderUrl: `https://${domain}/order/sales`,
        updated_at: new Date()
      };

      const existingOrder = await Order.findOne({ user: userId, orderId: String(orderId) });
      const isNewOrder = !existingOrder;

      await Order.findOneAndUpdate(
        { user: userId, orderId: String(orderId) },
        orderPayload,
        { upsert: true, returnDocument: 'after' }
      );

      // Trigger Cross-Platform Auto-Delist only for freshly detected sales
      if (isNewOrder) {
        try {
          const { handleItemSold } = require('./autoDelistService');
          for (const item of lineItems) {
            handleItemSold({
              userId,
              soldPlatform: 'poshmark',
              sku: item.sku,
              listingId: item.lineItemId,
              title: item.title,
              orderId: String(orderId)
            }).catch(e => console.error('[Poshmark Order Sync] Auto-delist hook error:', e.message));
          }
        } catch (hookErr) {
          console.warn('[Poshmark Order Sync] Failed to dispatch auto-delist hook:', hookErr.message);
        }
      }

      syncedCount++;
    } catch (orderErr) {
      console.warn(`[Poshmark Order Sync] Error processing order:`, orderErr.message);
    }
  }

  console.log(`[Poshmark Order Sync] Finished. Synced ${syncedCount} orders.`);
  return { success: true, count: syncedCount };
}

module.exports = {
  syncPoshmarkOrders,
  normalizePoshmarkOrderStatus,
  getUserIdFromSessionCookie
};
