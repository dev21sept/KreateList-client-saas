/**
 * Listing Status Tracker
 *
 * Periodically checks whether listings marked "published" are still live on the
 * marketplace, and corrects local status when they have ended (e.g. delisted or sold
 * outside eLister). Runs in small batches with a pause between marketplace calls so it
 * does not slow the API.
 *
 * Safety: writes happen only when TRACKER_APPLY=true. Otherwise the cycle only logs
 * what it would change (dry run).
 */

const Listing = require('../models/Listing');
const User = require('../models/User');
const ebayService = require('./ebayService');
const { getValidToken } = require('../controllers/ebayController');
const { getPoshmarkHeaders, getAxiosConfig, getDomainFromCookie } = require('./backendPublishService');
const axios = require('axios');

const BATCH_SIZE = Number(process.env.TRACKER_BATCH_SIZE || 25);
const DELAY_MS = Number(process.env.TRACKER_DELAY_MS || 2000);

const PLATFORMS = {
  ebay: { idField: 'ebayListingId', statusField: 'ebayStatus' },
  poshmark: { idField: 'poshmarkListingId', statusField: 'poshmarkStatus' }
};

let running = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isApplyMode = () => String(process.env.TRACKER_APPLY || '').toLowerCase() === 'true';

// Maps a marketplace response to 'active' | 'ended' | 'unknown'. 'unknown' never changes local data.
async function checkEbay(listing, userCache) {
  const userId = String(listing.user);
  if (!userCache.has(userId)) {
    const token = await getValidToken(userId);
    userCache.set(userId, token || null);
  }
  const token = userCache.get(userId);
  if (!token) return 'unknown';

  const details = await ebayService.getTradingItemDetails(token, listing.ebayListingId);
  if (!details || !details.listingStatus) return 'unknown';
  if (/^active$/i.test(details.listingStatus)) return 'active';
  if (/completed|ended|inactive|sold/i.test(details.listingStatus)) return 'ended';
  return 'unknown';
}

async function checkPoshmark(listing, userCache) {
  const userId = String(listing.user);
  if (!userCache.has(userId)) {
    const user = await User.findById(userId).select('poshmarkAccount').lean();
    userCache.set(userId, user?.poshmarkAccount || null);
  }
  const account = userCache.get(userId);
  if (!account?.sessionCookie) return 'unknown';

  const domain = getDomainFromCookie(account.sessionCookie);
  const headers = getPoshmarkHeaders(account.sessionCookie, account.csrfToken);
  delete headers['origin'];
  delete headers['content-type'];

  try {
    const res = await axios(getAxiosConfig({
      method: 'GET',
      url: `https://${domain}/vm-rest/posts/${listing.poshmarkListingId}?pm_version=2026.26.01`,
      headers
    }));
    const post = res.data?.post || res.data || {};
    if (res.data?.error) return 'unknown';
    if (/not_for_sale|sold|deleted/i.test(String(post.status || ''))) return 'ended';
    return 'active';
  } catch (err) {
    // Poshmark returns 404 for listings that no longer exist.
    if (err.response?.status === 404) return 'ended';
    return 'unknown';
  }
}

const CHECKERS = { ebay: checkEbay, poshmark: checkPoshmark };

/**
 * Runs one tracking cycle over the least recently checked published listings.
 */
async function runStatusTrackerCycle({ batchSize = BATCH_SIZE, delayMs = DELAY_MS } = {}) {
  if (running) return { skipped: true, reason: 'previous cycle still running' };
  running = true;

  const apply = isApplyMode();
  const summary = { mode: apply ? 'apply' : 'dry-run', listings: 0, checks: 0, active: 0, ended: 0, unknown: 0, changed: 0 };

  try {
    const or = Object.entries(PLATFORMS).map(([, p]) => ({
      [p.statusField]: 'published',
      [p.idField]: { $nin: [null, ''] }
    }));

    const listings = await Listing.find({ $or: or })
      .sort({ statusCheckedAt: 1 })
      .limit(batchSize)
      .select('user statusCheckedAt ebayStatus ebayListingId poshmarkStatus poshmarkListingId')
      .lean();

    summary.listings = listings.length;
    const userCache = new Map();

    for (const listing of listings) {
      const changes = {};
      for (const [platform, cfg] of Object.entries(PLATFORMS)) {
        if (listing[cfg.statusField] !== 'published' || !listing[cfg.idField]) continue;

        let state = 'unknown';
        try {
          state = await CHECKERS[platform](listing, userCache);
        } catch (err) {
          console.warn(`[StatusTracker] ${platform} check failed for ${listing._id}: ${err.message}`);
        }
        summary.checks++;
        summary[state]++;

        if (state === 'ended') {
          changes[cfg.statusField] = 'delisted';
          summary.changed++;
          console.log(`[StatusTracker] ${platform} ${listing[cfg.idField]} is no longer live -> ${apply ? 'delisted' : 'would mark delisted (dry run)'}`);
        }

        await sleep(delayMs);
      }

      if (apply) {
        await Listing.updateOne(
          { _id: listing._id },
          { $set: { ...changes, statusCheckedAt: new Date() } }
        );
      }
    }

    return summary;
  } finally {
    running = false;
  }
}

module.exports = { runStatusTrackerCycle, isApplyMode };
