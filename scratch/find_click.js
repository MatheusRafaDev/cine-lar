const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = content.indexOf('function tt(e)');
const str = content.substring(idx - 2500, idx);
const clickIdx = str.indexOf('.addEventListener("click"');
console.log(clickIdx !== -1 ? str.substring(clickIdx - 50, clickIdx + 200) : 'not found');
