const fs = require('fs');

try {
  const content = fs.readFileSync('/home/ubuntu/elister/backend/logs/out-0.log', 'utf8');
  const lines = content.split('\n');
  console.log('Last 50 lines of out-0.log:');
  console.log(lines.slice(-50).join('\n'));
} catch (err) {
  console.error(err);
}
