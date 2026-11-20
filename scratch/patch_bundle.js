const fs = require('fs');
const file = 'c:/Users/rafae/Documents/GitHub/jellyfin-tizen/www/main.jellyfin.bundle.js';
let content = fs.readFileSync(file, 'utf8');
const target = 'var cinema=document.querySelector(".mf-cinema-player");if(cinema){var cBtn=cinema.querySelector(".mf-player-btn-close, .mf-player-close");return void(cBtn?cBtn.click():cinema.remove());}';
const replacement = 'var cinema=document.querySelector(".mf-cinema-player");if(cinema||(window.MatheusFlix&&window.MatheusFlix.closeCinema&&document.querySelector("video"))){if(window.MatheusFlix&&window.MatheusFlix.closeCinema){window.MatheusFlix.closeCinema();return void 0;}var cBtn=cinema?cinema.querySelector(".mf-player-close-btn, .mf-player-back-nav-btn, .mf-player-btn-close, .mf-player-close"):null;if(cBtn){cBtn.click();return void 0;}document.querySelectorAll("video, audio").forEach(function(v){try{v.pause();v.muted=true;v.volume=0;v.removeAttribute("src");v.src="";v.load();}catch(_){}});if(cinema)cinema.remove();return void 0;}';
if (!content.includes(target)) {
    console.error('Target not found!');
    process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched main.jellyfin.bundle.js!');
