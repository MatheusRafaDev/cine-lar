const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = 518188;
const slice = content.substring(idx - 2000, idx);
const match = slice.match(/function\s+[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{[^}]*video\.paused/);
console.log('Regex match:', match);
// Find where Ae is defined
const allAe = [];
let pos = 0;
while ((pos = slice.indexOf('Ae', pos)) !== -1) {
    allAe.push(slice.substring(Math.max(0, pos - 20), pos + 30));
    pos += 2;
}
console.log('All Ae occurrences in slice:', allAe);
