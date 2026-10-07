/**
 * Comparable Matcher (Stage 3)
 * Filters candidate listings by applying strict hard rejection rules,
 * then ranks surviving candidates with a calibrated 0-100 match score.
 */

const { detectConfiguration, normalizeCondition, detectProductDomain, isPlaceholder, stripGenericCategoryRoot } = require('./itemResolver');

// Generic stopwords to discount in title similarity
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'is', 'fast', 'free',
  'shipping', 'new', 'oem', 'original', 'sale', 'hot', 'authentic', 'genuine',
  'sz', 'size', 'vintage', 'rare', 'vtg', 'unknown', 'na', 'nwt', 'nwob'
]);

/**
 * A model is strong enough to require in listing titles only if it looks like a real
 * product number: letters and digits together (BTFP2350K, 501A), or a long number (50123).
 * Short bare numbers such as an MPN or style code "677" are not reliable and are ignored.
 */
function isStrongModel(model) {
  if (!model || isPlaceholder(model)) return false;
  const clean = String(model).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length < 3) return false;
  const hasLetter = /[a-z]/.test(clean);
  const hasDigit = /\d/.test(clean);
  return (hasLetter && hasDigit) || clean.length >= 5;
}

/**
 * Computes token similarity between two titles (Jaccard on non-stopwords)
 */
function computeTokenSimilarity(tokensA, textB) {
  if (!tokensA || tokensA.length === 0 || !textB) return 0;
  
  const tokensB = textB
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));

  if (tokensB.length === 0) return 0;

  // Recall: how much of the target's wording the candidate title contains.
  // Jaccard was used before, but it punished long eBay titles (score 37-44 for exact kit matches).
  const setB = new Set(tokensB);
  const targetTokens = [...new Set(tokensA)];
  let intersection = 0;
  for (const t of targetTokens) {
    if (setB.has(t)) intersection++;
  }

  return targetTokens.length > 0 ? (intersection / targetTokens.length) : 0;
}

/**
 * Checks hard rejection rules. Returns array of rejection reasons (empty if accepted).
 */
function evaluateHardRejections(targetItem, candidate) {
  const reasons = [];
  const candidateTitle = (candidate.title || '').toLowerCase();
  const targetConfig = targetItem.configType;

  // Detect candidate's configuration
  const candidateConfig = detectConfiguration(candidateTitle);

  // 1. Cross-Domain Hard Rejection (e.g. Shoes vs Jacket / Tracksuit)
  const targetDomain = targetItem.productDomain || detectProductDomain(targetItem.title, targetItem.categoryHint);
  const candCategories = stripGenericCategoryRoot((candidate.categories || []).join(' '));
  const candDomain = detectProductDomain(candidate.title, candCategories);

  if (targetDomain !== 'OTHER' && candDomain !== 'OTHER' && targetDomain !== candDomain) {
    reasons.push(`domain_mismatch_target_${targetDomain}_vs_candidate_${candDomain}`);
  }

  // Explicit Footwear vs Clothing check (prevent shoe listings from matching any apparel)
  const isTargetClothing = ['OUTERWEAR', 'TOPS', 'BOTTOMS', 'DRESSES_SUITS'].includes(targetDomain);
  const isCandidateFootwear = candDomain === 'FOOTWEAR' || /\b(shoes|sneakers|sneaker|boots|sandals|slides|cleats|loafers|dunks)\b/i.test(candidateTitle);
  if (isTargetClothing && isCandidateFootwear) {
    reasons.push('footwear_cannot_match_clothing_item');
  }

  const isTargetFootwear = targetDomain === 'FOOTWEAR';
  const isCandidateClothing = ['OUTERWEAR', 'TOPS', 'BOTTOMS', 'DRESSES_SUITS'].includes(candDomain) || 
    /\b(jacket|jackets|coat|tracksuit|windbreaker|shirt|t-shirt|pants|jeans|hoodie|sweatshirt)\b/i.test(candidateTitle);
  if (isTargetFootwear && isCandidateClothing) {
    reasons.push('clothing_cannot_match_footwear_item');
  }

  // 2. Working item vs For Parts / Not Working mismatch
  const targetCondition = targetItem.condition;
  const candidateConditionObj = normalizeCondition(candidate.condition);
  const candidateCondition = candidateConditionObj.normalized;

  if (targetCondition !== 'FOR_PARTS' && candidateCondition === 'FOR_PARTS') {
    reasons.push('candidate_is_for_parts_only');
  }
  if (targetCondition === 'FOR_PARTS' && candidateCondition !== 'FOR_PARTS') {
    reasons.push('candidate_is_working_item_for_parts_search');
  }

  // 3. Kit vs Bare Item (Tool only) mismatch
  if (targetItem.isBare && candidateConfig.isKit) {
    reasons.push('kit_vs_tool_only_mismatch');
  }
  if (targetItem.isKit && candidateConfig.isBare) {
    reasons.push('tool_only_vs_kit_mismatch');
  }

  // 4. New vs Used hard divergence
  if (targetCondition === 'NEW' && ['USED', 'FOR_PARTS'].includes(candidateCondition)) {
    reasons.push('new_vs_used_mismatch');
  }

  // 5. Incompatible Model Check (only for a strong model number, see isStrongModel)
  if (isStrongModel(targetItem.model)) {
    const targetModelClean = targetItem.model.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candTitleClean = candidateTitle.replace(/[^a-z0-9]/g, '');
    
    if (!candTitleClean.includes(targetModelClean)) {
      reasons.push('model_not_found_in_candidate_title');
    }
  }

  // 5b. Accessories, parts and consumables are not the item itself
  const targetTitle = (targetItem.title || '').toLowerCase();
  // Plural "pins"/"nails" are consumables; singular "pin nailer" is the tool itself.
  const ACCESSORY_PATTERN = /\b(parts?|replacement|nose|pins|nails|fasteners?|covers?|manuals?|batter(y|ies)|chargers?|filters?|hoses?|adapters?|tips?)\b/i;
  if (!ACCESSORY_PATTERN.test(targetTitle) && !candidateConfig.isKit && ACCESSORY_PATTERN.test(candidateTitle)) {
    reasons.push('accessory_listing_for_full_item');
  }

  // 6. Zero or negative price
  if (!candidate.total_price || candidate.total_price <= 0) {
    reasons.push('invalid_price');
  }

  return reasons;
}

/**
 * Calculates a match score (0–100) for a non-rejected candidate
 */
function calculateMatchScore(targetItem, candidate) {
  let score = 0;
  const reasons = [];

  const candidateTitle = (candidate.title || '').toLowerCase();
  const candConditionObj = normalizeCondition(candidate.condition);

  // Feature 1: Exact identifier (UPC/GTIN) - Weight: 40
  if (targetItem.upc) {
    if (candidateTitle.includes(targetItem.upc)) {
      score += 40;
      reasons.push('exact_upc_match');
    }
  }

  // Feature 2: Brand + Model/MPN - Weight: 25
  let brandMatched = false;
  let modelMatched = false;

  if (targetItem.brand && !isPlaceholder(targetItem.brand)) {
    const brandClean = targetItem.brand.toLowerCase();
    if (candidateTitle.includes(brandClean)) {
      brandMatched = true;
    }
  }

  // Check model only when it is a strong model number (see isStrongModel)
  if (isStrongModel(targetItem.model)) {
    const modelClean = targetItem.model.toLowerCase();
    if (candidateTitle.includes(modelClean)) {
      modelMatched = true;
    }
  }

  if (brandMatched && modelMatched) {
    score += 25;
    reasons.push('brand_and_model_match');
  } else if (modelMatched) {
    score += 18;
    reasons.push('model_match');
  } else if (brandMatched) {
    score += 8;
    reasons.push('brand_only_match');
  }

  // Feature 3: Title/Token Similarity - Weight: 20
  const tokenSim = computeTokenSimilarity(targetItem.searchTokens, candidateTitle);
  const tokenPoints = Math.round(tokenSim * 20);
  score += tokenPoints;
  if (tokenSim > 0.3) {
    reasons.push(`title_similarity_${Math.round(tokenSim * 100)}%`);
  }

  // Feature 4: Configuration / Pack Match - Weight: 10
  const candidateConfig = detectConfiguration(candidateTitle);
  if (targetItem.isBare === candidateConfig.isBare && targetItem.isKit === candidateConfig.isKit) {
    score += 10;
    reasons.push('configuration_match');
  } else {
    score += 2;
  }

  // Feature 5: Condition Compatibility - Weight: 5
  if (targetItem.condition === candConditionObj.normalized) {
    score += 5;
    reasons.push('condition_exact_match');
  } else if (
    (targetItem.condition === 'LIKE_NEW' && candConditionObj.normalized === 'NEW') ||
    (targetItem.condition === 'USED' && candConditionObj.normalized === 'LIKE_NEW')
  ) {
    score += 3;
    reasons.push('condition_compatible');
  }

  // Feature 6: Category / Domain Consistency - Weight: 10
  const targetDomain = targetItem.productDomain || detectProductDomain(targetItem.title, targetItem.categoryHint);
  const candCategories = stripGenericCategoryRoot((candidate.categories || []).join(' '));
  const candDomain = detectProductDomain(candidate.title, candCategories);

  if (targetDomain !== 'OTHER' && candDomain === targetDomain) {
    score += 10;
    reasons.push(`domain_${targetDomain.toLowerCase()}_matched`);
  } else if (targetItem.categoryHint && candidate.categories && candidate.categories.length > 0) {
    const catMatch = candidate.categories.some(c => 
      c.toLowerCase().includes(targetItem.categoryHint.toLowerCase())
    );
    if (catMatch) {
      score += 5;
      reasons.push('category_matched');
    }
  } else {
    score += 3; // Neutral default
  }

  return {
    score: Math.min(Math.max(score, 0), 100),
    reasons
  };
}

/**
 * Matches and filters a candidate pool against target item profile
 * @param {Object} targetItem - from itemResolver.normalized
 * @param {Array} candidateList - raw candidate listings
 * @param {number} minAcceptanceScore - default 35
 */
function matchAndFilterComparables(targetItem, candidateList = [], minAcceptanceScore = 35) {
  const accepted = [];
  const rejected = [];

  for (const candidate of candidateList) {
    // 1. Evaluate hard rejections
    const rejectionReasons = evaluateHardRejections(targetItem, candidate);
    if (rejectionReasons.length > 0) {
      rejected.push({
        candidate,
        reasons: rejectionReasons
      });
      continue;
    }

    // 2. Score candidate
    const { score, reasons } = calculateMatchScore(targetItem, candidate);

    if (score >= minAcceptanceScore) {
      accepted.push({
        ...candidate,
        match_score: score,
        match_reasons: reasons
      });
    } else {
      rejected.push({
        candidate,
        reasons: [`score_too_low_${score}_below_${minAcceptanceScore}`]
      });
    }
  }

  // Sort accepted by match_score descending
  accepted.sort((a, b) => b.match_score - a.match_score);

  return { accepted, rejected };
}

module.exports = {
  isStrongModel,
  matchAndFilterComparables,
  evaluateHardRejections,
  calculateMatchScore
};
