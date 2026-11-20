const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = 518188;
console.log(content.substring(idx - 100, idx + 100));
