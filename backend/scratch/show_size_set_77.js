const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes_direct.json'), 'utf8'));

// Wait! In depop_attributes_direct.json, size_sets can be an array or an object.
// Let's find size set 77
let set77 = null;
if (Array.isArray(data.size_sets)) {
  set77 = data.size_sets.find(s => s.id === 77 || s.id === '77');
} else {
  set77 = data.size_sets['77'];
}

if (set77) {
  console.log('Size set 77 found!');
  console.log('Name:', set77.name);
  console.log('Sizes count:', set77.sizes ? set77.sizes.length : 0);
  const sizes = [...(set77.sizes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  for (const s of sizes) {
    console.log(`id: ${s.id.toString().padEnd(4)} | name: ${s.name_i18n.en.padEnd(10)} | position: ${s.position}`);
  }
} else {
  console.log('Size set 77 not found in parsed structure.');
  // Let's print the index of 77 inside size_sets if it's an array
  if (Array.isArray(data.size_sets)) {
    console.log('size_sets is an array of length:', data.size_sets.length);
    const ids = data.size_sets.map(s => s.id);
    console.log('IDs in size_sets array:', ids);
  }
}
