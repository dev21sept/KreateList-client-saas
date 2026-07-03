const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

console.log('Scanning category_size_mapping for men\'s coats...');
if (data.category_size_mapping) {
  const entries = Object.entries(data.category_size_mapping);
  for (const [key, mapping] of entries) {
    if (mapping.department === 'menswear' && (mapping.group === 'coats-jackets' || mapping.group === 'outerwear' || mapping.product_type === 'coats' || mapping.product_type === 'jackets')) {
      console.log(`\nEntry ID: ${key}`);
      console.log(JSON.stringify(mapping, null, 2));
    }
  }
}
