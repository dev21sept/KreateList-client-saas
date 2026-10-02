/**
 * Comparable Matcher (Stage 3)
 * Filters candidate listings by applying strict hard rejection rules,
 * then ranks surviving candidates with a calibrated 0-100 match score.
 */

const { detectConfiguration, normalizeCondition } = require('./itemResolver');

// Generic stopwords to discount in title similarity
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'a', 'an', 'in', 'of', 'to', 'is', 'fast', 'free',
  'shipping', 'new', 'oem', 'original', 'sale', 'hot', 'authentic', 'genuine'
]);

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

  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of tokensA) {
    if (setB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? (intersection / union) : 0;
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

  // 1. Working item vs For Parts / Not Working mismatch
  const targetCondition = targetItem.condition;
  const candidateConditionObj = normalizeCondition(candidate.condition);
  const candidateCondition = candidateConditionObj.normalized;

  if (targetCondition !== 'FOR_PARTS' && candidateCondition === 'FOR_PARTS') {
    reasons.push('candidate_is_for_parts_only');
  }
  if (targetCondition === 'FOR_PARTS' && candidateCondition !== 'FOR_PARTS') {
    reasons.push('candidate_is_working_item_for_parts_search');
  }

  // 2. Kit vs Bare Item (Tool only) mismatch
  if (targetItem.isBare && candidateConfig.isKit) {
    reasons.push('kit_vs_tool_only_mismatch');
  }
  if (targetItem.isKit && candidateConfig.isBare) {
    reasons.push('tool_only_vs_kit_mismatch');
  }

  // 3. New vs Used hard divergence
  // If target is brand new, exclude heavily used items from primary set if condition is known
  if (targetCondition === 'NEW' && ['USED', 'FOR_PARTS'].includes(candidateCondition)) {
    reasons.push('new_vs_used_mismatch');
  }
  if (targetCondition === 'USED' && candidateCondition === 'NEW') {
    // Note: Can allow new as weak comp if few comps exist, but for strictness flag it
    // We let this be handled by condition score unless extreme price divergence
  }

  // 4. Incompatible Model Check
  if (targetItem.model && targetItem.model.length >= 3) {
    const targetModelClean = targetItem.model.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candTitleClean = candidateTitle.replace(/[^a-z0-9]/g, '');
    
    // If candidate has an explicitly conflicting model number (e.g., XPH12 vs XPH14)
    // We check if target model exists in candidate title
    if (!candTitleClean.includes(targetModelClean)) {
      // Model not found in title. If title has another distinct alphanumeric code of similar length, penalize
      reasons.push('model_not_found_in_candidate_title');
    }
  }

  // 5. Zero or negative price
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
    // If candidate mentions exact UPC
    if (candidateTitle.includes(targetItem.upc)) {
      score += 40;
      reasons.push('exact_upc_match');
    }
  }

  // Feature 2: Brand + Model/MPN - Weight: 25
  let brandMatched = false;
  let modelMatched = false;

  if (targetItem.brand) {
    const brandClean = targetItem.brand.toLowerCase();
    if (candidateTitle.includes(brandClean)) {
      brandMatched = true;
    }
  }

  if (targetItem.model) {
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

  // Feature 3: Title/Token Similarity - Weight: 15
  const tokenSim = computeTokenSimilarity(targetItem.searchTokens, candidateTitle);
  const tokenPoints = Math.round(tokenSim * 15);
  score += tokenPoints;
  if (tokenSim > 0.4) {
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

  // Feature 6: Category Consistency - Weight: 5
  if (targetItem.categoryHint && candidate.categories && candidate.categories.length > 0) {
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
  matchAndFilterComparables,
  evaluateHardRejections,
  calculateMatchScore
};
