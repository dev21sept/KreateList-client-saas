const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

const targetSets = ['10', '22', '26', '49'];

for (const setId of targetSets) {
  const set = data.size_sets[setId];
  if (set) {
    console.log(`\n==================================================`);
    console.log(`Size Set ID: ${setId} | Name: ${set.name}`);
    console.log(`==================================================`);
    
    // Sort sizes by position if possible
    const sizes = [...set.sizes].sort((a, b) => (a.position || 0) - (b.position || 0));
    
    for (const size of sizes) {
      console.log(`  id: ${size.id.toString().padEnd(4)} | name: ${size.name_i18n.en.padEnd(10)} | position: ${size.position}`);
    }
  }
}
