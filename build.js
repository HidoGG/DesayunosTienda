const fs = require('fs');

const sw = fs.readFileSync('sw.js', 'utf8');
const version = `santiaguenas-${Date.now()}`;
const updated = sw.replace(/const CACHE = 'santiaguenas-[^']+';/, `const CACHE = '${version}';`);
fs.writeFileSync('sw.js', updated);
console.log('SW version updated:', version);
