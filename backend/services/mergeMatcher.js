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

const SIZE_WORD = '(\\d{1,3}(?:\\.\\d)?|\\d{1,2}xl|xxs|xs|s|m|l|xl|xxl|xxxl)';

/**
 * Size written in a title: a waist x inseam pair (35x34), a size word right after the gender/age
 * word (resale titles read "... Mens 31 ..." or "... Womens 20 Long ..."), an explicit "size X",
 * or a standalone size token. Returns '' when the title has no clear size.
 */
function sizeFromTitle(title) {
  const t = String(title || '').toLowerCase().replace(INVISIBLE, '');
  const pair = t.match(/\b(\d{2})\s*x\s*(\d{2})\b/);
  if (pair) return `${pair[1]}x${pair[2]}`;
  const genderAnchored = t.match(new RegExp(`\\b(?:mens?|men'?s|womens?|women'?s|unisex|boys?|girls?|kids?|youth)\\s+${SIZE_WORD}\\b`));
  if (genderAnchored) return genderAnchored[1];
  const word = t.match(new RegExp(`\\bsize\\s+${SIZE_WORD}\\b`))
    // (?<!') excludes the "s" in a possessive like "Men's": that is a contraction, not a Small.
    // (?<!-) excludes a style/SKU code's trailing letter, e.g. the "L" in "11080111-L".
    || t.match(/(?<!')(?<!-)\b(xxs|xs|xxl|xxxl|xl|s|m|l)\b/);
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
 * dHash, both directions: 9x9 grayscale pixels (81 values) -> 144-bit hash as a string of bits
 * (72 horizontal-gradient bits, then 72 vertical-gradient bits). A single-direction 64-bit dHash
 * does not separate "same item, different platform" photos from "different item, similar photo"
 * well enough at the distances cross-platform compression differences produce; the extra bits do.
 */
function dHashFromPixels(pixels) {
  let bits = '';
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      bits += left < right ? '1' : '0';
    }
  }
  for (let col = 0; col < 9; col++) {
    for (let row = 0; row < 8; row++) {
      const top = pixels[row * 9 + col];
      const bottom = pixels[(row + 1) * 9 + col];
      bits += top < bottom ? '1' : '0';
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

const SIZE_PAIR = /^(\d{2})x(\d{2})$/;
const NUM_WITH_LETTER_SUFFIX = /^(\d{1,3})[a-z]$/;

/**
 * Whether two normalized sizes can be the same size. Equal strings always match. A bare waist
 * number also matches a "waist x inseam" pair on the same waist: some platforms' size field only
 * holds the waist (the inseam lives in the title), which is not a different size, just a shorter one.
 * A number with one trailing letter (20W, 32P, 7J, ...) also matches the bare number: that letter is
 * a sizing-convention suffix (women's, petite, junior, ...), not a different size.
 */
function sizesCompatible(sizeA, sizeB) {
  if (!sizeA || !sizeB) return false;
  if (sizeA === sizeB) return true;
  const pairA = sizeA.match(SIZE_PAIR), pairB = sizeB.match(SIZE_PAIR);
  if (pairA && !pairB && pairA[1] === sizeB) return true;
  if (pairB && !pairA && pairB[1] === sizeA) return true;
  const suffixedA = sizeA.match(NUM_WITH_LETTER_SUFFIX);
  const suffixedB = sizeB.match(NUM_WITH_LETTER_SUFFIX);
  if (suffixedA || suffixedB) {
    const coreA = suffixedA ? suffixedA[1] : sizeA;
    const coreB = suffixedB ? suffixedB[1] : sizeB;
    if (coreA === coreB) return true;
  }
  return false;
}

// Measured on real cross-platform photo pairs (144-bit hash): same-item distance median ~31,
// different-item median ~59 with p10 ~28. This sits just past the same-item median, trading some
// recall for keeping photo a real signal; title + brand + size still have to agree too.
const PHOTO_DIST_THRESHOLD = 32;

// A near-exact title (not just "shares most words") plus a confirmed, matching size is strong
// enough corroboration on its own to trust a farther photo: compression/crop differences between
// platforms can push even the same photo past the normal threshold. Still not unlimited - two
// identical, templated titles from a bulk listing (e.g. several of the same generic item re-sold)
// could otherwise coincide, so this stays well short of a typical different-item distance (p10 ~28,
// median ~59 above).
const PHOTO_DIST_THRESHOLD_HIGH_CONFIDENCE = 50;
const EXACT_TITLE_OVERLAP = 0.9;

/** Compares two records. Returns null if they cannot be the same item, else a score and the reasons. */
function scorePair(a, b) {
  // A merged master holds one ID per platform, so the two records must not share any platform.
  const platformsA = new Set((a.platforms || [a.platform]).filter(Boolean));
  const platformsB = (b.platforms || [b.platform]).filter(Boolean);
  if (platformsB.some(p => platformsA.has(p))) return null;
  if (a.brand && b.brand && String(a.brand).trim().toLowerCase() !== String(b.brand).trim().toLowerCase()) return null;
  // Size: use the size field, or the size written in the title when the field is empty. Incompatible sizes never match.
  const sizeA = normalizeSize(a.size) || sizeFromTitle(a.title);
  const sizeB = normalizeSize(b.size) || sizeFromTitle(b.title);
  if (sizeA && sizeB && !sizesCompatible(sizeA, sizeB)) return null;
  if (!priceClose(a.price, b.price)) return null;

  const reasons = [];
  let score = 0;
  const overlap = titleOverlap(a.title, b.title);
  if (overlap >= 0.6) { score += 40; reasons.push(`title ${Math.round(overlap * 100)}%`); }
  if (a.brand && b.brand) { score += 15; reasons.push('brand'); }
  if (sizeA && sizeB) { score += 15; reasons.push('size'); }

  const sizeConfirmed = Boolean(sizeA && sizeB); // both present and (per the check above) compatible
  const threshold = (overlap >= EXACT_TITLE_OVERLAP && sizeConfirmed)
    ? PHOTO_DIST_THRESHOLD_HIGH_CONFIDENCE
    : PHOTO_DIST_THRESHOLD;

  const dist = hammingDistance(a.imageHash, b.imageHash);
  if (dist <= threshold) { score += 30; reasons.push(`photo distance ${dist}`); }

  // A close photo is always required. A confirmed size clash was already rejected above; a size
  // missing on one side is not held against the pair, since the other evidence (title, brand, photo)
  // still has to clear the score bar on its own.
  if (score < 50) return null;
  if (dist > threshold) return null;
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

module.exports = { titleTokens, titleOverlap, priceClose, dHashFromPixels, hammingDistance, scorePair, suggestPairs, sizeFromTitle, sizesCompatible };
