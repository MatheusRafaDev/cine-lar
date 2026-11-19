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
            'MediaPlay',
            'MediaPause',
            'MediaPlayPause',
            'MediaStop',
            'MediaFastForward',
            'MediaRewind',
            'MediaTrackPrevious',
            'MediaTrackNext',
            'ColorF0Red',
            'ColorF1Green',
            'ColorF2Yellow',
            'ColorF3Blue',
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
 * Auto-foco inteligente no primeiro elemento interativo relevante da tela
 */
export function autoFocusCurrentView() {
    if (typeof document === 'undefined') return;

    // Se o player estiver ativo, nao foca na tela de fundo
    if (document.querySelector('.mf-cinema-player')) return;

    // Se houver modal stremio ou confirmacao aberta, foca no botao principal do modal
    const modal = document.querySelector('.mf-stremio-modal, .mf-confirm-modal, .mf-quickconnect-overlay');
    if (modal) {
        const primaryBtn = modal.querySelector('.mf-btn-hero-watch, .mf-btn-confirm-yes, .mf-qc-cancel-btn, button.focusable, .focusable');
        if (primaryBtn && typeof primaryBtn.focus === 'function') {
            primaryBtn.focus();
            return;
        }
    }

    // Se ja ha um elemento focado que nao seja o body/html, respeita
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
        return;
    }

    // 1. Tenta focar no botao "Assistir" do Hero Banner da Home
    const heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
    if (heroBtn && heroBtn.offsetParent !== null) {
        heroBtn.focus();
        return;
    }

    // 2. Tenta focar no primeiro card visivel de filme
    const firstCard = document.querySelector('.mf-home-card, .mf-movie-card, .mf-local-card');
    if (firstCard && firstCard.offsetParent !== null) {
        firstCard.focus();
        return;
    }

    // 3. Fallback: foca no primeiro botao de navegacao do cabecalho
    const headerBtn = document.querySelector('.emby-tab-button-active, .mf-header-logo, .headerSearchButton');
    if (headerBtn && headerBtn.offsetParent !== null) {
        headerBtn.focus();
    }
}

/**
 * Gestao de ocultacao de cursor do mouse na TV (anti-giroscopio/mouse acidental)
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
 * Navegacao Espacial D-Pad inteligente entre linhas (carrosseis)
 */
function handleSpatialNavigation(e) {
    const key = e.key;
    const keyCode = e.keyCode || e.which || 0;

    // Apenas teclas direcionais
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) && ![37, 38, 39, 40].includes(keyCode)) {
        return;
    }

    const active = document.activeElement;
    if (!active) return;

    // Se o elemento ativo for um card de filme no carrossel
    if (active.classList?.contains('mf-home-card') || active.classList?.contains('mf-movie-card')) {
        const currentScroller = active.closest('.mf-home-scroller, .mf-row-slider-container');
        const currentSection = active.closest('.mf-home-section, .section');

        // Seta para BAIXO: Encontrar o card verticalmente mais proximo na linha de baixo
        if (key === 'ArrowDown' || keyCode === 40) {
            const nextSection = currentSection ? currentSection.nextElementSibling : null;
            if (nextSection) {
                const nextCards = Array.from(nextSection.querySelectorAll('.mf-home-card, .mf-movie-card'));
                if (nextCards.length > 0) {
                    e.preventDefault();
                    const activeRect = active.getBoundingClientRect();
                    const activeMidX = activeRect.left + (activeRect.width / 2);

                    // Busca o card que tem o centro horizontal mais proximo
                    let closestCard = nextCards[0];
                    let minDiff = Infinity;
                    nextCards.forEach(c => {
                        const r = c.getBoundingClientRect();
                        const midX = r.left + (r.width / 2);
                        const diff = Math.abs(activeMidX - midX);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestCard = c;
                        }
                    });

                    closestCard.focus();
                    closestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    return;
                }
            }
        }

        // Seta para CIMA: Subir para a linha anterior ou Hero Banner
        if (key === 'ArrowUp' || keyCode === 38) {
            const prevSection = currentSection ? currentSection.previousElementSibling : null;
            if (prevSection && prevSection.classList?.contains('mf-home-section')) {
                const prevCards = Array.from(prevSection.querySelectorAll('.mf-home-card, .mf-movie-card'));
                if (prevCards.length > 0) {
                    e.preventDefault();
                    const activeRect = active.getBoundingClientRect();
                    const activeMidX = activeRect.left + (activeRect.width / 2);

                    let closestCard = prevCards[0];
                    let minDiff = Infinity;
                    prevCards.forEach(c => {
                        const r = c.getBoundingClientRect();
                        const midX = r.left + (r.width / 2);
                        const diff = Math.abs(activeMidX - midX);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestCard = c;
                        }
                    });

                    closestCard.focus();
                    closestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    return;
                }
            } else {
                // Subir para o Hero Banner ou Cabecalho
                const heroBtn = document.querySelector('.mf-btn-hero-play, .mf-btn-hero-primary');
                if (heroBtn) {
                    e.preventDefault();
                    heroBtn.focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                const headerTab = document.querySelector('.emby-tab-button-active, .mf-header-logo');
                if (headerTab) {
                    e.preventDefault();
                    headerTab.focus();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
            }
        }
    }

    // Se estiver no Hero Banner e apertar BAIXO: desce para o primeiro card da primeira fileira
    if (active.classList?.contains('mf-btn-hero-play') || active.classList?.contains('mf-btn-hero-info') || active.closest('.mf-hero-buttons')) {
        if (key === 'ArrowDown' || keyCode === 40) {
            const firstCard = document.querySelector('.mf-home-card, .mf-movie-card');
            if (firstCard) {
                e.preventDefault();
                firstCard.focus();
                firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                return;
            }
        }
    }
}

/**
 * Tratamento global do botao Voltar do controle remoto (Tizen 10009, WebOS 461, Esc 27)
 */
function handleTvBackButton(e) {
    const key = e.key;
    const keyCode = e.keyCode || e.which || 0;
    const isBack = ['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(key)
        || keyCode === 10009 || keyCode === 461 || keyCode === 27;

    if (!isBack) return;

    // Se estiver em campo de texto (busca/input), deixa o comportamento padrao fechar o teclado
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
    }

    // 1. Se o Cinema Player estiver em execucao, o player ja trata seu proprio fechamento
    if (document.querySelector('.mf-cinema-player')) {
        return;
    }

    // 2. Se houver modal de detalhes Stremio ou confirmacao aberto, fecha o modal
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

    // 3. Se estiver em pagina secundária, volta para o Inicio
    const currentHash = window.location.hash || '';
    if (currentHash && !currentHash.startsWith('#/home') && currentHash !== '#/') {
        e.preventDefault();
        window.location.hash = '#/home?tab=0';
        return;
    }

    // 4. Se ja estiver na Home, exibe dialogo elegante de confirmacao para sair do App
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

    // Eventos de navegacao espacial e botoes
    window.addEventListener('keydown', handleSpatialNavigation, true);
    window.addEventListener('keydown', handleTvBackButton, false);

    // Garante rolagem suave quando qualquer elemento ganha foco
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.classList?.contains('focusable') && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, true);

    // Auto-foco ao carregar paginas ou trocar rotas
    window.addEventListener('hashchange', () => {
        setTimeout(autoFocusCurrentView, 400);
    });

    document.addEventListener('viewshow', () => {
        setTimeout(autoFocusCurrentView, 400);
    });

    setTimeout(autoFocusCurrentView, 600);

    // API global no window para debug e controle
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

// Auto-execucao
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
    autoFocusCurrentView
};
