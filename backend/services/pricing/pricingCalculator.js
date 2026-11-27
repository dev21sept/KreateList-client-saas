/**
 * Pricing Calculator (Stage 4)
 * Deterministic mathematical calculation of median, IQR, range bounds,
 * seller objective adjustments, and price psychological rounding.
 */

/**
 * Calculates percentile from a sorted array of numbers
 */
function getPercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Drops comparables whose price is far outside the main cluster (Tukey fences).
 * Keeps the original list when trimming would leave fewer than 3 items.
 */
function removePriceOutliers(items = [], getPrice = item => item.total_price) {
  if (items.length < 4) return items;

  const sorted = items.map(getPrice).filter(p => p > 0).sort((a, b) => a - b);
  const q1 = getPercentile(sorted, 25);
  const q3 = getPercentile(sorted, 75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;

  const kept = items.filter(item => {
    const price = getPrice(item);
    return price >= low && price <= high;
  });
  return kept.length >= 3 ? kept : items;
}

/**
 * Calculates robust statistical distribution from price list
 */
function calculatePriceDistribution(priceList = []) {
  if (!priceList || priceList.length === 0) {
    return null;
  }

  // Sort prices ascending
  const sorted = [...priceList].map(p => Number(p)).filter(p => !isNaN(p) && p > 0).sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 0) return null;

  const median = getPercentile(sorted, 50);
  const q1 = n >= 4 ? getPercentile(sorted, 25) : Math.max(sorted[0], median * 0.85);
  const q3 = n >= 4 ? getPercentile(sorted, 75) : Math.min(sorted[sorted.length - 1], median * 1.15);
  const iqr = parseFloat((q3 - q1).toFixed(2));

  return {
    sample_size: n,
    min: sorted[0],
    max: sorted[n - 1],
    median: parseFloat(median.toFixed(2)),
    q1: parseFloat(q1.toFixed(2)),
    q3: parseFloat(q3.toFixed(2)),
    iqr,
    range: {
      low: parseFloat(Math.min(q1, median * 0.9).toFixed(2)),
      high: parseFloat(Math.max(q3, median * 1.1).toFixed(2))
    }
  };
}

/**
 * Applies standard eBay retail psychological rounding (e.g., .99 or .95)
 */
function applyPsychologicalRounding(price) {
  if (!price || price <= 0) return 0.99;
  
  // For items under $10: round to .99
  // For items between $10 and $100: round to .99 or .95
  // For items > $100: round to .99 or integer .00
  const floorVal = Math.floor(price);
  const cents = price - floorVal;

  if (price < 15) {
    return parseFloat((floorVal + 0.99).toFixed(2));
  } else if (cents <= 0.49) {
    return parseFloat((floorVal - 1 + 0.99).toFixed(2));
  } else {
    return parseFloat((floorVal + 0.99).toFixed(2));
  }
}

/**
 * Applies seller objective strategy to raw median price
 */
function applySellerObjective(basePrice, objective = 'MARKET_MATCHED', distribution) {
  let adjusted = basePrice;
  let explanation = 'Aligned with the observed comparable-sale midpoint.';

  switch (objective) {
    case 'SELL_FASTER':
      // Price toward the lower quartile Q1 or 8-12% below median
      if (distribution && distribution.q1 && distribution.q1 < basePrice) {
        adjusted = distribution.q1;
      } else {
        adjusted = basePrice * 0.90;
      }
      explanation = 'Priced toward the lower end of comparable listings to sell faster.';
      break;

    case 'LEAVE_ROOM_FOR_OFFERS':
      // Start 10-15% above median to give room for buyer negotiations
      if (distribution && distribution.q3 && distribution.q3 > basePrice) {
        adjusted = distribution.q3;
      } else {
        adjusted = basePrice * 1.10;
      }
      explanation = 'Higher starting price; leaves room for offers and negotiations.';
      break;

    case 'MARKET_MATCHED':
    default:
      adjusted = basePrice;
      explanation = 'Aligned with the observed comparable midpoint.';
      break;
  }

  const rounded = applyPsychologicalRounding(adjusted);

  return {
    raw_adjusted: parseFloat(adjusted.toFixed(2)),
    final_price: rounded,
    objective,
    explanation
  };
}

module.exports = {
  removePriceOutliers,
  calculatePriceDistribution,
  applySellerObjective,
  applyPsychologicalRounding,
  getPercentile
};
