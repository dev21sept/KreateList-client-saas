import { POSHMARK_TAXONOMY } from '../constants/poshmarkTaxonomy';
import mercariTaxonomy from '../../../backend/constants/mercariCategoryTaxonomy.json';

const { MERCARI_CATEGORY_TREE } = mercariTaxonomy;

export const flattenMercariCategories = (nodes, path = '') => {
  let list = [];
  for (const node of (nodes || [])) {
    const currentPath = path ? `${path} > ${node.name}` : node.name;
    if (node.children && node.children.length > 0) {
      list = list.concat(flattenMercariCategories(node.children, currentPath));
    } else {
      list.push({
        id: String(node.id),
        name: node.name,
        path: currentPath,
        itemSizeGroupId: node.itemSizeGroupId || 0
      });
    }
  }
  return list;
};

export const ALL_MERCARI_LEAF_CATEGORIES = flattenMercariCategories(MERCARI_CATEGORY_TREE);

/**
 * Resolves a full 3-level Mercari category path.
 * NEVER returns a single word like 'Clothing' or 'Blouse'.
 */
export const resolveMercariCategory = (rawCategory = '', title = '', brand = '', gender = 'Unisex') => {
  const cleanCat = String(rawCategory || '').trim();
  
  if (cleanCat && cleanCat.includes(' > ') && cleanCat.toLowerCase() !== 'clothing') {
    const direct = ALL_MERCARI_LEAF_CATEGORIES.find(c => c.path.toLowerCase() === cleanCat.toLowerCase());
    if (direct) return { category: direct.path, categoryId: direct.id, itemSizeGroupId: direct.itemSizeGroupId };
  }

  const combinedText = `${cleanCat} ${title} ${brand}`.toLowerCase();
  const tokens = combinedText.split(/[\s,>]+/).filter(t => t.length > 2 && t !== 'and' && t !== 'the' && t !== 'clothing' && t !== 'apparel');

  let bestMatch = null;
  let highestScore = 0;

  const isMen = /\bmen\b|\bmens\b|\bmale\b|\barmy\b|\bmilitary\b|\btactical\b/.test(combinedText) || gender.toLowerCase() === 'men';
  const isWomen = (/\bwomen\b|\bwomens\b|\bfemale\b|\blady\b|\bladies\b/.test(combinedText) || gender.toLowerCase() === 'women') && !isMen;
  const isKids = /\bkids\b|\bboy\b|\bgirl\b|\btoddler\b|\bbaby\b/.test(combinedText);

  for (const item of ALL_MERCARI_LEAF_CATEGORIES) {
    const itemPathLower = item.path.toLowerCase();
    let score = 0;

    if (isMen && item.path.startsWith('Men')) score += 15;
    else if (isWomen && item.path.startsWith('Women')) score += 15;
    else if (isKids && item.path.startsWith('Kids')) score += 15;

    for (const token of tokens) {
      if (itemPathLower.includes(token)) {
        score += token.length;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore >= 10) {
    return { category: bestMatch.path, categoryId: bestMatch.id, itemSizeGroupId: bestMatch.itemSizeGroupId };
  }

  const fallbackPath = isMen ? 'Men > Athletic apparel > Athletic T-Shirts' : 'Women > Tops & blouses > Blouse';
  const fallback = ALL_MERCARI_LEAF_CATEGORIES.find(c => c.path === fallbackPath) || ALL_MERCARI_LEAF_CATEGORIES[0];
  return { 
    category: fallback ? fallback.path : 'Men > Athletic apparel > Athletic T-Shirts', 
    categoryId: fallback ? fallback.id : '1972', 
    itemSizeGroupId: fallback ? fallback.itemSizeGroupId : 1 
  };
};

/**
 * Resolves a full 3-level Poshmark category path.
 * NEVER returns a single word like 'Clothing'.
 */
export const resolvePoshmarkCategory = (rawCategory = '', title = '', brand = '', gender = 'Unisex') => {
  const cleanCat = String(rawCategory || '').trim();

  if (cleanCat && cleanCat.includes(' > ') && cleanCat.toLowerCase() !== 'clothing') {
    const direct = POSHMARK_TAXONOMY.find(c => c.path.toLowerCase() === cleanCat.toLowerCase());
    if (direct) {
      return {
        path: direct.path,
        category: direct.path,
        categoryId: direct.categoryId,
        id: direct.id,
        department: direct.path.split(' > ')[0]
      };
    }
  }

  const combinedText = `${cleanCat} ${title} ${brand}`.toLowerCase();
  const isMen = /\bmen\b|\bmens\b|\bmale\b|\barmy\b|\bmilitary\b|\btactical\b/.test(combinedText) || gender.toLowerCase() === 'men';
  const isWomen = (/\bwomen\b|\bwomens\b|\bfemale\b|\blady\b|\bladies\b/.test(combinedText) || gender.toLowerCase() === 'women') && !isMen;
  const isKids = /\bkids\b|\bboy\b|\bgirl\b|\btoddler\b|\bbaby\b/.test(combinedText);

  const tokens = combinedText.split(/[\s,>]+/).filter(t => t.length > 2 && t !== 'and' && t !== 'the' && t !== 'clothing' && t !== 'apparel');

  let bestMatch = null;
  let highestScore = 0;

  for (const item of POSHMARK_TAXONOMY) {
    const itemPathLower = item.path.toLowerCase();
    let score = 0;

    if (isMen && item.path.startsWith('Men')) score += 20;
    else if (isWomen && item.path.startsWith('Women')) score += 20;
    else if (isKids && item.path.startsWith('Kids')) score += 20;

    for (const token of tokens) {
      if (itemPathLower.includes(token)) {
        score += token.length * 2;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore >= 10) {
    return {
      path: bestMatch.path,
      category: bestMatch.path,
      categoryId: bestMatch.categoryId,
      id: bestMatch.id,
      department: bestMatch.path.split(' > ')[0]
    };
  }

  const defaultPath = isMen ? 'Men > Shirts > Tees - Short Sleeve' : 'Women > Tops > T-Shirts';
  const def = POSHMARK_TAXONOMY.find(c => c.path === defaultPath) || POSHMARK_TAXONOMY[0];
  return {
    path: def.path,
    category: def.path,
    categoryId: def.categoryId,
    id: def.id,
    department: def.path.split(' > ')[0]
  };
};

/**
 * Resolves eBay category hierarchy.
 * If raw is 'Clothing' or lacks hierarchy, resolves to full 5-level leaf path.
 */
export const resolveEbayCategoryFallback = (rawCategory = '', title = '', brand = '', gender = 'Unisex') => {
  const cleanCat = String(rawCategory || '').trim();

  if (cleanCat && cleanCat.includes(' > ') && cleanCat.toLowerCase() !== 'clothing') {
    return {
      path: cleanCat,
      category: cleanCat,
      categoryId: ''
    };
  }

  const combinedText = `${cleanCat} ${title} ${brand}`.toLowerCase();
  const isMen = /\bmen\b|\bmens\b|\bmale\b|\barmy\b|\bmilitary\b|\btactical\b/.test(combinedText) || gender.toLowerCase() === 'men';
  const isWomen = (/\bwomen\b|\bwomens\b|\bfemale\b|\blady\b|\bladies\b/.test(combinedText) || gender.toLowerCase() === 'women') && !isMen;

  if (combinedText.includes('jacket') || combinedText.includes('coat') || combinedText.includes('parka')) {
    if (isWomen) {
      return {
        path: "Clothing, Shoes & Accessories > Women > Women's Clothing > Coats, Jackets & Vests",
        category: "Clothing, Shoes & Accessories > Women > Women's Clothing > Coats, Jackets & Vests",
        categoryId: '63862'
      };
    }
    return {
      path: "Clothing, Shoes & Accessories > Men > Men's Clothing > Coats, Jackets & Vests",
      category: "Clothing, Shoes & Accessories > Men > Men's Clothing > Coats, Jackets & Vests",
      categoryId: '57988'
    };
  }

  if (combinedText.includes('shoe') || combinedText.includes('sneaker') || combinedText.includes('boot')) {
    if (isWomen) {
      return {
        path: "Clothing, Shoes & Accessories > Women > Women's Shoes > Athletic Shoes",
        category: "Clothing, Shoes & Accessories > Women > Women's Shoes > Athletic Shoes",
        categoryId: '95672'
      };
    }
    return {
      path: "Clothing, Shoes & Accessories > Men > Men's Shoes > Athletic Shoes",
      category: "Clothing, Shoes & Accessories > Men > Men's Shoes > Athletic Shoes",
      categoryId: '15709'
    };
  }

  if (isWomen) {
    return {
      path: "Clothing, Shoes & Accessories > Women > Women's Clothing > Tops & Blouses",
      category: "Clothing, Shoes & Accessories > Women > Women's Clothing > Tops & Blouses",
      categoryId: '53159'
    };
  }

  return {
    path: "Clothing, Shoes & Accessories > Men > Men's Clothing > Shirts > T-Shirts",
    category: "Clothing, Shoes & Accessories > Men > Men's Clothing > Shirts > T-Shirts",
    categoryId: '57990'
  };
};

/**
 * Resolves Etsy category hierarchy.
 */
export const resolveEtsyCategoryFallback = (rawCategory = '', title = '', brand = '') => {
  const cleanCat = String(rawCategory || '').trim();
  if (cleanCat && cleanCat.includes(' > ') && cleanCat.toLowerCase() !== 'clothing') {
    return cleanCat;
  }
  const combined = `${cleanCat} ${title} ${brand}`.toLowerCase();
  if (combined.includes('women')) {
    return "Clothing > Women's Clothing > Tops & Tees > T-shirts";
  }
  return "Clothing > Men's Clothing > Shirts & Tops > T-shirts";
};
