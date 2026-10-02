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
  const rawBrand = (rawItem.brand || '').trim();
  const rawModel = (rawItem.model || rawItem.mpn || '').trim();
  const rawUpc = (rawItem.upc || rawItem.ean || rawItem.gtin || '').trim();
  
  // Field-level extractions
  const condition = normalizeCondition(rawItem.condition);
  const configuration = detectConfiguration(title, rawItem.included_items);
  
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
    .filter(t => t.length > 1 && !['the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to'].includes(t));

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
      categoryHint: rawItem.category_hint || rawItem.category || null,
      searchTokens
    },
    fieldConfidence,
    identityScore,
    identityConflict: false,
    missingFields
  };
}

module.exports = {
  resolveItem,
  normalizeCondition,
  detectConfiguration,
  CONDITION_TAXONOMY
};
