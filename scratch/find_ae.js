const fs = require('fs');
const content = fs.readFileSync('c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js', 'utf8');
const idx = content.indexOf('function tt(e)');
// Let's search backwards from tt(e) for function Ae(
const str = content.substring(idx - 1500, idx);
const match = str.match(/function\s+([A-Za-z0-9_$]+)\s*\(\)\s*\{[^}]*paused/);
console.log('Match toggle play:', match ? match[0] : 'no direct match');
const lines = str.split(';');
for (let l of lines) {
    if (l.includes('.paused') && (l.includes('play(') || l.includes('safePlay') || l.includes('pause('))) {
        console.log('Candidate line:', l);
    }
}
