const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

// Category size mapping is keyed by category ID
// Let's print some entries of category_size_mapping
console.log('category_size_mapping entries:');
const entries = Object.entries(data.category_size_mapping || {});
for (let i = 0; i < Math.min(10, entries.length); i++) {
  console.log(`Key: ${entries[i][0]}, Value:`, entries[i][1]);
}

// Let's search for size sets mapped to Men's Shoes or trainers
// Category ID for trainers is "trainers" (Wait! Or is it a numerical ID?)
// Let's check depopTaxonomy.js for trainers ID.
// In depopTaxonomy.js:
// { id: "trainers", path: "Men > Footwear > Trainers", categoryId: "footwear", departmentId: "menswear" }
// Wait, is "trainers" the ID? Yes.
// Let's check what category_size_mapping has for "trainers" or "footwear".
console.log('\nChecking "trainers" in mapping:', data.category_size_mapping && data.category_size_mapping['trainers']);
console.log('Checking "footwear" in mapping:', data.category_size_mapping && data.category_size_mapping['footwear']);

// Let's search for keys containing "trainers" or "footwear" in category_size_mapping
const foundKeys = Object.keys(data.category_size_mapping || {}).filter(k => k.includes('trainer') || k.includes('footwear'));
console.log('\nFound keys in category_size_mapping:', foundKeys);

// Let's print department_to_size_mapping
console.log('\ndepartment_to_size_mapping keys:', Object.keys(data.department_to_size_mapping || {}));
const deptEntries = Object.entries(data.department_to_size_mapping || {});
for (let i = 0; i < Math.min(5, deptEntries.length); i++) {
  console.log(`Key: ${deptEntries[i][0]}, Value:`, deptEntries[i][1]);
}
