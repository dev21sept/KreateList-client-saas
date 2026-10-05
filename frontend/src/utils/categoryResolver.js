import { POSHMARK_TAXONOMY } from '../constants/poshmarkTaxonomy';
import { MERCARI_CATEGORY_TREE, MERCARI_FLAT_CATEGORIES } from '../constants/mercariTaxonomy';


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
const POSHMARK_GENERIC_SEGMENTS = new Set(['clothing', 'shoes', 'accessories', 'clothing shoes and accessories', 'other']);
const POSHMARK_GENDER_WORDS = new Set(['women', 'womens', 'men', 'mens', 'kids', 'girls', 'boys', 'unisex', 'female', 'male']);
const POSHMARK_STOP_WORDS = new Set(['and', 'the', 'for', 'of', 'with']);
// Common eBay leaf names whose Poshmark leaf is spelled differently (keys are singularKey() forms).
const POSHMARK_LEAF_SYNONYMS = {
  't shirt': 'tee short sleeve',
  'tshirt': 'tee short sleeve',
  'tee': 'tee short sleeve',
  'long sleeve t shirt': 'tee long sleeve',
  'sweatshirt': 'sweatshirt and hoodie',
  'hoodie': 'sweatshirt and hoodie'
};

const normalizePoshmarkText = (text = '') => String(text)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/['’]/g, ' ')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Plural-tolerant key: "Shoes" and "Shoe" compare equal.
const poshmarkSingularKey = (text = '') => normalizePoshmarkText(text)
  .split(' ')
  .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
  .join(' ');

const poshmarkGenderFromText = (text = '') => {
  const clean = normalizePoshmarkText(text);
  if (/\b(women|womens|women s|female|girls?)\b/.test(clean)) return 'Women';
  if (/\b(men|mens|men s|male|boys?)\b/.test(clean)) return 'Men';
  if (/\b(kids?|child|children|baby|toddler)\b/.test(clean)) return 'Kids';
  return null;
};

// Maps an eBay category path (or leaf name) to a Poshmark taxonomy entry.
// Mirrors backend/services/poshmarkCategoryMapper.js. Returns null when unsure,
// so the seller picks the category instead of getting an unrelated one.
export const mapEbayToPoshmark = ({ ebayPath = '', title = '', gender = null } = {}) => {
  const segments = String(ebayPath)
    .split('>')
    .map(s => s.trim())
    .filter(s => s && !POSHMARK_GENERIC_SEGMENTS.has(normalizePoshmarkText(s)));

  const leafText = segments.length ? segments[segments.length - 1] : '';
  const parentText = segments.length > 1 ? segments[segments.length - 2] : '';
  const targetGender = gender || poshmarkGenderFromText(ebayPath) || poshmarkGenderFromText(title);
  const rawLeafKey = poshmarkSingularKey(leafText);
  const leafKey = POSHMARK_LEAF_SYNONYMS[rawLeafKey] || rawLeafKey;
  if (!leafKey) return null;

  const inGender = entry => !targetGender || entry.path.split(' > ')[0] === targetGender;

  let candidates = POSHMARK_TAXONOMY.filter(entry =>
    poshmarkSingularKey(entry.path.split(' > ').pop()) === leafKey && inGender(entry)
  );

  if (candidates.length > 1 && parentText) {
    const parentKey = poshmarkSingularKey(parentText);
    const withParent = candidates.filter(entry =>
      entry.path.split(' > ').slice(1, -1).map(poshmarkSingularKey).some(part => part && parentKey.includes(part))
    );
    if (withParent.length) candidates = withParent;
  }

  if (candidates.length) return candidates[0];

  // Same words in a different order or with a leading gender word.
  const wordSet = key => [...new Set(key.split(' ').filter(w => w.length > 1 && !POSHMARK_STOP_WORDS.has(w) && !POSHMARK_GENDER_WORDS.has(w)))].sort().join(' ');
  const targetWords = wordSet(leafKey);
  if (!targetWords) return null;

  const matches = POSHMARK_TAXONOMY.filter(entry =>
    inGender(entry) && wordSet(poshmarkSingularKey(entry.path.split(' > ').pop())) === targetWords
  );
  return matches[0] || null;
};

export const resolvePoshmarkCategory = (rawCategory = '', title = '', brand = '', gender = 'Unisex') => {
  const cleanCat = String(rawCategory || '').trim();
  const ebayPath = cleanCat && cleanCat.toLowerCase() !== 'clothing' ? cleanCat : '';
  const knownGender = gender && gender !== 'Unisex' ? gender : null;
  const match = mapEbayToPoshmark({ ebayPath, title, gender: knownGender });

  if (!match) {
    // No confident match: empty path, so the form does not get a wrong default.
    return { path: '', category: '', categoryId: '', id: '', department: '' };
  }

  return {
    path: match.path,
    category: match.path,
    categoryId: match.categoryId,
    id: match.id,
    department: match.path.split(' > ')[0]
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

  // Not sure from the title: return no category so the user picks one.
  // Defaulting to Men's T-Shirts filed pants and other items as T-shirts.
  return { path: '', category: '', categoryId: '' };
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

/**
 * Cleans HTML tags (<br/>, <b>, <p>, etc.) and decodes HTML entities into clean readable multiline text.
 */
export const cleanHtmlDescription = (str) => {
  if (!str) return '';
  let clean = String(str);
  
  // Unescape HTML entities
  clean = clean
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Standardize line breaks
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/p>/gi, '\n\n');
  clean = clean.replace(/<\/div>/gi, '\n');
  clean = clean.replace(/<\/li>/gi, '\n');
  clean = clean.replace(/<li>/gi, '• ');

  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // Clean extra blank lines
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
};

