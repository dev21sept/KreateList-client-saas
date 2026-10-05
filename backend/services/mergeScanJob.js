/**
 * Background merge scan. Suggests cross-platform pairs for one user's ACTIVE records.
 *
 * - Only records whose listing ID is live on at least one platform are scanned (per-platform status is set from
 *   the live ID check in masterStatusSync). Ended items are never suggested.
 * - Works in the background: the start request returns at once; results are read with a second request.
 * - Concurrency is capped (2 image downloads at a time) so the small server is not overloaded.
 * - Each record's photo hash is cached on the Listing (imageHash), so a photo is downloaded once.
 * - Suggestions only. Nothing is merged here.
 */

const axios = require('axios');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { dHashFromPixels, suggestPairs } = require('./mergeMatcher');

const CONCURRENCY = 2;
const MAX_BYTES = 5 * 1024 * 1024;
const jobs = new Map(); // userId -> { status, startedAt, finishedAt, processed, total, suggestions, error }

const hasId = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined' && String(v) !== 'null';

async function computeImageHash(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, maxContentLength: MAX_BYTES });
  const { data } = await sharp(Buffer.from(res.data))
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dHashFromPixels(Array.from(data));
}

/** Runs tasks with at most `limit` in flight. */
async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

/** Platforms on which this record's listing ID is live right now. */
function livePlatforms(l) {
  const out = [];
  if (hasId(l.ebayListingId) && l.ebayStatus === 'published') out.push('ebay');
  if (hasId(l.poshmarkListingId) && l.poshmarkStatus === 'published') out.push('poshmark');
  if (hasId(l.etsyListingId) && l.etsyStatus === 'published') out.push('etsy');
  // Mercari status is the stored one: its live closet read is not verified yet (see masterStatusSync).
  if (hasId(l.mercariListingId) && l.mercariStatus === 'published') out.push('mercari');
  return out;
}

async function runScan(userId) {
  const job = jobs.get(String(userId));
  try {
    const listings = await Listing.find({ user: userId })
      .select('title brand size price platform ebayListingId ebayStatus poshmarkListingId poshmarkStatus etsyListingId etsyStatus mercariListingId mercariStatus images thumbnail imageHash')
      .lean();

    // Active only: at least one platform has this item live right now, and a photo to compare.
    const usable = listings.filter(l => livePlatforms(l).length > 0 && ((l.images && l.images.length) || l.thumbnail));
    job.total = usable.length;

    const records = [];
    await mapLimit(usable, CONCURRENCY, async (l) => {
      let imageHash = l.imageHash || null;
      if (!imageHash) {
        const first = (l.images && l.images[0]) || l.thumbnail;
        const url = typeof first === 'string' ? first : first?.url;
        try {
          if (url) {
            imageHash = await computeImageHash(url);
            await Listing.updateOne({ _id: l._id }, { $set: { imageHash } });
          }
        } catch (e) {
          imageHash = null; // a failed photo only weakens that record's score
        }
      }
      records.push({ id: String(l._id), platform: livePlatforms(l)[0], platforms: livePlatforms(l), title: l.title, brand: l.brand, size: l.size, price: l.price, imageHash });
      job.processed++;
    });

    job.suggestions = suggestPairs(records).slice(0, 500);
    job.status = 'done';
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
  }
}

/** Starts a scan in the background. Returns immediately. A second start while one runs is ignored. */
function startMergeScan(userId) {
  const key = String(userId);
  const existing = jobs.get(key);
  if (existing && existing.status === 'running') return existing;
  const job = { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, processed: 0, total: 0, suggestions: [], error: null };
  jobs.set(key, job);
  setImmediate(() => { runScan(userId); });
  return job;
}

function getMergeScan(userId) {
  return jobs.get(String(userId)) || { status: 'idle' };
}

module.exports = { startMergeScan, getMergeScan, computeImageHash, livePlatforms };
