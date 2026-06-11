const fs = require('fs');
const path = require('path');

const categoriesPath = path.join(__dirname, '..', 'depopCategories.json');
const taxonomyPath = path.join(__dirname, '..', 'constants', 'depopTaxonomy.js');

if (!fs.existsSync(categoriesPath)) {
  console.error(`Error: depopCategories.json does not exist at: ${categoriesPath}`);
  process.exit(1);
}

if (!fs.existsSync(taxonomyPath)) {
  console.error(`Error: depopTaxonomy.js does not exist at: ${taxonomyPath}`);
  process.exit(1);
}

// 1. Read and parse depopCategories.json
const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
console.log(`Loaded ${categoriesData.length} category mapping definitions from JSON.`);

// 2. Read depopTaxonomy.js
let taxonomyContent = fs.readFileSync(taxonomyPath, 'utf8');

// We will parse the content dynamically or match and rebuild the file content.
// Since depopTaxonomy.js is a Javascript file, let's load it as a module to get the array.
// But to write it back, we want to construct a clean JS file format.
const { DEPOP_TAXONOMY_BASE, DEPOP_CATEGORY_MAPPING } = require(taxonomyPath);
console.log(`Loaded ${DEPOP_TAXONOMY_BASE.length} base taxonomy items from JS file.`);

// Create a mapping map for faster lookups: key = departmentId + ':' + categoryId + ':' + id
const mappingMap = new Map();
categoriesData.forEach(item => {
  const key = `${item.department}:${item.group}:${item.product_type}`;
  mappingMap.set(key, item);
});

// 3. Update DEPOP_TAXONOMY_BASE
const updatedBase = DEPOP_TAXONOMY_BASE.map(cat => {
  const key = `${cat.departmentId}:${cat.categoryId}:${cat.id}`;
  const match = mappingMap.get(key);
  
  if (match) {
    const updated = { ...cat };
    if (match.legacy_category_id !== undefined) {
      updated.legacyCategoryId = match.legacy_category_id;
    }
    if (match.size_set_by_region !== undefined) {
      updated.sizeSetByRegion = match.size_set_by_region;
    }
    return updated;
  }
  return cat;
});

// Let's count how many items matched
const matchedCount = updatedBase.filter(cat => cat.legacyCategoryId !== undefined).length;
console.log(`Matched and updated ${matchedCount} out of ${DEPOP_TAXONOMY_BASE.length} taxonomy items.`);

// 4. Format and rewrite depopTaxonomy.js
// We'll reconstruct the file code to preserve clarity.
const newContent = `const DEPOP_TAXONOMY_BASE = ${JSON.stringify(updatedBase, null, 2)};

const DEPOP_CATEGORY_MAPPING = ${JSON.stringify(DEPOP_CATEGORY_MAPPING, null, 2)};

const DEPOP_TAXONOMY = DEPOP_TAXONOMY_BASE.map(cat => ({
  ...cat,
  attribute_ids: DEPOP_CATEGORY_MAPPING[cat.id] || []
}));

module.exports = { DEPOP_TAXONOMY, DEPOP_CATEGORY_MAPPING };
`;

fs.writeFileSync(taxonomyPath, newContent, 'utf8');
console.log(`Successfully updated and saved depopTaxonomy.js with new mappings!`);
