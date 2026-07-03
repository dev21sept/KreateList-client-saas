const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

console.log('Is 77 in size_sets?', !!data.size_sets['77']);
console.log('Keys of size_sets containing 77:', Object.keys(data.size_sets).filter(k => k.includes('77')));

// Let's search inside data.size_sets for any set with name "mens-shoe-sizes" or similar
for (const [id, set] of Object.entries(data.size_sets)) {
  if (set.name && set.name.toLowerCase().includes('shoe')) {
    console.log(`ID: ${id}, Name: ${set.name}`);
  }
}
