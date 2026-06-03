const fs = require('fs');
const path = require('path');

try {
  const jsonPath = path.join(__dirname, 'vinted_initializers.json');
  const outputPath = path.join(__dirname, 'constants', 'vintedTaxonomy.js');

  console.log('Reading from:', jsonPath);
  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(fileContent);

  function getLeafPaths(catalogs, currentPath = []) {
    let paths = [];
    for (const cat of catalogs) {
      const newPath = [...currentPath, cat.title];
      if (cat.catalogs && cat.catalogs.length > 0) {
        paths = paths.concat(getLeafPaths(cat.catalogs, newPath));
      } else {
        paths.push(newPath.join(' > '));
      }
    }
    return paths;
  }

  const leafPaths = getLeafPaths(data.catalogs);
  console.log(`Total Vinted categories found: ${leafPaths.length}`);

  const outputContent = `const VINTED_TAXONOMY = [\n${leafPaths.map(p => `  ${JSON.stringify(p)}`).join(',\n')}\n];\n\nmodule.exports = { VINTED_TAXONOMY };\n`;
  
  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log('Successfully updated:', outputPath);
} catch (error) {
  console.error('Error parsing Vinted categories:', error);
}
