/**
 * Live status check by platform listing ID.
 *
 * For one Elister user, asks each connected marketplace which of the user's listing IDs are really live,
 * and compares that with what the app stores in two places:
 *   - Master (Listing collection): the records shown in Master Cross-Listing and used by Smart Merge
 *   - Channel inventory (Product collection): the records shown in All Platform Inventory
 *
 * Read-only: nothing is written.
 */

const Listing = require('../models/Listing');
const Product = require('../models/Product');
const User = require('../models/User');
const ebayService = require('./ebayService');
const { readEbayLists, stateForEbayId } = require('./ebayStateSync');
const { scrapePoshmarkCloset } = require('./externalImportService');

const hasId = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined' && String(v) !== 'null';

function tally(items, keyFn) {
  return items.reduce((m, x) => { const k = keyFn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
}

async function checkEbay(userId) {
  const user = await User.findById(userId).select('ebayAccount').lean();
  if (!user?.ebayAccount?.connected) return { connected: false };
  const token = await ebayService.getValidEbayToken(String(userId));
  const lists = await readEbayLists(token);
  if (!lists) return { connected: true, error: 'eBay lists could not be read. Nothing compared.' };

  const masters = await Listing.find({ user: userId, ebayListingId: { $exists: true } }).select('ebayListingId status ebayStatus').lean();
  const masterWithId = masters.filter(m => hasId(m.ebayListingId));
  const products = await Product.find({ user: userId, source: 'ebay', ebayListingId: { $exists: true } }).select('ebayListingId status ebayState').lean();
  const productWithId = products.filter(p => hasId(p.ebayListingId));

  const isPublishedInMaster = (m) => m.status === 'published' || m.ebayStatus === 'published';
  return {
    connected: true,
    live: { active: lists.active.size, sold: lists.sold.size, ended: lists.unsold.size },
    master: {
      records_with_ebay_id: masterWithId.length,
      says_published: masterWithId.filter(isPublishedInMaster).length,
      live_state_of_ids: tally(masterWithId, m => stateForEbayId(String(m.ebayListingId).trim(), lists)),
      published_but_not_live_active: masterWithId.filter(m => isPublishedInMaster(m) && stateForEbayId(String(m.ebayListingId).trim(), lists) !== 'active').length,
      live_active_but_not_published: masterWithId.filter(m => !isPublishedInMaster(m) && stateForEbayId(String(m.ebayListingId).trim(), lists) === 'active').length,
    },
    channel: {
      records_with_ebay_id: productWithId.length,
      app_state_counts: tally(productWithId, p => p.ebayState || '(none)'),
      live_state_of_ids: tally(productWithId, p => stateForEbayId(String(p.ebayListingId).trim(), lists)),
    },
  };
}

async function checkPoshmark(userId) {
  const user = await User.findById(userId).select('poshmarkAccount').lean();
  if (!user?.poshmarkAccount?.connected || !user.poshmarkAccount.username) return { connected: false };
  const scraped = await scrapePoshmarkCloset(user.poshmarkAccount.username, user.poshmarkAccount);
  if (!Array.isArray(scraped) || scraped.length === 0) return { connected: true, error: 'Poshmark closet could not be read. Nothing compared.' };
  const liveById = new Map(scraped.map(s => [String(s.poshmarkListingId), s.poshmarkState || 'unknown']));

  const masters = await Listing.find({ user: userId, poshmarkListingId: { $exists: true } }).select('poshmarkListingId status poshmarkStatus').lean();
  const masterWithId = masters.filter(m => hasId(m.poshmarkListingId));
  const products = await Product.find({ user: userId, source: 'poshmark', poshmarkListingId: { $exists: true } }).select('poshmarkListingId status poshmarkState').lean();
  const productWithId = products.filter(p => hasId(p.poshmarkListingId));

  const stateOf = (id) => liveById.get(String(id).trim()) || 'not_in_closet';
  const isPublishedInMaster = (m) => m.status === 'published' || m.poshmarkStatus === 'published';
  return {
    connected: true,
    live: tally(scraped, s => s.poshmarkState || 'unknown'),
    master: {
      records_with_poshmark_id: masterWithId.length,
      says_published: masterWithId.filter(isPublishedInMaster).length,
      live_state_of_ids: tally(masterWithId, m => stateOf(m.poshmarkListingId)),
      published_but_not_live_active: masterWithId.filter(m => isPublishedInMaster(m) && stateOf(m.poshmarkListingId) !== 'active').length,
    },
    channel: {
      records_with_poshmark_id: productWithId.length,
      app_state_counts: tally(productWithId, p => p.poshmarkState || '(none)'),
      live_state_of_ids: tally(productWithId, p => stateOf(p.poshmarkListingId)),
    },
  };
}

/** Returns live counts and app comparison for eBay and Poshmark for one user. */
async function checkLiveStatus(userId) {
  const [ebay, poshmark] = await Promise.all([
    checkEbay(userId).catch(e => ({ connected: true, error: e.message })),
    checkPoshmark(userId).catch(e => ({ connected: true, error: e.message })),
  ]);
  return { checkedAt: new Date().toISOString(), ebay, poshmark };
}

module.exports = { checkLiveStatus, checkEbay, checkPoshmark };
