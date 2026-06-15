const fs = require('fs');
const code = fs.readFileSync('src/pages/Listings.jsx', 'utf8');

// Simple regex to find JSX opening/closing tags
const tagRegex = /<\/?[A-Za-z0-9_:]+(?:\s+[A-Za-z0-9_:]+=(?:{[^}]+}|"[^"]*"|'[^']*'))*\s*\/?>/g;
let match;
const stack = [];

while ((match = tagRegex.exec(code)) !== null) {
  const tag = match[0];
  const isClosing = tag.startsWith('</');
  const isSelfClosing = tag.endsWith('/>');
  
  if (isSelfClosing) continue;
  
  // Extract tag name
  const nameMatch = tag.match(/<\/?([A-Za-z0-9_:]+)/);
  if (!nameMatch) continue;
  const name = nameMatch[1];
  
  if (isClosing) {
    if (stack.length === 0) {
      console.log('Unmatched closing tag:', tag, 'at index', match.index);
    } else {
      const top = stack.pop();
      if (top.name !== name) {
        console.log('Mismatched tags:', top.tag, 'and', tag, 'at index', match.index);
        // Put it back to see others
        stack.push(top);
      }
    }
  } else {
    stack.push({ name, tag, index: match.index });
  }
}
console.log('Remaining open tags in stack:');
stack.forEach(x => {
  // Get line number
  const lineNum = code.substring(0, x.index).split('\n').length;
  console.log(`Line ${lineNum}: ${x.tag}`);
});
