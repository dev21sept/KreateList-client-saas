const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const sizeSets = data.size_sets || [];

// We want to generate US, UK, EUR, AU lists
const regions = {
  US: 77,
  UK: 5,  // Depop uses GB in mapping, but we use UK in frontend
  EUR: 79, // Depop uses IT in mapping, but we use EUR in frontend
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
    // Determine the name
    let name = s.name_i18n.en;
    // Prefix if necessary
    if (regionName === 'US' && !name.startsWith('US')) {
      name = `US ${name}`;
    } else if (regionName === 'UK' && !name.startsWith('UK')) {
      name = `UK ${name}`;
    } else if (regionName === 'EUR' && !name.startsWith('EUR')) {
      name = `EUR ${name}`;
    } else if (regionName === 'AU' && !name.startsWith('AU')) {
      name = `AU ${name}`;
    }
    
    // Convert One size to ONE SIZE/OS
    if (name.toLowerCase() === 'one size') {
      name = 'ONE SIZE';
    }
    
    return {
      id: s.id,
      name: name,
      size_set_id: setId,
      composite_id: `${setId}.${s.id}-${regionName}`
    };
  });
}

console.log('const DEPOP_MENS_SHOE_SIZES = ' + JSON.stringify(result, null, 2) + ';');
