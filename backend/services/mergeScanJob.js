/**
 * Background merge scan. Runs the photo hash step for one user's records without blocking requests.
 *
 * - Works in the background: the start request returns at once; results are read with a second request.
 * - Concurrency is capped (2 image downloads at a time) so the small server is not overloaded.
 * - Each record's photo hash is cached on the Listing (imageHash), so a photo is downloaded once.
 * - Results are suggestions only. Nothing is merged here.
 */

const axios = require('axios');
const sharp = require('sharp');
const Listing = require('../models/Listing');
const { dHashFromPixels, suggestPairs } = require('./mergeMatcher');

const CONCURRENCY = 2;
const MAX_BYTES = 5 * 1024 * 1024;
const jobs = new Map(); // userId -> { status, startedAt, finishedAt, processed, total, suggestions, error }

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

async function runScan(userId) {
  const job = jobs.get(String(userId));
  try {
    const listings = await Listing.find({ user: userId })
      .select('title brand size price platform ebayListingId poshmarkListingId mercariListingId images thumbnail imageHash')
      .lean();

    // Only records with a photo and at least one platform (or a draft to match) are useful.
    const usable = listings.filter(l => (l.images && l.images.length) || l.thumbnail);
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
      const platform = l.ebayListingId ? 'ebay' : l.poshmarkListingId ? 'poshmark' : l.mercariListingId ? 'mercari' : (l.platform || 'draft');
      records.push({ id: String(l._id), platform, title: l.title, brand: l.brand, size: l.size, price: l.price, imageHash });
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

module.exports = { startMergeScan, getMergeScan, computeImageHash };
