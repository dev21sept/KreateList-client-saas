const fs = require('fs');

const content = fs.readFileSync('backend/scratch/all_past_matches.txt', 'utf8');
const regex = /\\"title\\"\s*:\s*\\"([^"\\]+)\\"/g;
const titles = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  titles.add(match[1]);
}

// Also search without escapes
const regexNormal = /"title"\s*:\s*"([^"\\]+)"/g;
while ((match = regexNormal.exec(content)) !== null) {
  titles.add(match[1]);
}

console.log('Titles found in past logs:');
console.log(Array.from(titles));
