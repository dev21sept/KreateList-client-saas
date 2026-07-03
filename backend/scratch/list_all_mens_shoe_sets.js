const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const sizeSets = data.size_sets || [];
console.log('Total size sets in array:', sizeSets.length);

for (const set of sizeSets) {
  if (set.name === 'mens-shoe-sizes') {
    console.log(`\nID: ${set.id} | Name: ${set.name} | Label: ${set.label_i18n ? set.label_i18n.en : ''}`);
    const sizes = [...(set.sizes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
    console.log(`Sizes count: ${sizes.length}`);
    console.log('Sample sizes:', sizes.slice(0, 5).map(s => `${s.id}: ${s.name_i18n.en}`));
  }
}
