const fs = require('fs');
const file = 'c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js';
let content = fs.readFileSync(file, 'utf8');
const target = 'function Ae(){le||(G.paused?ue():G.pause())}';
const replacement = 'function Ae(){if(typeof window!=="undefined"){window.MatheusFlix=window.MatheusFlix||{};window.MatheusFlix.togglePlay=Ae;}le||(G.paused?ue():(G.pause(),xe()))}';

if (!content.includes(target)) {
    console.error('Target not found!');
    process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully exposed togglePlay in main.jellyfin.bundle.js!');
