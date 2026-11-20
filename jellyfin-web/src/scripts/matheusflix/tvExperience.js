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
 * Rolagem suave de card e centralizacao no carrossel e na tela (Zero Reflow Engine)
 */
export function smoothScrollCard(target) {
    if (!target) return;

    // 1. Rolagem horizontal no carrossel sem reflow
    const scroller = target.closest('.mf-home-scroller, .mf-row-slider-container');
    if (scroller) {
        const targetLeft = target.offsetLeft;
        const targetWidth = target.offsetWidth || 215;
        const scrollerWidth = scroller.clientWidth || window.innerWidth;
        const scrollTarget = targetLeft - (scrollerWidth / 2) + (targetWidth / 2);
        scroller.scrollLeft = Math.max(0, scrollTarget);
    }

    // 2. Rolagem vertical da pagina para centralizar a fileira na TV
    const section = target.closest('.mf-home-section, .verticalSection');
    if (section) {
        const secTop = section.offsetTop;
        const secHeight = section.offsetHeight || 300;
        const desiredTop = secTop - (window.innerHeight / 2) + (secHeight / 2);
        window.scrollTo(0, Math.max(0, desiredTop));
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
 * Navegacao horizontal e vertical deterministica nos carrosseis da Home (O(1) Zero Reflow)
 */
function handleHomeCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
    const scroller = card.closest('.mf-home-scroller');
    const section = card.closest('.mf-home-section, .verticalSection');
    if (!scroller) return false;

    const cards = Array.from(scroller.children).filter(c => c.classList.contains('mf-home-card'));
    const idx = cards.indexOf(card);

    if (isRight) {
        if (idx >= 0 && idx < cards.length - 1) {
            const nextCard = cards[idx + 1];
            nextCard.focus();
            smoothScrollCard(nextCard);
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (idx > 0) {
            const prevCard = cards[idx - 1];
            prevCard.focus();
            smoothScrollCard(prevCard);
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isDown) {
        const wrap = section.parentElement || document.body;
        const allSections = Array.from(wrap.querySelectorAll('.mf-home-section, .verticalSection')).filter(sec => {
            return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
        });
        const secIdx = allSections.indexOf(section);
        if (secIdx >= 0 && secIdx < allSections.length - 1) {
            const nextSec = allSections[secIdx + 1];
            const nextCards = Array.from(nextSec.querySelectorAll('.mf-home-card'));
            if (nextCards.length > 0) {
                const targetCard = nextCards[Math.min(idx, nextCards.length - 1)];
                targetCard.focus();
                smoothScrollCard(targetCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        const wrap = section.parentElement || document.body;
        const allSections = Array.from(wrap.querySelectorAll('.mf-home-section, .verticalSection')).filter(sec => {
            return sec.offsetParent !== null && sec.querySelector('.mf-home-card');
        });
        const secIdx = allSections.indexOf(section);
        if (secIdx > 0) {
            const prevSec = allSections[secIdx - 1];
            const prevCards = Array.from(prevSec.querySelectorAll('.mf-home-card'));
            if (prevCards.length > 0) {
                const targetCard = prevCards[Math.min(idx, prevCards.length - 1)];
                targetCard.focus();
                smoothScrollCard(targetCard);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        } else {
            // Sobe para o Hero Banner ou Cabecalho
            const heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
            if (heroBtn && heroBtn.offsetParent !== null) {
                heroBtn.focus();
                window.scrollTo(0, 0);
                e.preventDefault(); e.stopPropagation(); return true;
            }
            const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
            if (headerBtn && headerBtn.offsetParent !== null) {
                headerBtn.focus();
                window.scrollTo(0, 0);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

/**
 * Navegacao em grade (Catalogo, Series, Pasta Local) - O(1) Index Math
 */
function handleGridCardNavigation(e, card, isLeft, isUp, isRight, isDown) {
    let grid = card.closest('.mf-catalog-grid, .mf-movie-grid, .mf-local-grid, .itemsContainer, .verticalSection');
    if (!grid) grid = document.body;
    const cards = Array.from(grid.querySelectorAll('.mf-movie-card, .mf-local-card, .card')).filter(c => c.offsetParent !== null);
    const idx = cards.indexOf(card);
    if (idx === -1) return false;

    // Detectar colunas da grade por comparacao simples de offsetTop
    let cols = 4;
    if (cards.length > 1) {
        const top0 = cards[0].offsetTop;
        for (let i = 1; i < Math.min(cards.length, 12); i++) {
            if (cards[i].offsetTop > top0 + 10) {
                cols = i;
                break;
            }
        }
    }

    if (isRight) {
        if (idx < cards.length - 1) {
            const next = cards[idx + 1];
            next.focus();
            next.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isLeft) {
        if (idx > 0) {
            const prev = cards[idx - 1];
            prev.focus();
            prev.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isDown) {
        const nextIdx = idx + cols;
        if (nextIdx < cards.length) {
            const target = cards[nextIdx];
            target.focus();
            target.scrollIntoView({ behavior: 'auto', block: 'center' });
            e.preventDefault(); e.stopPropagation(); return true;
        } else if (idx < cards.length - 1) {
            const last = cards[cards.length - 1];
            last.focus();
            last.scrollIntoView({ behavior: 'auto', block: 'center' });
            e.preventDefault(); e.stopPropagation(); return true;
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    if (isUp) {
        const prevIdx = idx - cols;
        if (prevIdx >= 0) {
            const target = cards[prevIdx];
            target.focus();
            target.scrollIntoView({ behavior: 'auto', block: 'center' });
            e.preventDefault(); e.stopPropagation(); return true;
        } else {
            const headerBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
            if (headerBtn && headerBtn.offsetParent !== null) {
                headerBtn.focus();
                window.scrollTo(0, 0);
                e.preventDefault(); e.stopPropagation(); return true;
            }
        }
        e.preventDefault(); e.stopPropagation(); return true;
    }

    return false;
}

let lastSpatialNavTime = 0;

/**
 * Navegacao Espacial D-Pad inteligente entre linhas e elementos (Ultra-Fast 60FPS)
 */
function handleSpatialNavigation(e) {
    const key = e.key || '';
    const keyCode = e.keyCode || e.which || 0;

    const isLeft = keyCode === 37 || key === 'ArrowLeft';
    const isUp = keyCode === 38 || key === 'ArrowUp';
    const isRight = keyCode === 39 || key === 'ArrowRight';
    const isDown = keyCode === 40 || key === 'ArrowDown';

    if (!isLeft && !isUp && !isRight && !isDown) return;

    // Se o player de cinema estiver aberto, deixa o controle direto com o cinemaPlayer
    if (document.querySelector('.mf-cinema-player')) {
        return;
    }

    // Throttle de 50ms para evitar engasgo e acumulo de buffer no controle remoto
    const now = Date.now();
    if (now - lastSpatialNavTime < 50) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    lastSpatialNavTime = now;

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

let lastBackPressTime = 0;
let backToastTimer = null;

function showTvToast(msg) {
    try {
        const existing = document.getElementById('mf-tv-exit-toast');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        const toast = document.createElement('div');
        toast.id = 'mf-tv-exit-toast';
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(20,20,19,0.95);color:#FAF9F5;padding:14px 28px;border-radius:30px;border:1.5px solid rgba(250,249,245,0.25);box-shadow:0 12px 32px rgba(0,0,0,0.95);font-size:16px;font-weight:600;z-index:999999;pointer-events:none;transition:opacity 0.25s ease;text-align:center;letter-spacing:0.3px;';
        document.body.appendChild(toast);

        clearTimeout(backToastTimer);
        backToastTimer = setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }
        }, 2500);
    } catch (_) {}
}

/**
 * Tratamento global do botao Voltar do controle remoto (Tizen 10009, WebOS 461, Esc 27)
 * Retorna passo a passo dentro do app: player -> modal -> busca -> abas -> topo -> sair
 */
export function handleTvBackButton(e) {
    const key = e.key || '';
    const keyCode = e.keyCode || e.which || 0;
    const isBack = ['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(key)
        || keyCode === 10009 || keyCode === 461 || keyCode === 27;

    if (!isBack) return;

    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
    }

    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 1. Fechar Cinema Player se estiver aberto
    const cinemaPlayer = document.querySelector('.mf-cinema-player');
    if (cinemaPlayer || (window.MatheusFlix && typeof window.MatheusFlix.closeCinema === 'function' && document.querySelector('video'))) {
        if (window.MatheusFlix && typeof window.MatheusFlix.closeCinema === 'function') {
            window.MatheusFlix.closeCinema();
            return;
        }
        if (window.MatheusFlix && typeof window.MatheusFlix.stopAllMedia === 'function') {
            window.MatheusFlix.stopAllMedia();
            return;
        }
        const closeBtn = cinemaPlayer?.querySelector('.mf-player-close-btn, .mf-player-back-nav-btn, .mf-player-btn-close, .mf-player-close');
        if (closeBtn) {
            closeBtn.click();
            return;
        }
        if (cinemaPlayer) {
            cinemaPlayer.querySelectorAll('video, audio').forEach(v => {
                try {
                    v.pause();
                    v.muted = true;
                    v.volume = 0;
                    v.removeAttribute('src');
                    v.src = '';
                    v.load();
                } catch (_) {}
            });
            cinemaPlayer.remove();
        }
        return;
    }

    // Se estiver em rota de reproducao nativa Jellyfin (#/video, #/nowplaying)
    const currentHash = window.location.hash || '';
    if (currentHash.includes('/video') || currentHash.includes('/nowplaying')) {
        if (window.MatheusFlix && typeof window.MatheusFlix.stopAllMedia === 'function') {
            window.MatheusFlix.stopAllMedia();
        }
        document.querySelectorAll('video, audio').forEach(v => {
            try {
                v.pause();
                v.muted = true;
                v.volume = 0;
                v.removeAttribute('src');
                v.src = '';
                v.load();
            } catch (_) {}
        });
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '#/home?tab=0';
        }
        return;
    }

    // 2. Fechar modal de detalhes Stremio ou pagina de filme
    const modal = document.querySelector('.mf-stremio-modal, .mf-movie-page');
    if (modal) {
        const closeBtn = modal.querySelector('.mf-movie-page-back-btn, .mf-stremio-close-btn');
        if (closeBtn) closeBtn.click();
        else modal.remove();
        return;
    }

    // 3. Fechar modal de confirmacao
    const confirmModal = document.querySelector('.mf-confirm-backdrop');
    if (confirmModal) {
        const cancelBtn = confirmModal.querySelector('.mf-confirm-btn-cancel, .mf-btn-confirm-no');
        if (cancelBtn) cancelBtn.click();
        else confirmModal.remove();
        return;
    }

    // 4. Fechar atalhos
    const shortcutsModal = document.querySelector('.mf-shortcuts-backdrop');
    if (shortcutsModal) {
        shortcutsModal.remove();
        return;
    }

    // 5. Fechar qualquer dialog nativo
    const dialog = document.querySelector('.dialogContainer .dialog.opened, dialog[open]');
    if (dialog) {
        const dClose = dialog.querySelector('.button-close, [data-action="close"], .btnCancel');
        if (dClose) dClose.click();
        else dialog.remove();
        return;
    }

    // 6. Limpar busca ativa
    const searchInput = document.querySelector('input[type="search"], input.searchfields');
    if (searchInput && (document.activeElement === searchInput || searchInput.value)) {
        searchInput.value = '';
        searchInput.blur();
        const searchBtn = document.querySelector('.headerSearchButton');
        if (searchBtn) searchBtn.focus();
        else window.location.hash = '#/home?tab=0';
        return;
    }

    // 7. Se estiver em pagina secundaria diferente da Home
    const currentHash = window.location.hash || '';
    if (currentHash && !currentHash.startsWith('#/home') && currentHash !== '#/') {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '#/home?tab=0';
        }
        return;
    }

    // 8. Se estiver em uma aba DIFERENTE da aba 0 (Torrents, Pasta Local, Downloads)
    let isNotTab0 = false;
    try {
        if (currentHash.includes('tab=1') || currentHash.includes('tab=2') || currentHash.includes('tab=3')) {
            isNotTab0 = true;
        } else {
            const activeTabBtn = document.querySelector('.skinHeader .emby-tab-button-active');
            if (activeTabBtn && activeTabBtn.getAttribute('data-index') && activeTabBtn.getAttribute('data-index') !== '0') {
                isNotTab0 = true;
            }
        }
    } catch (_) {}

    if (isNotTab0) {
        const homeTabBtn = document.querySelector('.skinHeader .emby-tab-button[data-index="0"], .skinHeader .emby-tab-button');
        if (homeTabBtn) {
            homeTabBtn.click();
        } else {
            window.location.hash = '#/home?tab=0';
        }
        setTimeout(() => {
            const firstCard = document.querySelector('.mf-btn-hero-play, .mf-home-section .mf-home-card');
            if (firstCard) firstCard.focus();
        }, 250);
        return;
    }

    // 9. Se estiver na aba Inicio, mas a tela foi rolada para baixo
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (scrollY > 150) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const heroPlay = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
        if (heroPlay) {
            heroPlay.focus();
        } else {
            const firstCard = document.querySelector('.mf-home-section .mf-home-card');
            if (firstCard) firstCard.focus();
        }
        return;
    }

    // 10. Mover foco para o cabecalho
    const headerActive = document.activeElement && document.activeElement.closest('.skinHeader');
    if (!headerActive) {
        const topHeaderBtn = document.querySelector('.skinHeader .emby-tab-button-active, .skinHeader .emby-tab-button, .skinHeader .headerSearchButton');
        if (topHeaderBtn) {
            topHeaderBtn.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }

    // 11. Raiz absoluta: duplo clique para sair do aplicativo
    const now = Date.now();
    if (now - lastBackPressTime < 2500) {
        if (window.tizen?.application?.getCurrentApplication) {
            window.tizen.application.getCurrentApplication().exit();
        } else if (window.close) {
            window.close();
        }
    } else {
        lastBackPressTime = now;
        showTvToast('Pressione Voltar novamente para sair do aplicativo');
    }
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

    if (!window.__mfSpatialNavRegistered) {
        window.__mfSpatialNavRegistered = true;
        window.addEventListener('keydown', handleSpatialNavigation, true);
    }
    if (!window.__mfBackRegistered) {
        window.__mfBackRegistered = true;
        window.addEventListener('keydown', handleTvBackButton, false);
    }

    // Auto-foco repetido em intervalos para garantir deteccao apos carregamento de rede
    [150, 400, 800, 1500, 2500].forEach(ms => {
        setTimeout(autoFocusCurrentView, ms);
    });

    window.addEventListener('hashchange', () => {
        if (!window.location.hash.startsWith('#/video') && !document.querySelector('.mf-cinema-player')) {
            if (window.MatheusFlix && typeof window.MatheusFlix.stopAllMedia === 'function') {
                window.MatheusFlix.stopAllMedia();
            }
            document.querySelectorAll('video, audio').forEach(v => {
                try { v.pause(); v.muted = true; v.volume = 0; v.removeAttribute('src'); v.src = ''; v.load(); } catch (_) {}
            });
        }
        [150, 400, 800].forEach(ms => setTimeout(autoFocusCurrentView, ms));
    });

    window.addEventListener('popstate', () => {
        if (!window.location.hash.startsWith('#/video') && !document.querySelector('.mf-cinema-player')) {
            if (window.MatheusFlix && typeof window.MatheusFlix.stopAllMedia === 'function') {
                window.MatheusFlix.stopAllMedia();
            }
            document.querySelectorAll('video, audio').forEach(v => {
                try { v.pause(); v.muted = true; v.volume = 0; v.removeAttribute('src'); v.src = ''; v.load(); } catch (_) {}
            });
        }
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