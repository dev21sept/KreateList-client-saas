/**
 * Item Resolver (Stage 1)
 * Extracts and normalizes product identity features from listing input.
 * Preserves raw values, calculates field-level confidence, and flags conflicts.
 */

// Common condition taxonomy mapping
const CONDITION_TAXONOMY = {
  NEW: ['new', 'brand new', 'new with tags', 'new with box', 'nwt', 'nwb', 'sealed', '1000'],
  LIKE_NEW: ['like new', 'open box', 'mint', 'excellent', 'pre-owned - like new', '1500', '2000'],
  USED: ['used', 'good', 'pre-owned', 'fair', 'very good', 'used - good', 'used - fair', '3000', '4000', '5000'],
  REFURBISHED: ['refurbished', 'seller refurbished', 'certified refurbished', 'reconditioned', '2500'],
  FOR_PARTS: ['for parts', 'not working', 'as-is', 'broken', 'salvage', 'parts only', '7000']
};

// Configuration keywords that indicate bare vs complete items
const BUNDLE_INDICATORS = {
  BARE_ITEM: [
    'tool only', 'bare tool', 'no battery', 'body only', 'console only', 
    'device only', 'without charger', 'no charger', 'unit only', 'replacement only'
  ],
  FULL_KIT: [
    'kit', 'bundle', 'combo', 'with battery', 'with charger', 'complete set',
    'accessories included', 'full set', 'starter kit', 'box included'
  ],
  PARTS_ONLY: [
    'for parts', 'not working', 'repair', 'spares', 'salvage', 'as is'
  ]
};

// Generic placeholder terms returned by AI or forms when exact value is unknown
const PLACEHOLDER_STRINGS = new Set([
  'unknown', 'n/a', 'na', 'none', 'does not apply', 'not applicable',
  'unbranded', 'generic', 'other', 'custom', 'unspecified', 'standard',
  'classic', 'regular', 'null', 'undefined', 'varies', 'see description',
  'does not apply.', 'n / a', 'not applied', 'no brand'
]);

// eBay category paths start with "Clothing, Shoes & Accessories" for every apparel item.
// That root is not a product type, so it must not make a shirt look like footwear.
function stripGenericCategoryRoot(text) {
  if (!text) return text;
  return String(text).replace(/(clothing,?\s*)?shoes\s*(?:&|and)\s*accessories/gi, " ");
}

function isPlaceholder(val) {
  if (!val) return true;
  const clean = String(val).trim().toLowerCase();
  return PLACEHOLDER_STRINGS.has(clean) || clean.length <= 1;
}

// Product domain taxonomy mapping to prevent cross-category contamination
const DOMAIN_PATTERNS = {
  FOOTWEAR: /\b(shoes|shoe|sneakers|sneaker|boots|boot|sandals|sandal|slides|slide|loafers|cleats|heels|slippers|trainers|dunks|footwear|pumps|oxfords|clogs|mules)\b/i,
  OUTERWEAR: /\b(jacket|jackets|coat|coats|windbreaker|windbreakers|tracksuit|tracksuits|parka|parkas|puffer|vest|vests|bomber|fleece|anorak|outerwear|blazer|blazers|overcoat)\b/i,
  TOPS: /\b(shirt|shirts|t-shirt|t-shirts|tee|tees|jersey|jerseys|polo|polos|tank|tanks|blouse|blouses|sweater|sweaters|sweatshirt|sweatshirts|hoodie|hoodies)\b/i,
  BOTTOMS: /\b(pants|pant|jeans|jean|shorts|short|leggings|sweatpants|joggers|trousers|skirt|skirts|slacks|chinos)\b/i,
  DRESSES_SUITS: /\b(dress|dresses|gown|gowns|suit|suits|tuxedo|romper|jumpsuit)\b/i,
  ACCESSORIES: /\b(bag|bags|backpack|backpacks|purse|purses|wallet|wallets|hat|hats|cap|caps|beanie|beanies|belt|belts|scarf|scarves|gloves|sunglasses|watch|watches|jewelry)\b/i
};

function detectProductDomain(title = '', categoryText = '') {
  const combined = `${title || ''} ${categoryText || ''}`.toLowerCase();
  
  if (DOMAIN_PATTERNS.OUTERWEAR.test(combined) && !DOMAIN_PATTERNS.FOOTWEAR.test(title || '')) {
    return 'OUTERWEAR';
  }
  if (DOMAIN_PATTERNS.FOOTWEAR.test(combined)) {
    return 'FOOTWEAR';
  }
  if (DOMAIN_PATTERNS.OUTERWEAR.test(combined)) {
    return 'OUTERWEAR';
  }
  if (DOMAIN_PATTERNS.DRESSES_SUITS.test(combined)) {
    return 'DRESSES_SUITS';
  }
  if (DOMAIN_PATTERNS.BOTTOMS.test(combined)) {
    return 'BOTTOMS';
  }
  if (DOMAIN_PATTERNS.TOPS.test(combined)) {
    return 'TOPS';
  }
  if (DOMAIN_PATTERNS.ACCESSORIES.test(combined)) {
    return 'ACCESSORIES';
  }
  return 'OTHER';
}

/**
 * Normalizes condition text to standard taxonomy
 */
function normalizeCondition(rawCondition) {
  if (!rawCondition) return { normalized: 'USED', confidence: 0.5, raw: '' };
  
  const text = String(rawCondition).toLowerCase().trim();
  for (const [standardKey, patterns] of Object.entries(CONDITION_TAXONOMY)) {
    if (patterns.some(p => text.includes(p))) {
      return { normalized: standardKey, confidence: 0.9, raw: rawCondition };
    }
  }
  return { normalized: 'USED', confidence: 0.6, raw: rawCondition };
}

function hasPhrase(phrase, text) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return regex.test(text);
}

/**
 * Detects configuration type (tool only, full kit, etc.)
 */
function detectConfiguration(title, includedItems = []) {
  const combined = `${title || ''} ${(Array.isArray(includedItems) ? includedItems.join(' ') : includedItems) || ''}`.toLowerCase();
  
  const isBare = BUNDLE_INDICATORS.BARE_ITEM.some(kw => hasPhrase(kw, combined));
  const isKit = BUNDLE_INDICATORS.FULL_KIT.some(kw => hasPhrase(kw, combined));
  const isParts = BUNDLE_INDICATORS.PARTS_ONLY.some(kw => hasPhrase(kw, combined));

  if (isParts) return { configType: 'FOR_PARTS', isKit: false, isBare: false };
  if (isBare && !isKit) return { configType: 'BARE_ITEM', isKit: false, isBare: true };
  if (isKit && !isBare) return { configType: 'FULL_KIT', isKit: true, isBare: false };
  return { configType: 'STANDARD', isKit: false, isBare: false };
}

/**
 * Extracts and normalizes item identity
 */
function resolveItem(rawItem = {}) {
  const title = (rawItem.title || '').trim();
  let rawBrand = (rawItem.brand || '').trim();
  let rawModel = (rawItem.model || rawItem.mpn || '').trim();
  const rawUpc = (rawItem.upc || rawItem.ean || rawItem.gtin || '').trim();
  const categoryId = rawItem.category_id || rawItem.categoryId || null;
  const categoryHint = stripGenericCategoryRoot(rawItem.category_hint || rawItem.category || rawItem.category_name || null);

  // Sanitize placeholder values (e.g. "Unknown", "N/A", "Does Not Apply")
  if (isPlaceholder(rawBrand)) rawBrand = '';
  if (isPlaceholder(rawModel)) rawModel = '';
  
  // Field-level extractions
  const condition = normalizeCondition(rawItem.condition);
  const configuration = detectConfiguration(title, rawItem.included_items);
  const productDomain = detectProductDomain(title, categoryHint);
  
  // Check format of UPC/GTIN if available (8, 12, 13, 14 digits)
  const isValidUpc = rawUpc && /^\d{8,14}$/.test(rawUpc);
  
  // Compute extraction confidence per field
  const fieldConfidence = {
    title: title ? 1.0 : 0.0,
    brand: rawBrand ? 0.95 : 0.3,
    model: rawModel ? 0.90 : 0.4,
    upc: isValidUpc ? 0.98 : (rawUpc ? 0.4 : 0.0),
    condition: condition.confidence,
    configuration: configuration.configType !== 'STANDARD' ? 0.9 : 0.7
  };

  // Overall identity confidence (weighted average)
  let identityScore = 0;
  if (isValidUpc) {
    identityScore = 95;
  } else if (rawBrand && rawModel) {
    identityScore = 85;
  } else if (rawBrand && title.length > 10) {
    identityScore = 65;
  } else if (title.length > 10) {
    identityScore = 45;
  } else {
    identityScore = 20;
  }

  // Missing critical fields
  const missingFields = [];
  if (!rawBrand) missingFields.push('brand');
  if (!rawModel) missingFields.push('model');
  if (!isValidUpc) missingFields.push('upc');

  // Tokenize title for search and matching
  const searchTokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !['the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'sz', 'size', 'unknown', 'na', 'nwt'].includes(t));

  return {
    raw: rawItem,
    normalized: {
      title,
      brand: rawBrand,
      model: rawModel,
      upc: isValidUpc ? rawUpc : null,
      condition: condition.normalized,
      rawCondition: condition.raw,
      configType: configuration.configType,
      isBare: configuration.isBare,
      isKit: configuration.isKit,
      categoryId,
      categoryHint,
      productDomain,
      searchTokens
    },
    fieldConfidence,
    identityScore,
    identityConflict: false,
    missingFields
  };
}

module.exports = {
  stripGenericCategoryRoot,
  resolveItem,
  normalizeCondition,
  detectConfiguration,
  detectProductDomain,
  isPlaceholder,
  CONDITION_TAXONOMY,
  DOMAIN_PATTERNS
};
