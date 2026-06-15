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
  const lineNum = code.substring(0, match.index).split('\n').length;
  
  if (isClosing) {
    if (stack.length === 0) {
      console.log(`Line ${lineNum}: Unmatched closing tag: ${tag}`);
    } else {
      const top = stack.pop();
      if (top.name !== name) {
        console.log(`Line ${lineNum}: Mismatched tags. Closed ${tag} but top of stack is ${top.tag} from line ${top.lineNum}`);
        // Put top back to keep stack aligned
        stack.push(top);
      } else {
        // Correctly matched
        // console.log(`Line ${lineNum}: Matched ${tag} with ${top.tag} from line ${top.lineNum}`);
      }
    }
  } else {
    stack.push({ name, tag, index: match.index, lineNum });
  }
}

console.log('\nRemaining open tags in stack at end:');
stack.forEach(x => {
  console.log(`Line ${x.lineNum}: ${x.tag}`);
});
