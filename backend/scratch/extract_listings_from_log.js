const fs = require('fs');

const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\6d259fa0-fa10-467d-8539-aaa3c2a69afb\\.system_generated\\logs\\transcript_full.jsonl';
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    // Find the step_index 1500 which was the migration script run
    if (obj.step_index === 1500 || (obj.content && obj.content.includes('Anthropologie') && obj.content.includes('Checking'))) {
      console.log('Found matching step in full logs! Length:', obj.content.length);
      fs.writeFileSync('backend/scratch/full_migration_output.txt', obj.content);
      console.log('Saved full content to backend/scratch/full_migration_output.txt');
    }
  } catch (e) {}
}
