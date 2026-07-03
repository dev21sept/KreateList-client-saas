const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

const sizeSets = data.size_sets || [];

const targetSets = [93, 95, 98, 116];

for (const setId of targetSets) {
  const set = sizeSets.find(s => s.id === setId);
  if (set) {
    console.log(`\n==================================================`);
    console.log(`Size Set ID: ${setId} | Name: ${set.name}`);
    console.log(`==================================================`);
    const sizes = [...(set.sizes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
    for (const size of sizes) {
      console.log(`  id: ${size.id.toString().padEnd(4)} | name: ${size.name_i18n.en.padEnd(10)} | position: ${size.position}`);
    }
  } else {
    console.log(`Size set ${setId} not found.`);
  }
}
