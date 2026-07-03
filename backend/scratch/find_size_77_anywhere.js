const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'depop_attributes_direct.json');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File size:', content.length);
  
  // Find all occurrences of 77 in the text
  let index = 0;
  while ((index = content.indexOf('77', index)) !== -1) {
    console.log(`\nOccurrence of "77" at index ${index}:`);
    console.log(content.substring(index - 50, index + 50));
    index += 2;
  }
} else {
  console.log('File does not exist.');
}
