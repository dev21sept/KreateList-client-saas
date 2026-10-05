/**
 * Cross-platform merge suggestions. Works out which records (eBay, Poshmark, Mercari, ...) are the same physical item.
 *
 * Three steps, in order:
 *   1. Stored link: a record that already holds IDs for more than one platform is linked. Nothing to suggest.
 *   2. Details: same brand, same size, and title words that overlap strongly, with a price in a sensible range.
 *   3. Photo: the first photo's visual hash (dHash) is close. Photos keep their content across platforms even
 *      though each platform serves them from a different URL, so URL matching cannot be used.
 *
 * Suggestions only. Nothing is merged or written here.
 */

const STOP = new Set(['the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'size', 'sz', 'mens', 'men', 'womens', 'women', 'nwt', 'new', 'used', 'no', 'tags', 'read']);
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;

/** Size words and measurements: 3xl, xl, 2xl, 35x34, 32, 6.5y, etc. */
function isSizeToken(t) {
  return /^\d+(x\d+)?(xs|xl|xxl|s|m|l)?y?$/.test(t) || /^(xxs|xs|xl|xxl|xxxl|s|m|l)$/.test(t) || /^\d+x+[sml]$/.test(t);
}

/** Normalizes a size field: "M", " m ", "35x34" -> lowercase, trimmed. Empty -> ''. */
function normalizeSize(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Size written in a title: a waist x inseam pair (35x34) or a letter/number size (XL, M, 6.5).
 * Returns '' when the title has no clear size.
 */
function sizeFromTitle(title) {
  const t = String(title || '').toLowerCase().replace(INVISIBLE, '');
  const pair = t.match(/\b(\d{2})\s*x\s*(\d{2})\b/);
  if (pair) return `${pair[1]}x${pair[2]}`;
  const word = t.match(/\bsize\s+(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2}(?:\.\d)?)\b/)
    || t.match(/\b(xxs|xs|xxl|xxxl|xl|s|m|l)\b/);
  return word ? word[1].trim() : '';
}

/** Lowercased word set of a title, without sizes, punctuation and filler words. */
function titleTokens(title) {
  return new Set(
    String(title || '')
      .replace(INVISIBLE, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOP.has(t) && !isSizeToken(t))
  );
}

/** Share of the smaller title's words found in the other title (0 to 1). */
function titleOverlap(a, b) {
  const ta = titleTokens(a), tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

/** Price is "sensible" when the two prices are within 40% of each other. */
function priceClose(a, b) {
  const pa = parseFloat(a), pb = parseFloat(b);
  if (!pa || !pb) return true; // unknown price does not block a match
  return Math.abs(pa - pb) / Math.max(pa, pb) <= 0.4;
}

/**
 * dHash: 9x8 grayscale pixels (72 values) -> 64-bit hash as a string of bits.
 * Compare two hashes with hammingDistance. Distance <= 10 is a strong visual match.
 */
function dHashFromPixels(pixels) {
  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      bits += left < right ? '1' : '0';
    }
  }
  return bits;
}

function hammingDistance(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return Infinity;
  let d = 0;
  for (let i = 0; i < h1.length; i++) if (h1[i] !== h2[i]) d++;
  return d;
}

/** Compares two records. Returns null if they cannot be the same item, else a score and the reasons. */
function scorePair(a, b) {
  // A merged master holds one ID per platform, so the two records must not share any platform.
  const platformsA = new Set((a.platforms || [a.platform]).filter(Boolean));
  const platformsB = (b.platforms || [b.platform]).filter(Boolean);
  if (platformsB.some(p => platformsA.has(p))) return null;
  if (a.brand && b.brand && String(a.brand).trim().toLowerCase() !== String(b.brand).trim().toLowerCase()) return null;
  // Size: use the size field, or the size written in the title when the field is empty. Two different sizes never match.
  const sizeA = normalizeSize(a.size) || sizeFromTitle(a.title);
  const sizeB = normalizeSize(b.size) || sizeFromTitle(b.title);
  if (sizeA && sizeB && sizeA !== sizeB) return null;
  if (!priceClose(a.price, b.price)) return null;

  const reasons = [];
  let score = 0;
  const overlap = titleOverlap(a.title, b.title);
  if (overlap >= 0.6) { score += 40; reasons.push(`title ${Math.round(overlap * 100)}%`); }
  if (a.brand && b.brand) { score += 15; reasons.push('brand'); }
  if (sizeA && sizeB) { score += 15; reasons.push('size'); }

  // Tight threshold: photos of similar garments (jeans, pants) look alike at looser distances.
  const dist = hammingDistance(a.imageHash, b.imageHash);
  if (dist <= 5) { score += 30; reasons.push(`photo distance ${dist}`); }

  // Photo alone is not enough, and title + brand alone is not enough: a pair needs the same size AND a close photo.
  if (score < 50) return null;
  if (!(sizeA && sizeB) || dist > 5) return null;
  return { score, reasons };
}

/**
 * Finds suggested pairs among records. Each record: { id, platform, title, brand, size, price, imageHash }.
 * Records already linked (more than one platform ID) are skipped.
 */
function suggestPairs(records) {
  const out = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i], b = records[j];
      const s = scorePair(a, b);
      if (s) out.push({ a: a.id, b: b.id, platforms: [a.platform, b.platform], ...s });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

module.exports = { titleTokens, titleOverlap, priceClose, dHashFromPixels, hammingDistance, scorePair, suggestPairs, sizeFromTitle };
