const { POSHMARK_TAXONOMY } = require('../constants/poshmarkTaxonomy');

// eBay path segments that carry no product information.
const GENERIC_SEGMENTS = new Set(['clothing', 'shoes', 'accessories', 'clothing shoes and accessories', 'other']);
const GENDER_WORDS = new Set(['women', 'womens', 'men', 'mens', 'kids', 'girls', 'boys', 'unisex', 'female', 'male']);
const STOP_WORDS = new Set(['and', 'the', 'for', 'of', 'with']);
// Common eBay leaf names whose Poshmark leaf is spelled differently (keys are singularKey() forms).
const LEAF_SYNONYMS = {
  't shirt': 'tee short sleeve',
  'tshirt': 'tee short sleeve',
  'tee': 'tee short sleeve',
  'long sleeve t shirt': 'tee long sleeve',
  'tank top': 'tank top',
  'sweatshirt': 'sweatshirt and hoodie',
  'hoodie': 'sweatshirt and hoodie'
};

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Plural-tolerant key: "Shoes" and "Shoe" compare equal.
function singularKey(text) {
  return normalize(text)
    .split(' ')
    .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

function genderFromText(text = '') {
  const clean = normalize(text);
  if (/\b(women|womens|women s|female|girls?)\b/.test(clean)) return 'Women';
  if (/\b(men|mens|men s|male|boys?)\b/.test(clean)) return 'Men';
  if (/\b(kids?|child|children|baby|toddler)\b/.test(clean)) return 'Kids';
  return null;
}

// Takes the eBay category path (e.g. "Clothing, Shoes & Accessories > Women > Women's Shoes > Athletic Shoes"),
// falls back to the title, and returns the best Poshmark taxonomy entry or null.
// Returns null instead of guessing, so the seller can pick the category manually.
function mapToPoshmarkCategory({ ebayPath = '', title = '', gender = null } = {}) {
  const segments = String(ebayPath)
    .split('>')
    .map(s => s.trim())
    .filter(s => s && !GENERIC_SEGMENTS.has(normalize(s)));

  const leafText = segments.length ? segments[segments.length - 1] : '';
  const parentText = segments.length > 1 ? segments[segments.length - 2] : '';
  const targetGender = gender || genderFromText(ebayPath) || genderFromText(title);
  const rawLeafKey = singularKey(leafText);
  const leafKey = LEAF_SYNONYMS[rawLeafKey] || rawLeafKey;

  if (!leafKey) {
    // Neither eBay nor anywhere else stored any category hierarchy at all for this item (ebayPath was
    // empty or just the bare "Clothing" placeholder) - the title itself is the only signal left. Scan
    // its words from the end: in these resale-listing titles the actual garment type word almost
    // always sits right before the gender/size block ("... Sweater Jacket Womens 3X Red Black
    // Houndstooth"), the same position a compound eBay leaf's head noun sits in, so each word is tried
    // through this same function recursively - never an invented/unrelated guess, only real taxonomy matches.
    if (!title) return null;
    const titleTargetGender = gender || genderFromText(title);
    const titleInGender = entry => !titleTargetGender || entry.path.split(' > ')[0] === titleTargetGender;
    const words = normalize(title).split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w)).map(w => singularKey(w));
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (STOP_WORDS.has(word) || GENDER_WORDS.has(word)) continue;
      // Only a garment-FAMILY word (a group name - "Jacket", "Shorts", "Dress") is trustworthy here,
      // not a specific-style leaf ("V-Neck", "Crew") - a style descriptor coincidentally appearing in
      // the title ("Mock Neck" on a fleece jacket) could otherwise match an unrelated leaf by accident
      // ("Neck" -> Sweaters > V-Neck) and produce a confidently wrong category instead of none.
      const group = POSHMARK_TAXONOMY.filter(entry => {
        const middle = entry.path.split(' > ');
        return middle.length === 3 && titleInGender(entry) && singularKey(middle[1]) === word;
      });
      if (group.length) return toResult(group[0]);
      const groupContains = POSHMARK_TAXONOMY.filter(entry => {
        const middle = entry.path.split(' > ');
        return middle.length === 3 && titleInGender(entry) && singularKey(middle[1]).split(' ').includes(word);
      });
      if (groupContains.length) return toResult(groupContains[0]);
    }
    return null;
  }

  const inGender = entry => !targetGender || entry.path.split(' > ')[0] === targetGender;

  // 1. Exact leaf match ("Athletic Shoes" -> "Women > Shoes > Athletic Shoes").
  // Poshmark's generic groups ("Jeans", "Dresses", "Jackets") are not leaves, so they
  // return null here and the seller picks the exact sub-type.
  let candidates = POSHMARK_TAXONOMY.filter(entry => {
    const entryLeaf = singularKey(entry.path.split(' > ').pop());
    return entryLeaf === leafKey && inGender(entry);
  });

  // Several exact matches (e.g. "Shoes > Boots" under Women and Men): prefer the one whose parent matches the eBay parent.
  if (candidates.length > 1 && parentText) {
    const parentKey = singularKey(parentText);
    const withParent = candidates.filter(entry => {
      const middle = entry.path.split(' > ').slice(1, -1).map(singularKey);
      return middle.some(part => part && parentKey.includes(part));
    });
    if (withParent.length) candidates = withParent;
  }

  if (candidates.length) return toResult(candidates[0]);

  // 2. Same words in a different order or with a leading gender word ("Women's Athletic Shoes").
  const wordSet = key => [...new Set(key.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w) && !GENDER_WORDS.has(w)))].sort().join(' ');
  const targetWords = wordSet(leafKey);
  if (targetWords) {
    const matches = POSHMARK_TAXONOMY.filter(entry => inGender(entry) && wordSet(singularKey(entry.path.split(' > ').pop())) === targetWords);
    if (matches.length) return toResult(matches[0]);
  }

  // 3. eBay's leaf IS one of Poshmark's own generic groups ("Jeans", "Dresses", "Jackets") rather than
  // a specific subtype ("Straight Leg", "Maxi") - every subtype under one group shares the same
  // categoryId/departmentId (Poshmark's publish API only needs that pair; the subtype only changes
  // Poshmark's own display label), so any entry in the group satisfies publishing just as well as
  // guessing the "right" subtype would, and leaves the actual subtype pick to the seller instead of
  // silently blocking the whole listing.
  const groupMatches = POSHMARK_TAXONOMY.filter(entry => {
    const middle = entry.path.split(' > ');
    return middle.length === 3 && inGender(entry) && singularKey(middle[1]) === leafKey;
  });
  if (groupMatches.length) return toResult(groupMatches[0]);

  // Compound group names ("Shirts & Tops", "Jackets & Coats") don't equal a single-word eBay leaf
  // ("Shirts") exactly - a group whose name contains the eBay leaf word is still a confident match.
  const groupContainsMatches = POSHMARK_TAXONOMY.filter(entry => {
    const middle = entry.path.split(' > ');
    return middle.length === 3 && inGender(entry) && singularKey(middle[1]).split(' ').includes(leafKey);
  });
  if (groupContainsMatches.length) return toResult(groupContainsMatches[0]);

  // 4. eBay's own leaf is itself a compound ("Activewear Tops", "Golf ... Shirts & Tops", "Coats,
  // Jackets & Vests") - leafKey never matches as one unit since it's multiple words. The LAST word of
  // an English compound is usually the actual garment type ("Activewear Tops" -> "Tops"; a qualifier
  // like "Activewear"/"Golf" is a prefix, not the category). Try each word from the end through the
  // same three tiers above until one hits.
  const leafWords = leafKey.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
  for (let i = leafWords.length - 1; i >= 0; i--) {
    if (leafWords.length < 2) break; // already tried as the whole leafKey above
    const word = leafWords[i];
    const exact = POSHMARK_TAXONOMY.filter(entry => singularKey(entry.path.split(' > ').pop()) === word && inGender(entry));
    if (exact.length) return toResult(exact[0]);
    const group = POSHMARK_TAXONOMY.filter(entry => {
      const middle = entry.path.split(' > ');
      return middle.length === 3 && inGender(entry) && singularKey(middle[1]) === word;
    });
    if (group.length) return toResult(group[0]);
    const groupContains = POSHMARK_TAXONOMY.filter(entry => {
      const middle = entry.path.split(' > ');
      return middle.length === 3 && inGender(entry) && singularKey(middle[1]).split(' ').includes(word);
    });
    if (groupContains.length) return toResult(groupContains[0]);
  }

  return null;
}

function toResult(entry) {
  return {
    path: entry.path,
    categoryId: entry.categoryId || '',
    departmentId: entry.departmentId || ''
  };
}

module.exports = { mapToPoshmarkCategory };
