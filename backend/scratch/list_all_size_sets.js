const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'depop_attributes.json'), 'utf8'));

console.log('Size sets keys in depop_attributes.json:', Object.keys(data.size_sets || {}));
