const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'shoe_size_sets.txt');
const content = fs.readFileSync(filePath, 'utf16le');

const lines = content.split('\n');
console.log('Total lines:', lines.length);
for (const line of lines) {
  if (line.includes('Size Set ID:')) {
    console.log(line.trim());
  }
}
