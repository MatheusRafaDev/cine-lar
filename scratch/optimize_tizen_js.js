const fs = require('fs');

const path = 'c:\\Users\\rafae\\Documents\\GitHub\\jellyfin-tizen\\tizen.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Otimizar handleHomeCardNavigation
const homeNavRegex = /\/\/ Navegacao horizontal e vertical deterministica nos carrosseis da Home[\s\S]*?return false;\s*\}/;

const newHomeNav = `// Navegacao horizontal e vertical deterministica nos carrosseis da Home (O(1) Zero Reflow)
    function handleHomeCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
        var scroller = card.closest('.mf-home-scroller');
        var section = card.closest('.mf-home-section, .verticalSection');
        if (!scroller) return false;

        var cards = Array.prototype.slice.call(scroller.children).filter(function (c) {
            return c.classList.contains('mf-home-card');
        });
        var idx = cards.indexOf(card);

        if (isRight) {
            if (idx >= 0 && idx < cards.length - 1) {
                var nextCard = cards[idx + 1];
                nextCard.focus();
                smoothScrollCard(nextCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isLeft) {
            if (idx > 0) {
                var prevCard = cards[idx - 1];
                prevCard.focus();
                smoothScrollCard(prevCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isDown) {
            var wrap = section.parentElement || document.body;
            var allSections = Array.prototype.slice.call(wrap.querySelectorAll('.mf-home-section, .verticalSection')).filter(function (sec) {
                return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
            });
            var secIdx = allSections.indexOf(section);
            if (secIdx >= 0 && secIdx < allSections.length - 1) {
                var nextSec = allSections[secIdx + 1];
                var nextCards = Array.prototype.slice.call(nextSec.querySelectorAll('.mf-home-card'));
                if (nextCards.length > 0) {
                    var targetCard = nextCards[Math.min(idx, nextCards.length - 1)];
                    targetCard.focus();
                    smoothScrollCard(targetCard);
                    e.preventDefault(); e.stopPropagation(); return true;
                }
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isUp) {
            var wrap = section.parentElement || document.body;
            var allSections = Array.prototype.slice.call(wrap.querySelectorAll('.mf-home-section, .verticalSection')).filter(function (sec) {
                return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
            });
            var secIdx = allSections.indexOf(section);
            if (secIdx > 0) {
                var prevSec = allSections[secIdx - 1];
                var prevCards = Array.prototype.slice.call(prevSec.querySelectorAll('.mf-home-card'));
                if (prevCards.length > 0) {
                    var targetCard = prevCards[Math.min(idx, prevCards.length - 1)];
                    targetCard.focus();
                    smoothScrollCard(targetCard);
                    e.preventDefault(); e.stopPropagation(); return true;
                }
            } else {
                // Sobe para o Hero Banner ou Cabecalho
                var heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
                if (heroBtn && heroBtn.offsetParent !== null) {
                    heroBtn.focus();
                    window.scrollTo(0, 0);
                    e.preventDefault(); e.stopPropagation(); return true;
                }
                var headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
                if (headerBtn && headerBtn.offsetParent !== null) {
                    headerBtn.focus();
                    window.scrollTo(0, 0);
                    e.preventDefault(); e.stopPropagation(); return true;
                }
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        return false;
    }`;

content = content.replace(homeNavRegex, newHomeNav);

// 2. Otimizar handleGridCardNavigation
const gridNavRegex = /\/\/ Navegacao em grade \(Catalogo, Series, Pasta Local\)[\s\S]*?return false;\s*\}/;

const newGridNav = `// Navegacao em grade (Catalogo, Series, Pasta Local) - O(1) Index Math
    function handleGridCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
        var grid = card.closest('.mf-catalog-grid, .mf-movie-grid, .mf-local-grid, .itemsContainer, .verticalSection');
        if (!grid) grid = document.body;
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.mf-movie-card, .mf-local-card, .card')).filter(function (c) {
            return c.offsetParent !== null;
        });
        var idx = cards.indexOf(card);
        if (idx === -1) return false;

        var cols = 4;
        if (cards.length > 1) {
            var top0 = cards[0].offsetTop;
            for (var i = 1; i < Math.min(cards.length, 12); i++) {
                if (cards[i].offsetTop > top0 + 10) {
                    cols = i;
                    break;
                }
            }
        }

        if (isRight) {
            if (idx < cards.length - 1) {
                var next = cards[idx + 1];
                next.focus();
                next.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isLeft) {
            if (idx > 0) {
                var prev = cards[idx - 1];
                prev.focus();
                prev.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isDown) {
            var nextIdx = idx + cols;
            if (nextIdx < cards.length) {
                var target = cards[nextIdx];
                target.focus();
                target.scrollIntoView({ behavior: 'auto', block: 'center' });
                e.preventDefault(); e.stopPropagation(); return true;
            } else if (idx < cards.length - 1) {
                var last = cards[cards.length - 1];
                last.focus();
                last.scrollIntoView({ behavior: 'auto', block: 'center' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        if (isUp) {
            var prevIdx = idx - cols;
            if (prevIdx >= 0) {
                var target = cards[prevIdx];
                target.focus();
                target.scrollIntoView({ behavior: 'auto', block: 'center' });
                e.preventDefault(); e.stopPropagation(); return true;
            } else {
                var headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
                if (headerBtn && headerBtn.offsetParent !== null) {
                    headerBtn.focus();
                    window.scrollTo(0, 0);
                    e.preventDefault(); e.stopPropagation(); return true;
                }
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }

        return false;
    }`;

content = content.replace(gridNavRegex, newGridNav);

// 3. Adicionar throttle em handleTvDirectionalKey
const dirKeyRegex = /function handleTvDirectionalKey\(e\) \{([\s\S]*?)var active = document\.activeElement;/;
const newDirKey = `var lastTvDirTime = 0;
    function handleTvDirectionalKey(e) {
        var code = e.keyCode || e.which || 0;
        var key = e.key || '';

        var isLeft = code === 37 || key === 'ArrowLeft';
        var isUp = code === 38 || key === 'ArrowUp';
        var isRight = code === 39 || key === 'ArrowRight';
        var isDown = code === 40 || key === 'ArrowDown';

        if (!isLeft && !isUp && !isRight && !isDown) return false;

        var now = Date.now();
        if (now - lastTvDirTime < 50) {
            e.preventDefault(); e.stopPropagation(); return true;
        }
        lastTvDirTime = now;

        var active = document.activeElement;`;

content = content.replace(dirKeyRegex, newDirKey);

// 4. Singleton check na captura de keydown
content = content.replace(
    /window\.addEventListener\('keydown', function \(e\) \{/,
    `if (window.__mfTizenKeydownInit) return;
    window.__mfTizenKeydownInit = true;
    window.__mfSpatialNavRegistered = true;
    window.addEventListener('keydown', function (e) {`
);

fs.writeFileSync(path, content, 'utf8');
console.log('tizen.js otimizado com sucesso!');
