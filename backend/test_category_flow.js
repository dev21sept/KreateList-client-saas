require('dotenv').config();
const ebayService = require('./services/ebayService');
const { POSHMARK_TAXONOMY } = require('./constants/poshmarkTaxonomy');
const { MERCARI_FLAT_CATEGORIES: MERCARI_TAXONOMY } = require('./constants/mercariCategoryTaxonomy.json');

async function run() {
  console.log('Testing category resolution:');

  // 1. eBay Suggestion
  try {
    const appToken = await ebayService.getAppToken();
    const suggestions = await ebayService.getCategorySuggestions(appToken, 'Mens APFU Military Physical Fitness T-Shirt');
    let validSuggestions = (suggestions || []).filter(s => 
      String(s.category?.categoryId) !== '206' && 
      s.category?.categoryName?.toLowerCase() !== 'clothing' &&
      (s.categoryTreeNodeAncestors || []).length > 0
    );
    if (validSuggestions.length > 0) {
      validSuggestions.sort((a, b) => (b.categoryTreeNodeAncestors || []).length - (a.categoryTreeNodeAncestors || []).length);
      const best = validSuggestions[0];
      const ancestors = (best.categoryTreeNodeAncestors || []).sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
      const path = ancestors.map(a => a.categoryName).concat(best.category.categoryName).join(' > ');
      console.log('✅ eBay Deepest Path:', path, 'ID:', best.category.categoryId);
    }
  } catch (e) {
    console.error('eBay Error:', e.message);
  }

  // 2. Poshmark
  const poshMatches = POSHMARK_TAXONOMY.filter(c => c.path.includes('T-Shirts') && c.path.startsWith('Men'));
  console.log('✅ Poshmark Sample:', poshMatches[0]?.path);

  // 3. Mercari
  const mercariMatches = MERCARI_TAXONOMY.filter(c => c.path && c.path.includes('T-Shirts') && c.path.startsWith('Men'));
  console.log('✅ Mercari Sample:', mercariMatches[0]?.path);
}

run();
