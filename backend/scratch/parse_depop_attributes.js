const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

// Print category mapping
console.log('Category mapping keys:', Object.keys(data.category_size_mapping || {}));

// Let's search for Category 'footwear' or 'trainers' in category_size_mapping
console.log('\nScanning category_size_mapping...');
if (data.category_size_mapping) {
  for (const [catKey, mapping] of Object.entries(data.category_size_mapping)) {
    if (catKey.toLowerCase().includes('footwear') || catKey.toLowerCase().includes('trainers') || catKey.toLowerCase().includes('shoe')) {
      console.log(`\nCategory Key: ${catKey}`);
      console.log(JSON.stringify(mapping, null, 2));
    }
  }
}

// Let's print sizes for size set 10 or other sets that might be Men's Footwear
// Wait, let's find which size sets are mapped for menswear department and footwear category
if (data.department_to_size_mapping) {
  console.log('\nScanning department_to_size_mapping...');
  for (const [dept, mappings] of Object.entries(data.department_to_size_mapping)) {
    if (dept.toLowerCase().includes('men')) {
      console.log(`Department: ${dept}`);
      console.log(JSON.stringify(mappings, null, 2));
    }
  }
}
