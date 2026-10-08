/**
 * Picks the eBay category for a listing from Taxonomy category suggestions.
 *
 * eBay returns suggestions in relevance order, so the first valid leaf is used. This works for any
 * product, not only apparel (an earlier version required "Clothing, Shoes & Accessories" as the root,
 * which left every non-apparel item - health, electronics, home, ... - with no category at all).
 * Rules:
 *  - never the broad "Clothing" root (206), and never a node with no ancestors (not a real leaf);
 *  - a suggestion under a root known to cause bad matches (fan memorabilia for a plain jacket, e.g.
 *    "Olympic" in the title) is used only when there is no other valid suggestion;
 *  - gender in the title (Women's / Men's) is preferred when a suggestion matches it.
 * Returns null when nothing valid is found, so the caller asks the user instead of guessing.
 */

// Roots that have produced wrong matches for ordinary items (a team-logo word in the title pulls in
// collectibles). Suggestions here are a last resort, not excluded outright: for a real memorabilia
// item they may be the only valid result.
const LOW_PRIORITY_ROOTS = new Set(['Sports Mem, Cards & Fan Shop', 'Collectibles', 'Entertainment Memorabilia']);

function sortedAncestors(suggestion) {
  return [...(suggestion.categoryTreeNodeAncestors || [])].sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
}

function suggestionPath(suggestion) {
  return sortedAncestors(suggestion).map(a => a.categoryName).concat(suggestion.category.categoryName).join(' > ');
}

function rootOf(suggestion) {
  return sortedAncestors(suggestion)[0]?.categoryName || '';
}

function pickEbayCategory(suggestions = [], title = '') {
  const valid = (suggestions || []).filter(s => {
    if (!s.category?.categoryId) return false;
    if (String(s.category.categoryId) === '206') return false;
    return sortedAncestors(s).length > 0;
  });
  if (valid.length === 0) return null;

  const preferred = valid.filter(s => !LOW_PRIORITY_ROOTS.has(rootOf(s)));
  const pool = preferred.length > 0 ? preferred : valid;

  const t = String(title).toLowerCase();
  const wantsWomen = /\bwomen'?s?\b|\bwomens\b|\bladies\b/.test(t);
  const wantsMen = !wantsWomen && /\bmen'?s?\b|\bmens\b/.test(t);

  let chosen = pool[0];
  if (wantsWomen) chosen = pool.find(s => /\bWomen/.test(suggestionPath(s))) || chosen;
  if (wantsMen) chosen = pool.find(s => /\bMen/.test(suggestionPath(s))) || chosen;

  return {
    categoryId: String(chosen.category.categoryId),
    categoryName: chosen.category.categoryName,
    path: suggestionPath(chosen),
  };
}

module.exports = { pickEbayCategory, LOW_PRIORITY_ROOTS };
