const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const regex = /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(\)\s*\{[^}]*G\.paused/g;
let m;
while ((m = regex.exec(content.substring(500000, 525000))) !== null) {
    console.log('Match:', m[0]);
}
