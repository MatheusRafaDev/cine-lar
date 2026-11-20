const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = content.indexOf('10252===n?');
console.log(content.substring(idx - 600, idx));
