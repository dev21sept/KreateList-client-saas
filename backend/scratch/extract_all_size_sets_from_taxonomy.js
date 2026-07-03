const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const mappings = data.category_size_mapping || {};

console.log('Category size set mappings for menswear and womenswear:');
for (const [key, map] of Object.entries(mappings)) {
  if (map.department === 'menswear' || map.department === 'womenswear') {
    console.log(`\nCategory: ${map.department} > ${map.group} > ${map.product_type}`);
    console.log(`Legacy Category ID: ${map.legacy_category_id}`);
    console.log(`Size Sets By Region:`, map.size_set_by_region);
  }
}
