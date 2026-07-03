const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const sizeSets = data.size_sets || [];

const regions = {
  US: 77,
  UK: 5,
  EUR: 79,
  AU: 117
};

const result = {};

for (const [regionName, setId] of Object.entries(regions)) {
  const set = sizeSets.find(s => s.id === setId);
  if (!set) {
    console.error(`Could not find set ${setId} for ${regionName}`);
    continue;
  }
  
  const sizes = [...(set.sizes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  result[regionName] = sizes.map(s => {
    let rawName = s.name_i18n.en;
    let name = rawName;
    
    if (rawName.toLowerCase() === 'one size') {
      name = 'ONE SIZE';
    } else if (rawName.toLowerCase() === 'other') {
      name = 'Other';
    } else {
      // Add prefix if not already present
      if (!name.startsWith(regionName)) {
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

// Write the generated output to a temporary file so we can view/copy it easily
fs.writeFileSync(__dirname + '/generated_shoe_sizes.json', JSON.stringify(result, null, 2));
console.log('Saved generated sizes to generated_shoe_sizes.json');
