const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'parsed_sizes.txt');
const content = fs.readFileSync(filePath, 'utf16le');
const lines = content.split('\n');
console.log('Total lines (proper):', lines.length);

// Print lines matching "Size Set ID:" or "Name:"
console.log('All Size Sets in parsed_sizes.txt:');
for (const line of lines) {
  if (line.includes('Size Set ID:') || line.includes('Name:')) {
    console.log(line.trim());
  }
}
