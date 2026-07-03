const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

const targetSets = ['77', '5', '79', '117'];

for (const setId of targetSets) {
  const set = data.size_sets[setId];
  if (set) {
    console.log(`\n--- SIZE SET ${setId} (${set.name_i18n ? set.name_i18n.en : ''}) ---`);
    console.log(JSON.stringify(set.sizes, null, 2));
  } else {
    console.log(`Size set ${setId} not found.`);
  }
}
