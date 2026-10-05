/**
 * Picks the eBay category for a listing from Taxonomy category suggestions.
 *
 * eBay returns suggestions in relevance order, so the first one that is a valid apparel leaf is used.
 * Rules:
 *  - only categories under "Clothing, Shoes & Accessories" (fan/collectible matches such as
 *    "Olympic" jackets land in Sports Mem and are rejected);
 *  - never the broad "Clothing" root (206);
 *  - gender in the title (Women's / Men's) is preferred when a suggestion matches it.
 * Returns null when nothing valid is found, so the caller asks the user instead of guessing.
 */

const APPAREL_ROOT = 'Clothing, Shoes & Accessories';

function sortedAncestors(suggestion) {
  return [...(suggestion.categoryTreeNodeAncestors || [])].sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
}

function suggestionPath(suggestion) {
  return sortedAncestors(suggestion).map(a => a.categoryName).concat(suggestion.category.categoryName).join(' > ');
}

function pickEbayCategory(suggestions = [], title = '') {
  const valid = (suggestions || []).filter(s => {
    if (!s.category?.categoryId) return false;
    if (String(s.category.categoryId) === '206') return false;
    const ancestors = sortedAncestors(s);
    return ancestors.length > 0 && ancestors[0].categoryName === APPAREL_ROOT;
  });
  if (valid.length === 0) return null;

  const t = String(title).toLowerCase();
  const wantsWomen = /\bwomen'?s?\b|\bwomens\b|\bladies\b/.test(t);
  const wantsMen = !wantsWomen && /\bmen'?s?\b|\bmens\b/.test(t);

  let chosen = valid[0];
  if (wantsWomen) chosen = valid.find(s => /\bWomen/.test(suggestionPath(s))) || chosen;
  if (wantsMen) chosen = valid.find(s => /\bMen/.test(suggestionPath(s))) || chosen;

  return {
    categoryId: String(chosen.category.categoryId),
    categoryName: chosen.category.categoryName,
    path: suggestionPath(chosen),
  };
}

module.exports = { pickEbayCategory, APPAREL_ROOT };
