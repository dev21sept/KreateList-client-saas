const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

console.log('Scanning category_size_mapping...');
if (data.category_size_mapping) {
  const entries = Object.entries(data.category_size_mapping);
  for (const [key, mapping] of entries) {
    if (mapping.department === 'menswear' && mapping.group === 'footwear') {
      console.log(`\nEntry ID: ${key}`);
      console.log(JSON.stringify(mapping, null, 2));
    }
  }
}
