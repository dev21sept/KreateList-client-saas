/**
 * Keeps Master (Listing) statuses in line with each marketplace's live state, matched by listing ID.
 *
 * Per platform, every Master record that has that platform's ID gets one of:
 *   published  - live and for sale
 *   sold       - sold out on that platform
 *   delisted   - ended, hidden from sale, or not found on the platform any more
 * Then the record's overall status follows: published if any platform is published, else sold, else delisted.
 *
 * Records whose platform could not be read are left alone. Mercari is skipped until its live read works.
 * Only changed fields are written.
 */

const Listing = require('../models/Listing');
const User = require('../models/User');
const ebayService = require('./ebayService');
const { readEbayLists, stateForEbayId } = require('./ebayStateSync');
const { scrapePoshmarkCloset } = require('./externalImportService');
const etsyService = require('./etsyService');

const hasId = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined' && String(v) !== 'null';

/** eBay: id -> published | sold | delisted. Null if eBay could not be read. */
async function liveEbay(userId) {
  const token = await ebayService.getValidEbayToken(String(userId));
  const lists = await readEbayLists(token);
  if (!lists) return null;
  return {
    id: (raw) => ({ active: 'published', sold: 'sold', ended: 'delisted', removed: 'delisted' })[stateForEbayId(String(raw).trim(), lists)],
    size: lists.active.size + lists.sold.size + lists.unsold.size,
  };
}

/** Poshmark: id -> published | sold | delisted. Null if the closet could not be read. */
async function livePoshmark(user) {
  const acc = user.poshmarkAccount;
  const scraped = await scrapePoshmarkCloset(acc.username, acc);
  if (!Array.isArray(scraped) || scraped.length === 0) return null;
  const map = new Map(scraped.map(s => [String(s.poshmarkListingId), s.poshmarkState]));
  const toStatus = { active: 'published', sold: 'sold', not_for_sale: 'delisted', hidden: 'published', removed: 'delisted' };
  return {
    id: (raw) => toStatus[map.get(String(raw).trim())] || 'delisted', // not in closet -> delisted
    size: scraped.length,
  };
}

/** Etsy: id -> published | sold | delisted. Null if the shop could not be read. */
async function liveEtsy(user) {
  const shopId = user.etsyAccount?.shopId;
  if (!shopId) return null;
  const items = await etsyService.getEtsyInventory(String(user._id), shopId);
  if (!Array.isArray(items) || items.length === 0) return null;
  const map = new Map(items.map(i => [String(i.listing_id), i.state || i.elisterStatus]));
  const toStatus = { active: 'published', sold_out: 'sold', inactive: 'delisted', expired: 'delisted' };
  return {
    id: (raw) => toStatus[map.get(String(raw).trim())] || 'delisted',
    size: items.length,
  };
}

/** Computes the overall Listing.status from the three platform statuses. Returns null to keep the current value. */
function overallStatus(parts) {
  const vals = parts.filter(Boolean);
  if (vals.includes('published')) return 'published';
  if (vals.includes('sold')) return 'sold';
  if (vals.includes('delisted')) return 'delisted';
  return null;
}

/**
 * Syncs one user's Master records. Returns counts, or null for platforms that could not be read.
 * `apply: false` computes everything but writes nothing.
 */
async function syncMasterStatuses(userId, { apply = true, maxChangeShare = 0.4 } = {}) {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const lives = {
    ebay: user.ebayAccount?.connected ? await liveEbay(userId).catch(() => null) : null,
    poshmark: user.poshmarkAccount?.connected && user.poshmarkAccount.username ? await livePoshmark(user).catch(() => null) : null,
    etsy: user.etsyAccount?.connected ? await liveEtsy(user).catch(() => null) : null,
  };

  const listings = await Listing.find({ user: userId }).select('status ebayListingId ebayStatus poshmarkListingId poshmarkStatus etsyListingId etsyStatus').lean();
  const ops = [];
  const counts = { checked: 0, changed: 0 };
  for (const l of listings) {
    const next = {};
    const parts = [];
    const platforms = [
      { live: lives.ebay, id: l.ebayListingId, field: 'ebayStatus', current: l.ebayStatus },
      { live: lives.poshmark, id: l.poshmarkListingId, field: 'poshmarkStatus', current: l.poshmarkStatus },
      { live: lives.etsy, id: l.etsyListingId, field: 'etsyStatus', current: l.etsyStatus },
    ];
    for (const p of platforms) {
      if (!p.live) continue; // platform not read this run: leave it alone
      if (hasId(p.id)) {
        next[p.field] = p.live.id(p.id);
        parts.push(next[p.field]);
      } else if (p.current === 'published') {
        // Marked published but has no listing ID on that platform: it is not live there.
        next[p.field] = 'none';
      }
    }
    if (parts.length === 0 && Object.keys(next).length === 0) continue; // nothing checked for this record

    counts.checked++;
    const overall = overallStatus(parts);
    if (overall) next.status = overall;

    const diff = {};
    for (const [k, v] of Object.entries(next)) if (l[k] !== v) diff[k] = v;
    if (Object.keys(diff).length) {
      counts.changed++;
      ops.push({ updateOne: { filter: { _id: l._id }, update: { $set: diff } } });
    }
  }

  // Safety: if a large share of statuses would flip in one run, the marketplace response is suspect. Write nothing.
  const changeShare = counts.checked ? counts.changed / counts.checked : 0;
  const guarded = counts.checked >= 20 && changeShare > maxChangeShare;
  if (apply && ops.length && !guarded) {
    for (let i = 0; i < ops.length; i += 1000) await Listing.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  }
  return {
    platforms_checked: Object.fromEntries(Object.entries(lives).map(([k, v]) => [k, v ? v.size : 'not read / not connected'])),
    ...counts,
    skippedUnsafe: guarded,
  };
}

module.exports = { syncMasterStatuses, overallStatus };
