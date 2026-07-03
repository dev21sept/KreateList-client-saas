const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const sizeSets = data.size_sets || [];

// Define the groups of size sets we want to generate
const sizeSetsConfig = {
  DEPOP_KIDS_APPAREL_SIZES: { US: 100, UK: 99, EUR: 101, AU: 105 },
  DEPOP_KIDS_SHOE_SIZES: { US: 103, UK: 102, EUR: 104, AU: 106 },
  
  DEPOP_WOMENS_TOPS_SIZES: { US: 4, UK: 2, EUR: 9, AU: 107 },
  DEPOP_WOMENS_DRESSES_SIZES: { US: 84, UK: 86, EUR: 81, AU: 108 },
  DEPOP_WOMENS_BOTTOMS_SIZES: { US: 22, UK: 20, EUR: 24, AU: 109 },
  DEPOP_WOMENS_OUTERWEAR_SIZES: { US: 38, UK: 36, EUR: 40, AU: 111 },
  DEPOP_WOMENS_SHOE_SIZES: { US: 46, UK: 44, EUR: 48, AU: 112 },
  
  DEPOP_MENS_TOPS_SIZES: { US: 54, UK: 52, EUR: 56, AU: 113 },
  DEPOP_MENS_BOTTOMS_SIZES: { US: 60, UK: 58, EUR: 62, AU: 114 },
  DEPOP_MENS_OUTERWEAR_SIZES: { US: 95, UK: 93, EUR: 98, AU: 116 },
  DEPOP_MENS_SHOE_SIZES: { US: 77, UK: 5, EUR: 79, AU: 117 }
};

const output = {};

for (const [varName, regions] of Object.entries(sizeSetsConfig)) {
  output[varName] = {};
  for (const [regionName, setId] of Object.entries(regions)) {
    const set = sizeSets.find(s => s.id === setId);
    if (!set) {
      console.warn(`WARNING: Size set ${setId} not found for ${varName} (${regionName})`);
      output[varName][regionName] = [];
      continue;
    }
    
    const sizes = [...(set.sizes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
    output[varName][regionName] = sizes.map(s => {
      let rawName = s.name_i18n.en;
      let name = rawName;
      
      // Standardize names
      if (rawName.toLowerCase() === 'one size') {
        name = 'ONE SIZE';
      } else if (rawName.toLowerCase() === 'other') {
        name = 'Other';
      } else {
        // Add region prefix to shoe sizes if not already present
        const isShoe = varName.includes('SHOE');
        if (isShoe && !name.startsWith(regionName)) {
          name = `${regionName} ${name}`;
        }
      }
      
      return {
        id: s.id,
        name: name,
        size_set_id: setId,
        composite_id: `${setId}.${s.id}-${regionName}`
      };
    });
  }
}

// Generate the final javascript file content
let jsContent = '// Generated automatically from Depop live API attributes\n\n';

for (const [varName, value] of Object.entries(output)) {
  jsContent += `const ${varName} = ${JSON.stringify(value, null, 2)};\n\n`;
}

// Node export
const exportsList = Object.keys(output).join(', ');
jsContent += `module.exports = { ${exportsList} };\n`;

fs.writeFileSync(__dirname + '/generated_depopSizes.js', jsContent);
console.log('Successfully generated backend depopSizes.js style code to generated_depopSizes.js');

// Frontend style export
let frontendJsContent = '// Generated automatically from Depop live API attributes\n\n';
for (const [varName, value] of Object.entries(output)) {
  frontendJsContent += `export const ${varName} = ${JSON.stringify(value, null, 2)};\n\n`;
}
fs.writeFileSync(__dirname + '/generated_frontend_depopSizes.js', frontendJsContent);
console.log('Successfully generated frontend depopSizes.js style code.');
