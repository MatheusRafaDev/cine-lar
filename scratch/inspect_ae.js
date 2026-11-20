const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = content.indexOf('function Ae()');
if (idx !== -1) {
    console.log(content.substring(idx, idx + 200));
} else {
    const idx2 = content.indexOf('Ae=function');
    if (idx2 !== -1) console.log(content.substring(idx2, idx2 + 200));
    else {
        const idx3 = content.indexOf('function Ae(');
        console.log(idx3 !== -1 ? content.substring(idx3, idx3 + 200) : 'not found');
    }
}
