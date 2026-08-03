const fs = require('fs');

const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\6d259fa0-fa10-467d-8539-aaa3c2a69afb\\.system_generated\\logs\\transcript_full.jsonl';
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log('Searching logs for any printed listing counts or titles...');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  
  if (line.includes('listings found') || line.includes('Listings in DB') || line.includes('Found') && line.includes('listings')) {
    console.log(`Line ${i} matches:`, line.slice(0, 500));
  }
}
