const { POSHMARK_TAXONOMY } = require('../constants/poshmarkTaxonomy');
const { DEPOP_TAXONOMY } = require('../constants/depopTaxonomy');
const Listing = require('../models/Listing');
const ebayService = require('../services/ebayService');

function detectGender(text = '') {
  const clean = text.toLowerCase();
  if (clean.includes('women') || clean.includes('female') || clean.includes('womens') || clean.includes('girl')) {
    return 'Women';
  }
  if (clean.includes('men') || clean.includes('male') || clean.includes('mens') || clean.includes('boy')) {
    return 'Men';
  }
  if (clean.includes('kids') || clean.includes('child') || clean.includes('baby')) {
    return 'Kids';
  }
  return 'Unisex';
}

function normalizePoshmarkCategory(rawCategory = '', itemGender = 'Unisex') {
  let cleanAi = String(rawCategory).toLowerCase().trim();
  if (!cleanAi) return "Women > Tops > Other";

  if (cleanAi.startsWith('unisex')) {
    if (itemGender.toLowerCase() === 'men' || itemGender.toLowerCase() === 'male') {
      cleanAi = cleanAi.replace('unisex', 'men');
    } else {
      cleanAi = cleanAi.replace('unisex', 'women');
    }
  }

  let directMatch = POSHMARK_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
  if (directMatch) return directMatch.path;

  const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
  let bestMatch = "Women > Tops > Other";
  let maxOverlap = 0;

  for (const cat of POSHMARK_TAXONOMY) {
    const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let overlap = 0;
    
    for (const token of aiTokens) {
      if (catTokens.includes(token)) {
        if (catTokens[0] === token) {
          overlap += 10;
        } else {
          overlap += 1;
        }
      }
    }

    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = cat.path;
    }
  }

  return bestMatch;
}

function normalizeDepopCategory(rawCategory = '', itemGender = 'Unisex') {
  let cleanAi = String(rawCategory).toLowerCase().trim();
  const defaultMatch = DEPOP_TAXONOMY.find(cat => cat.path === "Women > Tops > T-shirts") || DEPOP_TAXONOMY[0];
  if (!cleanAi) return defaultMatch;

  const isMenswear = ['men', 'male', 'menswear'].includes(itemGender.toLowerCase());
  const isWomenswear = ['women', 'female', 'womenswear'].includes(itemGender.toLowerCase());

  if (cleanAi.startsWith('unisex') || cleanAi.startsWith('women') || cleanAi.startsWith('men') || cleanAi.startsWith('womenswear') || cleanAi.startsWith('menswear')) {
    if (isMenswear) {
      cleanAi = cleanAi.replace('unisex', 'men').replace('womenswear', 'men').replace('women', 'men').replace('menswear', 'men');
    } else if (isWomenswear) {
      cleanAi = cleanAi.replace('unisex', 'women').replace('menswear', 'women').replace('men', 'women').replace('womenswear', 'women');
    } else {
      if (cleanAi.startsWith('unisex')) {
        cleanAi = cleanAi.replace('unisex', 'women');
      }
    }
  }

  let directMatch = DEPOP_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
  if (directMatch) return directMatch;

  const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
  let bestMatch = defaultMatch;
  let maxOverlap = 0;

  for (const cat of DEPOP_TAXONOMY) {
    const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let overlap = 0;
    
    for (const token of aiTokens) {
      if (catTokens.includes(token)) {
        if (catTokens[0] === token) {
          overlap += 10;
        } else {
          overlap += 1;
        }
      }
    }

    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = cat;
    }
  }

  return bestMatch;
}

function normalizeVintedCategory(rawCategory = '', itemGender = 'Unisex') {
  let cleanAi = String(rawCategory).toLowerCase().trim();
  const defaultCategory = "Women > Clothing > Tops & t-shirts > T-shirts";
  if (!cleanAi) return defaultCategory;

  let directMatch = VINTED_TAXONOMY.find(cat => cat.path.toLowerCase() === cleanAi);
  if (directMatch) return directMatch.path;

  const aiParts = cleanAi.split('>').map(p => p.trim());
  let bestMatch = defaultCategory;
  let maxMatchLength = 0;
  let minPathDifference = 999;

  for (const cat of VINTED_TAXONOMY) {
    const catParts = cat.path.toLowerCase().split('>').map(p => p.trim());
    
    let matchLength = 0;
    const maxPossible = Math.min(aiParts.length, catParts.length);
    for (let i = 0; i < maxPossible; i++) {
      if (aiParts[i] === catParts[i]) {
        matchLength++;
      } else {
        break;
      }
    }

    const pathDiff = Math.abs(catParts.length - aiParts.length);

    if (matchLength > maxMatchLength) {
      maxMatchLength = matchLength;
      minPathDifference = pathDiff;
      bestMatch = cat.path;
    } else if (matchLength === maxMatchLength && matchLength > 0) {
      if (pathDiff < minPathDifference) {
        minPathDifference = pathDiff;
        bestMatch = cat.path;
      }
    }
  }

  if (maxMatchLength === 0) {
    const aiTokens = cleanAi.replace(/>/g, ' ').split(/\s+/).filter(Boolean);
    let maxOverlap = 0;
    
    for (const cat of VINTED_TAXONOMY) {
      const catTokens = cat.path.toLowerCase().replace(/>/g, ' ').split(/\s+/).filter(Boolean);
      let overlap = 0;
      
      for (const token of aiTokens) {
        if (catTokens.includes(token)) {
          if (catTokens[0] === token) {
            overlap += 10;
          } else {
            overlap += 1;
          }
        }
      }
      
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = cat.path;
      }
    }
  }

  return bestMatch;
}

function htmlToPlainText(html = '') {
  if (!html) return '';
  
  let text = html;
  
  // Replace line breaks and blocks with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  
  // Replace list items with bullets
  text = text.replace(/<li[^>]*>/gi, '• ');
  
  // Strip all other HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&#39;/gi, "'");
             
  // Normalize whitespace: reduce multiple consecutive spaces/newlines
  text = text.replace(/[ \t]+/g, ' '); // collapse spaces
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n'); // collapse 3+ newlines to 2
  
  return text.trim();
}

exports.prepareCrossList = async (req, res) => {
  try {
    const { platform } = req.query;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'Platform query parameter is required.' });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    const gender = detectGender(listing.category || listing.title);

    let mappedCategory = '';
    let mappedCategoryId = '';
    let mappedDepartmentId = '';
    let mappedConditionId = '';
    let mappedConditionLabel = '';

    // Plain text description formatting using htmlToPlainText
    const plainDesc = htmlToPlainText(listing.description);

    if (platform === 'poshmark') {
      mappedCategory = normalizePoshmarkCategory(listing.category || listing.title, gender);
      const matchedTax = POSHMARK_TAXONOMY.find(c => c.path.toLowerCase() === mappedCategory.toLowerCase()) || {};
      mappedCategoryId = matchedTax.categoryId || '';
      mappedDepartmentId = matchedTax.departmentId || '';

      const cond = String(listing.selectedCondition || '').toLowerCase();
      if (cond.includes('new') || cond.includes('tag')) {
        mappedConditionId = 'nwt';
        mappedConditionLabel = 'NWT (New With Tags)';
      } else if (cond.includes('like') || cond.includes('excellent')) {
        mappedConditionId = 'like_new';
        mappedConditionLabel = 'Like New';
      } else if (cond.includes('good')) {
        mappedConditionId = 'good';
        mappedConditionLabel = 'Good';
      } else {
        mappedConditionId = 'fair';
        mappedConditionLabel = 'Fair';
      }

    } else if (platform === 'depop') {
      const depopCatObj = normalizeDepopCategory(listing.category || listing.title, gender);
      mappedCategory = depopCatObj.path || 'Women > Tops > T-shirts';
      mappedCategoryId = depopCatObj.id || '';

      const cond = String(listing.selectedCondition || '').toLowerCase();
      if (cond.includes('brand') || (cond.includes('new') && !cond.includes('without'))) {
        mappedConditionId = 'brand_new';
        mappedConditionLabel = 'Brand New';
      } else if (cond.includes('without') || cond.includes('like')) {
        mappedConditionId = 'used_like_new';
        mappedConditionLabel = 'Like New';
      } else if (cond.includes('excellent')) {
        mappedConditionId = 'used_excellent';
        mappedConditionLabel = 'Excellent';
      } else if (cond.includes('good')) {
        mappedConditionId = 'used_good';
        mappedConditionLabel = 'Good';
      } else {
        mappedConditionId = 'used_fair';
        mappedConditionLabel = 'Fair';
      }

    } else if (platform === 'etsy') {
      mappedCategory = 'Clothing';
      mappedCategoryId = '1091'; // Default Clothing Taxonomy ID

      const cond = String(listing.selectedCondition || '').toLowerCase();
      if (cond.includes('new')) {
        mappedConditionId = 'new';
        mappedConditionLabel = 'New';
      } else {
        mappedConditionId = 'used';
        mappedConditionLabel = 'Used';
      }

    } else if (platform === 'ebay') {
      mappedCategory = listing.category || '';
      mappedCategoryId = listing.categoryId || '';
      
      const cond = String(listing.selectedCondition || '').toLowerCase();
      if (cond.includes('new')) {
        mappedConditionId = '1000';
        mappedConditionLabel = 'New';
      } else if (cond.includes('like') || cond.includes('excellent')) {
        mappedConditionId = '3000'; // Pre-owned fallback
        mappedConditionLabel = 'Pre-owned';
      } else {
        mappedConditionId = '3000';
        mappedConditionLabel = 'Pre-owned';
      }

      // Try eBay category suggestions via API if category is empty
      if (!mappedCategoryId && listing.title) {
        try {
          const appToken = await ebayService.getAppToken();
          const suggestions = await ebayService.getCategorySuggestions(appToken, listing.title);
          if (suggestions && suggestions.length > 0) {
            const bestSuggest = suggestions[0];
            mappedCategoryId = bestSuggest.category.categoryId;
            let ancestors = bestSuggest.categoryTreeNodeAncestors || [];
            ancestors.sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
            mappedCategory = ancestors.map(a => a.categoryName).concat(bestSuggest.category.categoryName).join(' > ');
          }
        } catch (e) {
          console.error("eBay suggestions error in cross-list-prep:", e.message);
        }
      }
    }

    // Resolve Brand, Size, Color with fallbacks from itemSpecifics
    let brand = listing.brand || '';
    let size = listing.size || '';
    let color = listing.color || '';

    if (listing.itemSpecifics) {
      // listing.itemSpecifics in Mongoose might be a Map, convert if necessary
      const specs = listing.itemSpecifics instanceof Map ? Object.fromEntries(listing.itemSpecifics) : listing.itemSpecifics;
      
      const findSpecVal = (containsTerms, excludeTerms = []) => {
        // Try exact matches first
        for (const k of Object.keys(specs)) {
          const lowerK = k.toLowerCase();
          if (containsTerms.some(term => lowerK === term)) {
            const val = specs[k];
            const cleanVal = Array.isArray(val) ? val[0] : val;
            if (cleanVal) return cleanVal;
          }
        }
        // Try substring matches next
        for (const k of Object.keys(specs)) {
          const lowerK = k.toLowerCase();
          if (containsTerms.some(term => lowerK.includes(term))) {
            if (excludeTerms.some(ex => lowerK.includes(ex))) continue;
            const val = specs[k];
            const cleanVal = Array.isArray(val) ? val[0] : val;
            if (cleanVal) return cleanVal;
          }
        }
        return '';
      };

      if (!brand) brand = findSpecVal(['brand', 'manufacturer', 'designer']);
      if (!size) size = findSpecVal(['size'], ['system', 'type', 'row', 'scale', 'aspect']);
      if (!color) color = findSpecVal(['color', 'colour', 'shade']);
    }

    // Title fallbacks if still empty
    const title = listing.title || '';
    if (!size && title) {
      const sizeMatch = title.match(/\b(?:size|sz)\b:?\s*([a-zA-Z0-9\.\/]+)/i);
      if (sizeMatch) {
        size = sizeMatch[1];
        console.log(`[Crosslist Prep] Extracted size "${size}" from title: "${title}"`);
      }
    }
    if (!brand && title) {
      const commonBrands = ['nike', 'adidas', 'jordan', 'gucci', 'zara', 'puma', 'reebok', 'chanel', 'under armour', 'supreme', 'lv', 'louis vuitton', 'prada', 'ugg', 'vans', 'converse'];
      const titleLower = title.toLowerCase();
      const matchedBrand = commonBrands.find(b => titleLower.startsWith(b) || titleLower.includes(' ' + b + ' '));
      if (matchedBrand) {
        brand = matchedBrand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      } else {
        const firstWord = title.trim().split(/\s+/)[0];
        if (firstWord && firstWord.length > 2) {
          brand = firstWord;
        }
      }
    }

    const responseData = {
      title: listing.title || '',
      description: platform === 'ebay' ? (listing.description || '') : plainDesc,
      price: listing.price || '',
      originalPrice: listing.originalPrice || '',
      brand: brand || '',
      size: size || '',
      color: color || '',
      sku: listing.sku || '',
      category: mappedCategory,
      categoryId: mappedCategoryId,
      departmentId: mappedDepartmentId,
      conditionId: mappedConditionId,
      selectedCondition: mappedConditionLabel,
      images: listing.images || [],
      thumbnail: listing.thumbnail || '',
      quantity: String(listing.quantity || '1'),
      material: listing.material || '',
      age: listing.age || '',
      source: listing.source || '',
      bodyFit: listing.bodyFit || '',
      occasion: listing.occasion || '',
      depopType: listing.depopType || '',
      fastening: listing.fastening || '',
      fit: listing.fit || '',
      packageWeight: listing.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: listing.packageDimensions || { length: 0, width: 0, height: 0 },
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (err) {
    console.error('Error preparing cross-listing data:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
