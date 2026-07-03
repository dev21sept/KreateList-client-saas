const fs = require('fs');
const path = require('path');

let depopBrandMap = null;

function getDepopBrandId(brandName) {
  if (!brandName) return '';
  
  const cleanName = brandName.trim().toLowerCase();
  
  // Lazily load depopBrands.json and build the map
  if (!depopBrandMap) {
    try {
      const brandsPath = path.join(__dirname, '..', 'depopBrands.json');
      if (fs.existsSync(brandsPath)) {
        const brandsData = JSON.parse(fs.readFileSync(brandsPath, 'utf8'));
        depopBrandMap = new Map();
        for (const brand of brandsData) {
          if (brand && brand.id && brand.name) {
            depopBrandMap.set(brand.name.toLowerCase(), brand.id);
            depopBrandMap.set(brand.id.toLowerCase(), brand.id);
          }
        }
      } else {
        console.warn(`depopBrands.json not found at: ${brandsPath}`);
      }
    } catch (err) {
      console.error('Failed to load depopBrands.json:', err.message);
    }
  }

  if (depopBrandMap && depopBrandMap.has(cleanName)) {
    return depopBrandMap.get(cleanName);
  }

  // Fallback slugification if not found in map
  return cleanName
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

console.log("Levi's ->", getDepopBrandId("Levi's"));
console.log("levi's ->", getDepopBrandId("levi's"));
console.log("levi-s ->", getDepopBrandId("levi-s"));
console.log("Unbranded ->", getDepopBrandId("Unbranded"));
console.log("Tommy Hilfiger ->", getDepopBrandId("Tommy Hilfiger"));
console.log("Unknown Brand ->", getDepopBrandId("Unknown Brand"));
