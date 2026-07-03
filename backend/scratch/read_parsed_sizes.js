const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'parsed_sizes.txt');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('Total lines in parsed_sizes.txt:', lines.length);
  // Print first 50 lines
  console.log(lines.slice(0, 50).join('\n'));
} else {
  console.log('parsed_sizes.txt does not exist.');
}
