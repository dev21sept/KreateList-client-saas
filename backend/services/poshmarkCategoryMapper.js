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

  if (!leafKey) return null;

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
  if (!targetWords) return null;

  const matches = POSHMARK_TAXONOMY.filter(entry => inGender(entry) && wordSet(singularKey(entry.path.split(' > ').pop())) === targetWords);
  return matches.length ? toResult(matches[0]) : null;
}

function toResult(entry) {
  return {
    path: entry.path,
    categoryId: entry.categoryId || '',
    departmentId: entry.departmentId || ''
  };
}

module.exports = { mapToPoshmarkCategory };
