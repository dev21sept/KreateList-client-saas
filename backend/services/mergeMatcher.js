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
// Straight (') and the "smart quote" curly apostrophe (U+2019) a phone keyboard or pasted text
// commonly substitutes - "Men's" and "Men’s" both need to read as a possessive, not two different
// strings where only one is recognized.
const APOS = `['’]`;

/** Size words and measurements: 3xl, xl, 2xl, 35x34, 32, 6.5y, etc. */
function isSizeToken(t) {
  return /^\d+(x\d+)?(xs|xl|xxl|s|m|l)?y?$/.test(t) || /^(xxs|xs|xl|xxl|xxxl|s|m|l)$/.test(t) || /^\d+x+[sml]$/.test(t);
}

/**
 * Whether a normalized string is plausibly a size at all, as opposed to free text a seller typed
 * into the size field instead ("Can't read tag, check measurements", "Unknown"). Real size values
 * are short: a few digits, a decimal, one or two trailing letters.
 */
function looksLikeSize(s) {
  return s.length > 0 && s.length <= 8 && /^[0-9.]{0,3}[a-z0-9]{0,5}$/.test(s);
}

/**
 * Normalizes a size field: "M", " m ", "35x34" -> lowercase, trimmed. Empty, or text that is not
 * plausibly a size at all ("Can't read tag, check measurements"), -> ''.
 */
function normalizeSize(s) {
  const t = String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  return looksLikeSize(t) ? t : '';
}

// Spelled-out sizes ("Small", "X Large", "XX-Small") alongside the usual abbreviations. Longer
// phrases are listed before the shorter words they contain (e.g. "x small" before "small") so a
// title that says "XX Small" is not read as a plain Small - see sizeFromTitle's note on match order.
// The numeric alternative allows one optional trailing letter (8.5B, 9.5M, 10D: shoe-width codes)
// so the whole thing is captured together - without it, the \b requirement at the end of this
// group forces the engine to drop the decimal to find a boundary before the letter instead.
const SIZE_WORD = '(\\d{1,3}(?:\\.\\d)?[a-z]?|\\d{1,2}xl|xx[\\s-]?small|x[\\s-]?small|small|xx[\\s-]?large|x[\\s-]?large|large|medium|xxs|xs|sm|md|lg|s|m|l|xl|xxl|xxxl)';

const SPELLED_SIZE = {
  'xxsmall': 'xxs', 'xx small': 'xxs', 'xx-small': 'xxs',
  'xsmall': 'xs', 'x small': 'xs', 'x-small': 'xs',
  small: 's', medium: 'm', large: 'l',
  'xlarge': 'xl', 'x large': 'xl', 'x-large': 'xl',
  'xxlarge': 'xxl', 'xx large': 'xxl', 'xx-large': 'xxl',
  sm: 's', md: 'm', lg: 'l',
};

/** A spelled-out size word ("Small", "X-Large") -> its abbreviation ("s", "xl"). Anything else unchanged. */
function normalizeSizeWord(w) {
  return SPELLED_SIZE[w] || w;
}

/**
 * Size written in a title: a size word right after the gender/age word (resale titles read "...
 * Mens 31 ..." or "... Womens 20 Long ..." or "... Women's X Small ..."), a waist x inseam pair
 * (35x34), an explicit "size X", or a standalone size token. Returns '' when the title has no
 * clear size.
 *
 * The gender-anchored size is checked first and the bare pair regex second, not the other way
 * round, because a title sometimes adds a parenthetical measurement after the real size -
 * "Mens 32 ... (31x29)" (tag says 32, actual measurement 31x29) - and a plain left-to-right pair
 * search would grab that parenthetical instead of the stated size "32" that the platform's own
 * size field agrees with. The gender-anchored pattern itself can never match a pair (the trailing
 * \b it needs can't be satisfied once "x" is followed by more digits), so checking it first never
 * steals a legitimate "Mens 35x32"-style match from the pair regex below it.
 */
function sizeFromTitle(title) {
  // "15 1/2" (a mixed-fraction collar size) -> "15.5", before anything else looks at the digits.
  const t = String(title || '').toLowerCase().replace(INVISIBLE, '').replace(/(\d{1,2})\s+1\/2\b/g, '$1.5');
  const GENDER_WORD = `(?:mens?|men${APOS}?s|womens?|women${APOS}?s|unisex|boys?|girls?|kids?|youth)`;
  // Tried before the bare word below: "Mens 15.5-33" is a pair (collar x sleeve), not a bare "15.5"
  // followed by an unrelated "-33" - the bare SIZE_WORD match alone would stop right after "15.5",
  // since the following "-" already satisfies its trailing \b.
  const genderAnchoredPair = t.match(new RegExp(`\\b${GENDER_WORD}\\s+(\\d{1,2}(?:\\.\\d)?)\\s*([x/-])\\s*(\\d{2})\\b`));
  if (genderAnchoredPair) return `${genderAnchoredPair[1]}${genderAnchoredPair[2] === '-' ? 'x' : genderAnchoredPair[2]}${genderAnchoredPair[3]}`;
  const genderAnchored = t.match(new RegExp(`\\b${GENDER_WORD}\\s+${SIZE_WORD}\\b`));
  if (genderAnchored) return normalizeSizeWord(genderAnchored[1]);
  // Waist x inseam ("35x32") or a dress shirt's collar/sleeve ("16.5/36" or "15.5-33") - same two-
  // number-pair shape, just a different separator and the first number sometimes a half size.
  const pair = t.match(/\b(\d{1,2}(?:\.\d)?)\s*([x/-])\s*(\d{2})\b/);
  if (pair) return `${pair[1]}${pair[2] === '-' ? 'x' : pair[2]}${pair[3]}`;
  const explicitSize = t.match(new RegExp(`\\bsize\\s+${SIZE_WORD}\\b`));
  if (explicitSize) return normalizeSizeWord(explicitSize[1]);
  // Unanchored fallback: short abbreviations only. Spelled-out words ("Medium", "Large") are not
  // included here - unlike the anchored matches above, this one scans the whole title, and those
  // words show up constantly in non-size contexts ("Medium Wash", "Large Pocket").
  const word = t
    // (?<!['’]) excludes the "s" in a possessive like "Men's"/"Men’s": a contraction, not a Small.
    // (?<!-) excludes a style/SKU code's trailing letter, e.g. the "L" in "11080111-L".
    .match(/(?<!['’])(?<!-)\b(xxs|xs|xxl|xxxl|xl|s|m|l)\b/);
  return word ? word[1].trim() : '';
}

/**
 * A "(Tag-NN)" / "(Tag-NNxNN)" note in a title: the seller's own caveat that the garment's tag (or
 * a remeasurement) disagrees with the size stated earlier in the same title - "Mens 38x30 ...
 * (Tag-40x32)". Either the stated size or this one can turn out to be the one that matches the
 * other platform's size field, so both get checked rather than only ever trusting one.
 */
function tagSizeFromTitle(title) {
  const t = String(title || '').toLowerCase().replace(INVISIBLE, '').replace(/(\d{1,2})\s+1\/2\b/g, '$1.5');
  const m = t.match(/\btag[\s-]*(\d{1,2}(?:\.\d)?)(?:\s*([x/-])\s*(\d{2}))?\b/);
  if (!m) return '';
  return m[2] ? `${m[1]}${m[2] === '-' ? 'x' : m[2]}${m[3]}` : m[1];
}

/**
 * Age/gender group word in a title, if any: 'kids' (kids, boys, girls, youth, toddler), 'mens',
 * 'womens', or 'unisex'. '' when the title does not say.
 */
function ageGroupFromTitle(title) {
  const t = String(title || '').toLowerCase().replace(INVISIBLE, '');
  if (/\bunisex\b/.test(t)) return 'unisex';
  if (/\b(?:kids?|boys?|girls?|youth|toddler)\b/.test(t)) return 'kids';
  if (new RegExp(`\\b(?:mens?|men${APOS}?s)\\b`).test(t)) return 'mens';
  if (new RegExp(`\\b(?:womens?|women${APOS}?s)\\b`).test(t)) return 'womens';
  return '';
}

/**
 * Whether two detected age/gender groups can be the same listing. A blank group (the title did not
 * say) does not block, since many titles omit it. Unisex matches anything. Kids and an adult group
 * never match, and mens never matches womens: the size letter or number can be identical across
 * these ("XL", "10") while meaning very different physical sizes.
 */
function ageGroupsCompatible(groupA, groupB) {
  if (!groupA || !groupB) return true;
  if (groupA === groupB) return true;
  if (groupA === 'unisex' || groupB === 'unisex') return true;
  return false;
}

/**
 * Whether two brand strings can be the same brand. Exact match (case/whitespace-insensitive)
 * always counts. One also counts as a whole-word prefix of the other, each at least 3 characters:
 * a platform's catalog often expands or shortens a brand ("Lululemon" vs "Lululemon Athletica",
 * "Ralph Lauren" vs "Polo Ralph Lauren") rather than disagreeing about it. The match is anchored to
 * word boundaries so "Levi" does not match "Levine" - a plain substring check would.
 */
function brandsCompatible(brandA, brandB) {
  const a = String(brandA || '').trim().toLowerCase();
  const b = String(brandB || '').trim().toLowerCase();
  if (!a || !b) return true;
  if (a === b) return true;
  // Punctuation/spacing-only differences: "L.L. Bean" vs "L.L.Bean", "Mizzen + Main" vs "Mizzen+Main".
  const alnumOnly = (s) => s.replace(/[^a-z0-9]/g, '');
  if (alnumOnly(a) === alnumOnly(b)) return true;
  if (a.length < 3 || b.length < 3) return false;
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return new RegExp(`\\b${escape(shorter)}\\b`).test(longer);
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

/**
 * Price is "sensible" when the two prices are within 70% of each other. Confirmed on real pairs
 * (same photo, same title) priced 42-49% apart across platforms: sellers routinely set a higher
 * "firm" price on Poshmark, where buyers haggle via offers, than on eBay for the same physical
 * item. Price is a business decision, not a physical trait like size or brand, so this stays a
 * loose sanity check against gross mismatches (a single item vs. a bundle, a data error) rather
 * than a tight one.
 */
function priceClose(a, b) {
  const pa = parseFloat(a), pb = parseFloat(b);
  if (!pa || !pb) return true; // unknown price does not block a match
  return Math.abs(pa - pb) / Math.max(pa, pb) <= 0.7;
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

const SIZE_PAIR = /^(\d{1,2}(?:\.\d)?)[x/](\d{2})$/;
const NUM_WITH_LETTER_SUFFIX = /^(\d{1,3}(?:\.\d)?)[a-z]$/;

/** Strips one trailing sizing-convention letter (20W -> 20, 15J -> 15, 8.5B -> 8.5). Unchanged if there is none. */
function bareNumber(s) {
  const m = s.match(NUM_WITH_LETTER_SUFFIX);
  return m ? m[1] : s;
}

// Longest first: a base must be checked before a shorter base it starts with would wrongly match.
const BASE_LETTER_SIZES = ['xxxl', 'xxl', 'xxs', 'xs', 'xl', 's', 'm', 'l'];

/**
 * "xxl" -> "2xl", "xxxl" -> "3xl": the digit form and the repeated-X form are the same size.
 * "lg"/"sm"/"md" -> "l"/"s"/"m", and the same one-letter-longer pattern also covers a platform's
 * kids-specific suffix ("xlb" boys XL, "sb" small boys, "lg" girls large -> "xl"/"s"/"l"): a size
 * letter code plus exactly one trailing letter is read as that base size. These show up directly in
 * a platform's size field (not just in a title, where sizeFromTitle already normalizes "Lg"/"Sm").
 */
function canonicalSize(s) {
  const xForm = s.match(/^(x+)l$/);
  if (xForm) {
    const n = xForm[1].length;
    return n === 1 ? 'xl' : `${n}xl`;
  }
  for (const base of BASE_LETTER_SIZES) {
    if (s.length === base.length + 1 && s.startsWith(base)) return base;
  }
  return s;
}

/**
 * Whether two normalized sizes can be the same size. Equal strings always match, after "XXL" and
 * "2XL" (and "XXXL"/"3XL", "LG"/"L", ...) are brought to the same form. A bare waist number also
 * matches a "waist x inseam" pair on the same waist: some platforms' size field only holds the
 * waist (the inseam lives in the title), which is not a different size, just a shorter one - and
 * that waist number may itself carry a sizing-convention letter (20W, 32P, 15J, ...), which is
 * stripped on both sides before comparing: "35x32" vs "35" vs "35W" are all waist 35.
 */
function sizesCompatible(sizeA, sizeB) {
  if (!sizeA || !sizeB) return false;
  sizeA = canonicalSize(sizeA);
  sizeB = canonicalSize(sizeB);
  if (sizeA === sizeB) return true;
  const pairA = sizeA.match(SIZE_PAIR), pairB = sizeB.match(SIZE_PAIR);
  const bareA = bareNumber(sizeA), bareB = bareNumber(sizeB);
  if (pairA && !pairB && pairA[1] === bareB) return true;
  if (pairB && !pairA && pairB[1] === bareA) return true;
  if (!pairA && !pairB && bareA === bareB) return true;
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

/**
 * Compares two records. Returns null if they cannot be the same item, else a score and the reasons.
 * `titleUniquePair`: true when these two are the ONLY records anywhere in this scan that share this
 * exact title - no other candidate on either platform to confuse this pairing with. Price and photo
 * distance are both disambiguators for picking the right match among several similarly-titled
 * candidates; with a confirmed matching size and nothing left to disambiguate, neither blocks a
 * title-unique pair the way it blocks an ambiguous one.
 */
function scorePair(a, b, { titleUniquePair = false } = {}) {
  // A merged master holds one ID per platform, so the two records must not share any platform.
  const platformsA = new Set((a.platforms || [a.platform]).filter(Boolean));
  const platformsB = (b.platforms || [b.platform]).filter(Boolean);
  if (platformsB.some(p => platformsA.has(p))) return null;
  if (a.brand && b.brand && !brandsCompatible(a.brand, b.brand)) return null;
  // Kids sizing and adult sizing (and mens vs womens) reuse the same letters/numbers for very
  // different physical sizes ("Kids XL" is nothing like "Mens XL"), so this is checked before size.
  if (!ageGroupsCompatible(ageGroupFromTitle(a.title), ageGroupFromTitle(b.title))) return null;
  // Size: use the size field, or the size written in the title when the field is empty. A "(Tag-X)"
  // caveat elsewhere in the title is a second candidate size - either it or the stated size can be
  // the one that actually matches the other side, so a clash only blocks when every combination does.
  const sizeA = normalizeSize(a.size) || sizeFromTitle(a.title);
  const sizeB = normalizeSize(b.size) || sizeFromTitle(b.title);
  if (sizeA && sizeB && !sizesCompatible(sizeA, sizeB)) {
    const tagA = tagSizeFromTitle(a.title);
    const tagB = tagSizeFromTitle(b.title);
    // Not tagA-vs-tagB: with an (near-)identical title on both sides, a tag note on one is ~always
    // read identically from the other - that would trivially "match" regardless of what the actual
    // size fields say, so only a tag actually crossed against the other side's real size counts.
    const altMatch = (tagA && sizesCompatible(tagA, sizeB)) || (tagB && sizesCompatible(sizeA, tagB));
    if (!altMatch) return null;
  }
  if (!titleUniquePair && !priceClose(a.price, b.price)) return null;

  const reasons = [];
  let score = 0;
  const overlap = titleOverlap(a.title, b.title);
  if (overlap >= 0.6) { score += 40; reasons.push(`title ${Math.round(overlap * 100)}%`); }
  const brandConfirmed = Boolean(a.brand && b.brand); // both present and (per the check above) matching
  const sizeConfirmed = Boolean(sizeA && sizeB); // both present and (per the check above) compatible
  if (brandConfirmed) { score += 15; reasons.push('brand'); }
  if (sizeConfirmed) { score += 15; reasons.push('size'); }

  // A partial title match (60-89%) shares a lot of generic, descriptive words - "straight jeans
  // mens blue medium wash denim" reads almost the same for two different brands of jeans. Without
  // brand or size actually confirmed, title + photo alone is not enough to tell those apart; an
  // (near-)exact title is specific enough on its own to skip this.
  if (overlap < EXACT_TITLE_OVERLAP && !brandConfirmed && !sizeConfirmed) return null;

  const threshold = (overlap >= EXACT_TITLE_OVERLAP && sizeConfirmed)
    ? PHOTO_DIST_THRESHOLD_HIGH_CONFIDENCE
    : PHOTO_DIST_THRESHOLD;

  const dist = hammingDistance(a.imageHash, b.imageHash);
  // Same reasoning as the price bypass above: with no other candidate on either side and the size
  // actually confirmed, there is no ambiguity left for the photo to resolve either. A verified real
  // example (same garment, confirmed by eye) landed at distance 60 purely from one platform's photo
  // being letterboxed - cross-platform compression/framing can push even the same photo well past
  // the normal ceilings, same as it does to price.
  // This only waives a far-but-computed distance, never a missing one: Infinity means a hash failed
  // to compute on at least one side (a transient fetch error, usually), which is zero photo evidence
  // rather than a noisy-but-real comparison, and title + size alone should not paper over that.
  const photoWaived = titleUniquePair && sizeConfirmed && Number.isFinite(dist);
  if (dist <= threshold) { score += 30; reasons.push(`photo distance ${dist}`); }
  else if (photoWaived) { reasons.push(`photo distance ${dist} (not required: title-unique + size match)`); }

  // A close photo is required unless waived above. A confirmed size clash was already rejected
  // above; a size missing on one side is not held against the pair, since the other evidence
  // (title, brand, photo) still has to clear the score bar on its own.
  if (score < 50) return null;
  if (dist > threshold && !photoWaived) return null;
  return { score, reasons };
}

/**
 * Finds suggested pairs among records. Each record: { id, platform, title, brand, size, price, imageHash }.
 * Records already linked (more than one platform ID) are skipped.
 */
function suggestPairs(records) {
  // How many records share each exact title, so a pair can tell whether it is the only candidate
  // on each side (titleUniquePair) or one of several the price check still needs to pick among.
  const titleCounts = new Map();
  for (const r of records) {
    const key = String(r.title || '').trim().toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  const out = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i], b = records[j];
      const keyA = String(a.title || '').trim().toLowerCase();
      const keyB = String(b.title || '').trim().toLowerCase();
      const titleUniquePair = keyA === keyB && titleCounts.get(keyA) === 2;
      const s = scorePair(a, b, { titleUniquePair });
      if (s) out.push({ a: a.id, b: b.id, platforms: [a.platform, b.platform], ...s });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

module.exports = { titleTokens, titleOverlap, priceClose, dHashFromPixels, hammingDistance, scorePair, suggestPairs, sizeFromTitle, tagSizeFromTitle, sizesCompatible, ageGroupFromTitle, ageGroupsCompatible, brandsCompatible, normalizeSize, looksLikeSize };
