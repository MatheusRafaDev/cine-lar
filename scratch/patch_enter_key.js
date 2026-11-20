const fs = require('fs');
const file = 'c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js';
let content = fs.readFileSync(file, 'utf8');
const target = '" "===r||"k"===r||"MediaPlayPause"===r||10252===n?(e.preventDefault(),Ae()):"MediaPlay"===r||415===n';
const replacement = '" "===r||"k"===r||"MediaPlayPause"===r||10252===n||13===n||"Enter"===r?(e.preventDefault(),Ae()):"MediaPlay"===r||415===n';

if (!content.includes(target)) {
    console.error('Target not found in main.jellyfin.bundle.js!');
    process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched Enter/PlayPause in main.jellyfin.bundle.js!');
