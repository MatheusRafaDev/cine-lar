const fs = require('fs');

const path = 'c:\\Users\\rafae\\Documents\\GitHub\\jellyfin-tizen\\www\\main.jellyfin.bundle.js';
let content = fs.readFileSync(path, 'utf8');

// Substituir smoothScroll em c(e) no bundle para usar offsetLeft e offsetTop sem forcar reflow
// Substituir a busca lenta por closest card com getBoundingClientRect por Math.min(idx, nextCards.length - 1)
const slowDownLoop = 'var aRect=card.getBoundingClientRect(),aMid=aRect.left+aRect.width/2,closest=nextCards[0],minD=1/0;for(var i=0;i<nextCards.length;i++){var r=nextCards[i].getBoundingClientRect(),d=Math.abs(aMid-(r.left+r.width/2));d<minD&&(minD=d,closest=nextCards[i])}closest.focus();var secRect=nextSec.getBoundingClientRect(),desTop=(window.pageYOffset||document.documentElement.scrollTop||0)+secRect.top-window.innerHeight/2+secRect.height/2;try{window.scrollTo({top:Math.max(0,desTop),behavior:"smooth"})}catch(e){window.scrollTo(0,Math.max(0,desTop))}';
const fastDownLoop = 'var target=nextCards[Math.min(idx,nextCards.length-1)];target.focus();window.scrollTo(0,Math.max(0,nextSec.offsetTop-window.innerHeight/2+nextSec.offsetHeight/2))';

if (content.includes(slowDownLoop)) {
    content = content.replace(slowDownLoop, fastDownLoop);
    console.log('Down loop otimizado no bundle!');
} else {
    console.log('Down loop ja otimizado ou nao encontrado.');
}

const slowUpLoop = 'var aRect=card.getBoundingClientRect(),aMid=aRect.left+aRect.width/2,closest=prevCards[0],minD=1/0;for(var i=0;i<prevCards.length;i++){var r=prevCards[i].getBoundingClientRect(),d=Math.abs(aMid-(r.left+r.width/2));d<minD&&(minD=d,closest=prevCards[i])}closest.focus();var secRect=prevSec.getBoundingClientRect(),desTop=(window.pageYOffset||document.documentElement.scrollTop||0)+secRect.top-window.innerHeight/2+secRect.height/2;try{window.scrollTo({top:Math.max(0,desTop),behavior:"smooth"})}catch(e){window.scrollTo(0,Math.max(0,desTop))}';
const fastUpLoop = 'var target=prevCards[Math.min(idx,prevCards.length-1)];target.focus();window.scrollTo(0,Math.max(0,prevSec.offsetTop-window.innerHeight/2+prevSec.offsetHeight/2))';

if (content.includes(slowUpLoop)) {
    content = content.replace(slowUpLoop, fastUpLoop);
    console.log('Up loop otimizado no bundle!');
} else {
    console.log('Up loop ja otimizado ou nao encontrado.');
}

// Substituir calculo de scroll do carrossel no bundle
const slowScrollRight = 'var sRect=scroller.getBoundingClientRect(),tRect=nCard.getBoundingClientRect(),targetLeft=scroller.scrollLeft+(tRect.left-sRect.left)-(scroller.clientWidth/2)+(tRect.width/2);try{scroller.scrollTo({left:Math.max(0,targetLeft),behavior:"smooth"})}catch(e){scroller.scrollLeft=Math.max(0,targetLeft)}';
const fastScrollRight = 'scroller.scrollLeft=Math.max(0,nCard.offsetLeft-(scroller.clientWidth/2)+(nCard.offsetWidth/2))';

if (content.includes(slowScrollRight)) {
    content = content.replace(slowScrollRight, fastScrollRight);
    console.log('ScrollRight otimizado no bundle!');
}

const slowScrollLeft = 'var sRect=scroller.getBoundingClientRect(),tRect=pCard.getBoundingClientRect(),targetLeft=scroller.scrollLeft+(tRect.left-sRect.left)-(scroller.clientWidth/2)+(tRect.width/2);try{scroller.scrollTo({left:Math.max(0,targetLeft),behavior:"smooth"})}catch(e){scroller.scrollLeft=Math.max(0,targetLeft)}';
const fastScrollLeft = 'scroller.scrollLeft=Math.max(0,pCard.offsetLeft-(scroller.clientWidth/2)+(pCard.offsetWidth/2))';

if (content.includes(slowScrollLeft)) {
    content = content.replace(slowScrollLeft, fastScrollLeft);
    console.log('ScrollLeft otimizado no bundle!');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Bundle processado com sucesso!');
