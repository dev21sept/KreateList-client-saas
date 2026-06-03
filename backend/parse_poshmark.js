const fs = require('fs');
const path = require('path');

try {
  const jsonPath = path.join(__dirname, 'poshmark_initializers.json');
  const outputPath = path.join(__dirname, 'constants', 'poshmarkTaxonomy.js');

  console.log('Reading Poshmark catalog from:', jsonPath);
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}. Please create this file and paste the Poshmark JSON data first.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(fileContent);

  // Safely traverse the catalog structure: Root -> Departments -> Categories -> Category Features (Subcategories)
  const departments = data.catalog?.departments || [];
  let paths = [];

  for (const dept of departments) {
    const deptName = dept.display; // e.g., "Women"
    const categories = dept.categories || [];
    
    for (const cat of categories) {
      const catName = cat.display; // e.g., "Bags"
      const subcats = cat.category_features || [];
      
      if (subcats.length > 0) {
        for (const sub of subcats) {
          const subName = sub.display; // e.g., "Backpacks"
          paths.push(`${deptName} > ${catName} > ${subName}`);
        }
      } else {
        // Fallback if there are no subcategories
        paths.push(`${deptName} > ${catName}`);
      }
    }
  }

  console.log(`Total Poshmark category paths found: ${paths.length}`);

  // Format and write the file
  const outputContent = `const POSHMARK_TAXONOMY = [\n${paths.map(p => `  ${JSON.stringify(p)}`).join(',\n')}\n];\n\nmodule.exports = { POSHMARK_TAXONOMY };\n`;
  
  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log('Successfully generated and updated:', outputPath);
} catch (error) {
  console.error('Error parsing Poshmark categories:', error);
}
