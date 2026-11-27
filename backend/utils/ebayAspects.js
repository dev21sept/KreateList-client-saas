// eBay rejects custom Size values for many clothing categories and only accepts standard
// letter sizes. Combined sizes such as "16 M" are split into the standard size ("M") and
// the chest measurement ("16"), which goes to the Chest Size aspect.
const STANDARD_SIZE = /^(\d+(?:\.\d+)?)?\s*((?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)\b)$/i;

/**
 * Returns a copy of the aspects with Size normalized to a standard value.
 * Values that do not match a standard size are left unchanged.
 */
function normalizeSizeAspect(aspects = {}) {
  const result = { ...aspects };
  const raw = Array.isArray(result['Size']) ? result['Size'][0] : result['Size'];
  if (!raw) return result;

  const match = String(raw).trim().match(STANDARD_SIZE);
  if (!match) return result;

  result['Size'] = [match[2].toUpperCase()];
  if (match[1] && !result['Chest Size']) {
    result['Chest Size'] = [match[1]];
  }
  return result;
}

module.exports = { normalizeSizeAspect };
