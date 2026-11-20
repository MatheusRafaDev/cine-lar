const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = content.indexOf('e.preventDefault(),Ae()');
console.log('Found call at:', idx);
// Search backward for Ae= or function Ae
for (let i = idx - 100; i >= Math.max(0, idx - 10000); i--) {
    const sub = content.substring(i, i + 15);
    if (sub.startsWith('function Ae') || sub.startsWith('var Ae=') || sub.startsWith('let Ae=') || sub.startsWith('Ae=function') || sub.startsWith('Ae=()=>')) {
        console.log('Definition at', i, content.substring(i, i + 100));
        break;
    }
}
