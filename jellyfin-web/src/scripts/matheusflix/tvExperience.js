/**
 * MatheusFlix - Modulo de Otimizacao e Experiencia para Smart TV (10-Foot UI)
 * Suporte aprimorado para Samsung Smart TV (Tizen OS), LG WebOS, Android TV e navegadores de televisao.
 * Fornece navegacao espacial D-Pad inteligente, auto-foco, registro de teclas remotas e ocultacao de cursor.
 */

import browser from '../browser';
import layoutManager from '../../components/layoutManager';

let cursorTimer = null;
let isTvMode = false;

/**
 * Detecta se o dispositivo atual e uma Smart TV
 */
export function detectSmartTv() {
    if (typeof window === 'undefined') return false;

    const ua = (navigator.userAgent || '').toLowerCase();
    const isTizen = ua.includes('tizen') || Boolean(window.tizen) || Boolean(window.webapis);
    const isWebOs = ua.includes('web0s') || ua.includes('webos') || Boolean(window.webOS);
    const isGenericTv = ua.includes('smart-tv') || ua.includes('smarttv') || ua.includes('smarthub')
        || ua.includes('hbbtv') || ua.includes('googletv') || ua.includes('android tv')
        || ua.includes('apple tv') || ua.includes('crkey') || ua.includes('roku')
        || ua.includes('firetv') || ua.includes('netcast');

    let forceTv = false;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tv') === '1' || urlParams.get('tv') === 'true') forceTv = true;
        if (localStorage.getItem('mf_tv_mode') === 'true') forceTv = true;
    } catch (_) {}

    return isTizen || isWebOs || isGenericTv || browser.tv || forceTv;
}

/**
 * Registra teclas especificas do controle remoto Samsung Tizen
 */
function registerSamsungTvKeys() {
    try {
        const tvinput = window.tizen?.tvinputdevice || window.webapis?.tvinputdevice;
        if (!tvinput || typeof tvinput.registerKey !== 'function') return;

        const keys = [
            'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop',
            'MediaFastForward', 'MediaRewind', 'MediaTrackPrevious', 'MediaTrackNext',
            'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ];

        keys.forEach(k => {
            try { tvinput.registerKey(k); } catch (_) {}
        });
        console.info('[MatheusFlix TV] Teclas do controle remoto registradas.');
    } catch (err) {
        console.warn('[MatheusFlix TV] Registro de chaves Tizen ignorado:', err.message);
    }
}

/**
 * Rolagem suave de card e centralizacao no carrossel e na tela
 */
export function smoothScrollCard(target) {
    if (!target) return;

    // 1. Rolagem horizontal no carrossel
    const scroller = target.closest('.mf-home-scroller, .mf-row-slider-container');
    if (scroller) {
        const scrollerRect = scroller.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const scrollTarget = scroller.scrollLeft + (targetRect.left - scrollerRect.left) - (scroller.clientWidth / 2) + (targetRect.width / 2);
        try {
            scroller.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
        } catch (_) {
            scroller.scrollLeft = Math.max(0, scrollTarget);
        }
    }

    // 2. Rolagem vertical da pagina para centralizar a fileira na TV
    const section = target.closest('.mf-home-section, .verticalSection');
    if (section) {
        const secRect = section.getBoundingClientRect();
        const desiredTop = (window.pageYOffset || document.documentElement.scrollTop || 0) + secRect.top - (window.innerHeight / 2) + (secRect.height / 2);
        try {
            window.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });
        } catch (_) {
            window.scrollTo(0, Math.max(0, desiredTop));
        }
    }
}

/**
 * Auto-foco inteligente no primeiro elemento interativo relevante da tela
 */
export function autoFocusCurrentView() {
    if (typeof document === 'undefined') return;

    if (document.querySelector('.mf-cinema-player')) return;

    const modal = document.querySelector('.mf-stremio-modal, .mf-confirm-modal, .mf-quickconnect-overlay, .mf-movie-page');
    if (modal) {
        const primaryBtn = modal.querySelector('.mf-btn-hero-watch:not([disabled]), .mf-btn-confirm-yes, .mf-movie-page-back-btn, button.focusable, .focusable, button');
        if (primaryBtn && typeof primaryBtn.focus === 'function' && primaryBtn.offsetParent !== null) {
            primaryBtn.focus();
            return;
        }
    }

    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement && document.activeElement.offsetParent !== null) {
        return;
    }

    // 1. Hero Banner play
    const heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
    if (heroBtn && heroBtn.offsetParent !== null) {
        heroBtn.focus();
        return;
    }

    // 2. Primeiro card da Home
    const firstCard = document.querySelector('.mf-home-section .mf-home-card, .mf-home-card, .mf-movie-card, .mf-local-card');
    if (firstCard && firstCard.offsetParent !== null) {
        firstCard.focus();
        smoothScrollCard(firstCard);
        return;
    }

    // 3. Fallback: cabecalho
    const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
    if (headerBtn && headerBtn.offsetParent !== null) {
        headerBtn.focus();
    }
}

/**
 * Gestao de ocultacao de cursor do mouse na TV
 */
function setupCursorHiding() {
    const hideCursor = () => {
        document.documentElement.classList.add('mf-cursor-hidden');
    };

    const showCursor = () => {
        document.documentElement.classList.remove('mf-cursor-hidden');
        clearTimeout(cursorTimer);
        cursorTimer = setTimeout(hideCursor, 1800);
    };

    window.addEventListener('mousemove', showCursor, { passive: true });
    window.addEventListener('keydown', hideCursor, { passive: true });
    hideCursor();
}

/**
 * Navegacao dentro de modais (Stremio Details / Confirmacao)
 */
function handleModalNavigation(e, modal, active, isLeft, isUp, isRight, isDown) {
    const backBtn = modal.querySelector('.mf-movie-page-back-btn, .mf-stremio-close-btn');
    const closeBtn = modal.querySelector('.mf-btn-topbar-close');
    const watchBtn = modal.querySelector('.mf-btn-hero-watch:not([disabled])');
    const trailerBtn = modal.querySelector('.mf-btn-trailer');
    const favBtn = modal.querySelector('.mf-btn-fav-toggle');
    const dropBtn = modal.querySelector('.mf-btn-drop-movie');
    const streams = Array.from(modal.querySelectorAll('.mf-stream-item'));
    const episodes = Array.from(modal.querySelectorAll('.mf-episode-card'));
    const seasons = Array.from(modal.querySelectorAll('.mf-season-btn'));

    if (isDown) {
        if (active === backBtn || active === closeBtn) {
            if (watchBtn) watchBtn.focus();
            else if (streams[0]) streams[0].focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (active === watchBtn || active === trailerBtn || active === favBtn || active === dropBtn) {
            if (seasons.length > 0) {
                seasons[0].focus();
            } else if (episodes.length > 0) {
                episodes[0].focus();
                episodes[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (streams.length > 0) {
                streams[0].focus();
                streams[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (seasons.includes(active)) {
            if (episodes.length > 0) {
                episodes[0].focus();
                episodes[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const sIdx = streams.indexOf(active);
        if (sIdx >= 0 && sIdx < streams.length - 1) {
            streams[sIdx + 1].focus();
            streams[sIdx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const epIdx = episodes.indexOf(active);
        if (epIdx >= 0 && epIdx < episodes.length - 1) {
            episodes[epIdx + 1].focus();
            episodes[epIdx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        if (streams.indexOf(active) === 0) {
            if (watchBtn) watchBtn.focus();
            else if (backBtn) backBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const sIdx = streams.indexOf(active);
        if (sIdx > 0) {
            streams[sIdx - 1].focus();
            streams[sIdx - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (episodes.indexOf(active) === 0) {
            if (seasons.length > 0) seasons[0].focus();
            else if (watchBtn) watchBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const epIdx = episodes.indexOf(active);
        if (epIdx > 0) {
            episodes[epIdx - 1].focus();
            episodes[epIdx - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (seasons.includes(active)) {
            if (watchBtn) watchBtn.focus();
            else if (backBtn) backBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (active === watchBtn || active === trailerBtn || active === favBtn || active === dropBtn) {
            if (backBtn) backBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isRight) {
        if (active === backBtn && closeBtn) { closeBtn.focus(); e.preventDefault(); e.stopPropagation(); return true; }
        if (active === watchBtn) {
            if (trailerBtn) trailerBtn.focus();
            else if (favBtn) favBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (active === trailerBtn && favBtn) { favBtn.focus(); e.preventDefault(); e.stopPropagation(); return true; }
        const seaIdx = seasons.indexOf(active);
        if (seaIdx >= 0 && seaIdx < seasons.length - 1) {
            seasons[seaIdx + 1].focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (active === closeBtn && backBtn) { backBtn.focus(); e.preventDefault(); e.stopPropagation(); return true; }
        if (active === favBtn) {
            if (trailerBtn) trailerBtn.focus();
            else if (watchBtn) watchBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        if (active === trailerBtn && watchBtn) { watchBtn.focus(); e.preventDefault(); e.stopPropagation(); return true; }
        const seaIdx = seasons.indexOf(active);
        if (seaIdx > 0) {
            seasons[seaIdx - 1].focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

/**
 * Navegacao entre botoes do Cabecalho
 */
function handleHeaderNavigation(e, active, isLeft, isUp, isRight, isDown) {
    const headerBtns = Array.from(document.querySelectorAll(
        '.skinHeader .headerBackButton, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton, .skinHeader .headerUserButton'
    )).filter(btn => btn.offsetParent !== null && !btn.classList.contains('hide') && window.getComputedStyle(btn).display !== 'none');

    const idx = headerBtns.indexOf(active);

    if (isRight) {
        if (idx >= 0 && idx < headerBtns.length - 1) {
            headerBtns[idx + 1].focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (idx > 0) {
            headerBtns[idx - 1].focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isDown) {
        const heroPlay = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
        if (heroPlay && heroPlay.offsetParent !== null) {
            heroPlay.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const firstCard = document.querySelector('.mf-home-section .mf-home-card, .mf-home-card, .mf-movie-card, .mf-local-card');
        if (firstCard && firstCard.offsetParent !== null) {
            firstCard.focus();
            smoothScrollCard(firstCard);
            e.preventDefault(); e.stopPropagation(); return true;
        }
        const searchInput = document.querySelector('input[type="search"], input.searchfields, input');
        if (searchInput && searchInput.offsetParent !== null) {
            searchInput.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

/**
 * Navegacao no Hero Banner
 */
function handleHeroNavigation(e, active, isLeft, isUp, isRight, isDown) {
    if (isDown) {
        const firstCard = document.querySelector('.mf-home-section .mf-home-card, .mf-home-card');
        if (firstCard && firstCard.offsetParent !== null) {
            firstCard.focus();
            smoothScrollCard(firstCard);
            e.preventDefault(); e.stopPropagation(); return true;
        }
    }
    if (isUp) {
        const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
        if (headerBtn && headerBtn.offsetParent !== null) {
            headerBtn.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
    }
    if (isRight) {
        const playBtn = document.querySelector('.mf-btn-hero-play');
        const infoBtn = document.querySelector('.mf-btn-hero-info');
        if (active === playBtn && infoBtn && infoBtn.offsetParent !== null) {
            infoBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
    }
    if (isLeft) {
        const playBtn = document.querySelector('.mf-btn-hero-play');
        const infoBtn = document.querySelector('.mf-btn-hero-info');
        if (active === infoBtn && playBtn && playBtn.offsetParent !== null) {
            playBtn.focus();
            e.preventDefault(); e.stopPropagation(); return true;
        }
    }
    return false;
}

/**
 * Navegacao horizontal e vertical deterministica nos carrosseis da Home
 */
function handleHomeCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
    const scroller = card.closest('.mf-home-scroller');
    const section = card.closest('.mf-home-section, .verticalSection');

    if (isRight) {
        if (scroller) {
            const cards = Array.from(scroller.querySelectorAll('.mf-home-card'));
            const idx = cards.indexOf(card);
            if (idx >= 0 && idx < cards.length - 1) {
                const nextCard = cards[idx + 1];
                nextCard.focus();
                smoothScrollCard(nextCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (scroller) {
            const cards = Array.from(scroller.querySelectorAll('.mf-home-card'));
            const idx = cards.indexOf(card);
            if (idx > 0) {
                const prevCard = cards[idx - 1];
                prevCard.focus();
                smoothScrollCard(prevCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isDown) {
        const allSections = Array.from(document.querySelectorAll('.mf-home-section, .verticalSection')).filter(sec => {
            return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
        });
        const secIdx = allSections.indexOf(section);
        if (secIdx >= 0 && secIdx < allSections.length - 1) {
            const nextSec = allSections[secIdx + 1];
            const nextCards = Array.from(nextSec.querySelectorAll('.mf-home-card'));
            if (nextCards.length > 0) {
                const activeRect = card.getBoundingClientRect();
                const activeMidX = activeRect.left + (activeRect.width / 2);
                let closestCard = nextCards[0];
                let minDiff = Infinity;
                for (const c of nextCards) {
                    const r = c.getBoundingClientRect();
                    const midX = r.left + (r.width / 2);
                    const diff = Math.abs(activeMidX - midX);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestCard = c;
                    }
                }
                closestCard.focus();
                smoothScrollCard(closestCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        const allSections = Array.from(document.querySelectorAll('.mf-home-section, .verticalSection')).filter(sec => {
            return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
        });
        const secIdx = allSections.indexOf(section);
        if (secIdx > 0) {
            const prevSec = allSections[secIdx - 1];
            const prevCards = Array.from(prevSec.querySelectorAll('.mf-home-card'));
            if (prevCards.length > 0) {
                const activeRect = card.getBoundingClientRect();
                const activeMidX = activeRect.left + (activeRect.width / 2);
                let closestCard = prevCards[0];
                let minDiff = Infinity;
                for (const c of prevCards) {
                    const r = c.getBoundingClientRect();
                    const midX = r.left + (r.width / 2);
                    const diff = Math.abs(activeMidX - midX);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestCard = c;
                    }
                }
                closestCard.focus();
                smoothScrollCard(closestCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        } else {
            // Primeira fileira: sobe para o Hero Banner ou Cabecalho
            const heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
            if (heroBtn && heroBtn.offsetParent !== null) {
                heroBtn.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
            const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
            if (headerBtn && headerBtn.offsetParent !== null) {
                headerBtn.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

/**
 * Navegacao em grade (Catalogo, Series, Pasta Local)
 */
function handleGridCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
    let grid = card.closest('.mf-catalog-grid, .mf-movie-grid, .mf-local-grid, .itemsContainer, .verticalSection');
    if (!grid) grid = document.body;
    const cards = Array.from(grid.querySelectorAll('.mf-movie-card, .mf-local-card, .card')).filter(c => c.offsetParent !== null);
    const idx = cards.indexOf(card);
    if (idx === -1) return false;

    if (isRight) {
        if (idx < cards.length - 1) {
            cards[idx + 1].focus();
            cards[idx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (idx > 0) {
            cards[idx - 1].focus();
            cards[idx - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    const activeRect = card.getBoundingClientRect();
    const activeMidX = activeRect.left + (activeRect.width / 2);

    if (isDown) {
        const below = cards.filter(c => c.getBoundingClientRect().top > activeRect.bottom - 10);
        if (below.length > 0) {
            const firstRowTop = below[0].getBoundingClientRect().top;
            const sameRow = below.filter(c => Math.abs(c.getBoundingClientRect().top - firstRowTop) < 35);
            let closest = sameRow[0];
            let minDiff = Infinity;
            for (const c of sameRow) {
                const r = c.getBoundingClientRect();
                const diff = Math.abs(activeMidX - (r.left + r.width / 2));
                if (diff < minDiff) { minDiff = diff; closest = c; }
            }
            closest.focus();
            closest.scrollIntoView({ behavior: 'smooth', block: 'center' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        const above = cards.filter(c => c.getBoundingClientRect().bottom < activeRect.top + 10);
        if (above.length > 0) {
            const lastRowBottom = above[above.length - 1].getBoundingClientRect().bottom;
            const sameRow = above.filter(c => Math.abs(c.getBoundingClientRect().bottom - lastRowBottom) < 35);
            let closest = sameRow[0];
            let minDiff = Infinity;
            for (const c of sameRow) {
                const r = c.getBoundingClientRect();
                const diff = Math.abs(activeMidX - (r.left + r.width / 2));
                if (diff < minDiff) { minDiff = diff; closest = c; }
            }
            closest.focus();
            closest.scrollIntoView({ behavior: 'smooth', block: 'center' });
            e.preventDefault(); e.stopPropagation(); return true;
        } else {
            const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
            if (headerBtn && headerBtn.offsetParent !== null) {
                headerBtn.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

/**
 * Navegacao Espacial D-Pad inteligente entre linhas e elementos
 */
function handleSpatialNavigation(e) {
    const key = e.key || '';
    const keyCode = e.keyCode || e.which || 0;

    const isLeft = keyCode === 37 || key === 'ArrowLeft';
    const isUp = keyCode === 38 || key === 'ArrowUp';
    const isRight = keyCode === 39 || key === 'ArrowRight';
    const isDown = keyCode === 40 || key === 'ArrowDown';

    if (!isLeft && !isUp && !isRight && !isDown) return;

    const active = document.activeElement;

    // Foco perdido ou em body/html
    if (!active || active === document.body || active === document.documentElement || active.offsetParent === null) {
        autoFocusCurrentView();
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // Se estiver em campo de texto
    if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
        if (isDown) {
            const firstResult = document.querySelector('.mf-movie-card, .mf-home-card, .card');
            if (firstResult) {
                firstResult.focus();
                smoothScrollCard(firstResult);
                e.preventDefault();
                e.stopPropagation();
            }
        }
        return;
    }

    // Modal aberto
    const modal = document.querySelector('.mf-stremio-modal, .mf-movie-page, .mf-confirm-backdrop, .mf-shortcuts-backdrop');
    if (modal && modal.contains(active)) {
        handleModalNavigation(e, modal, active, isLeft, isUp, isRight, isDown);
        return;
    }

    // Cabecalho
    if (active.closest('.skinHeader')) {
        handleHeaderNavigation(e, active, isLeft, isUp, isRight, isDown);
        return;
    }

    // Hero Banner
    if (active.closest('.mf-home-hero') || active.classList?.contains('mf-btn-hero-play') || active.classList?.contains('mf-btn-hero-info')) {
        handleHeroNavigation(e, active, isLeft, isUp, isRight, isDown);
        return;
    }

    // Card de Carrossel da Home
    if (active.classList?.contains('mf-home-card') || active.closest('.mf-home-card')) {
        const card = active.classList.contains('mf-home-card') ? active : active.closest('.mf-home-card');
        handleHomeCardNavigation(e, card, isLeft, isUp, isRight, isDown);
        return;
    }

    // Card em grade (Catalogo, Series, Pasta Local)
    if (active.classList?.contains('mf-movie-card') || active.classList?.contains('mf-local-card') || active.classList?.contains('card')) {
        handleGridCardNavigation(e, active, isLeft, isUp, isRight, isDown);
    }
}

/**
 * Tratamento global do botao Voltar do controle remoto (Tizen 10009, WebOS 461, Esc 27)
 */
function handleTvBackButton(e) {
    const key = e.key || '';
    const keyCode = e.keyCode || e.which || 0;
    const isBack = ['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(key)
        || keyCode === 10009 || keyCode === 461 || keyCode === 27;

    if (!isBack) return;

    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
    }

    if (document.querySelector('.mf-cinema-player')) {
        return;
    }

    const modal = document.querySelector('.mf-stremio-modal, .mf-movie-page');
    if (modal) {
        e.preventDefault();
        const closeBtn = modal.querySelector('.mf-movie-page-back-btn, .mf-stremio-close-btn');
        if (closeBtn) closeBtn.click();
        else modal.remove();
        return;
    }

    const confirmModal = document.querySelector('.mf-confirm-backdrop');
    if (confirmModal) {
        e.preventDefault();
        const cancelBtn = confirmModal.querySelector('.mf-btn-confirm-no');
        if (cancelBtn) cancelBtn.click();
        else confirmModal.remove();
        return;
    }

    const shortcutsModal = document.querySelector('.mf-shortcuts-backdrop');
    if (shortcutsModal) {
        e.preventDefault();
        shortcutsModal.remove();
        return;
    }

    const currentHash = window.location.hash || '';
    if (currentHash && !currentHash.startsWith('#/home') && currentHash !== '#/') {
        e.preventDefault();
        window.location.hash = '#/home?tab=0';
        return;
    }

    e.preventDefault();
    import('./confirmModal').then(({ showConfirmModal }) => {
        showConfirmModal({
            title: 'Sair do MatheusFlix',
            subtitle: 'Deseja encerrar o aplicativo na sua Smart TV?',
            icon: 'exit_to_app',
            confirmText: 'Sair da TV',
            cancelText: 'Continuar Assistindo',
            confirmType: 'danger'
        }).then(confirmed => {
            if (confirmed) {
                if (window.tizen?.application?.getCurrentApplication) {
                    window.tizen.application.getCurrentApplication().exit();
                } else if (window.close) {
                    window.close();
                }
            }
        });
    });
}

/**
 * Inicializador da Experiencia TV
 */
export function initTvExperience() {
    isTvMode = detectSmartTv();

    if (isTvMode) {
        document.documentElement.classList.add('layout-tv');
        document.body.classList.add('layout-tv');
        layoutManager.setLayout('tv', false);
        registerSamsungTvKeys();
        setupCursorHiding();

        console.info('[MatheusFlix] Modo Smart TV 10-Foot ativado com sucesso.');
    }

    window.addEventListener('keydown', handleSpatialNavigation, true);
    window.addEventListener('keydown', handleTvBackButton, false);

    // Auto-foco repetido em intervalos para garantir deteccao apos carregamento de rede
    [150, 400, 800, 1500, 2500].forEach(ms => {
        setTimeout(autoFocusCurrentView, ms);
    });

    window.addEventListener('hashchange', () => {
        [150, 400, 800].forEach(ms => setTimeout(autoFocusCurrentView, ms));
    });

    document.addEventListener('viewshow', () => {
        [150, 400, 800].forEach(ms => setTimeout(autoFocusCurrentView, ms));
    });

    if (typeof window !== 'undefined') {
        window.MatheusFlix = window.MatheusFlix || {};
        window.MatheusFlix.isTv = () => isTvMode;
        window.MatheusFlix.toggleTvMode = (force) => {
            const next = force !== undefined ? Boolean(force) : !isTvMode;
            localStorage.setItem('mf_tv_mode', String(next));
            window.location.reload();
        };
    }
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTvExperience);
    } else {
        initTvExperience();
    }
}

export default {
    initTvExperience,
    detectSmartTv,
    autoFocusCurrentView,
    smoothScrollCard
};