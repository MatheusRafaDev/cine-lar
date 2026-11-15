/**
 * MatheusFlix - Experiência Híbrida Embutida: Stremio & Pasta Local (D:\filmes)
 * Totalmente integrada às rotas e abas do sistema Jellyfin (sem janelas modais flutuantes).
 */

import { fetchDownloads } from './matheusflix/api';
import { openCinemaPlayer } from './matheusflix/cinemaPlayer';

let activeDownloadsCache = [];
let pollInterval = null;

export function navigateToTab(tabIndex) {
    const isHome = window.location.hash.startsWith('#/home') || window.location.hash === '' || window.location.hash === '#/';
    if (isHome) {
        import('components/maintabsmanager').then(m => {
            try {
                m.selectedTabIndex(tabIndex);
            } catch {
                import('components/router/appRouter').then(r => {
                    const router = r.default || r.appRouter || r;
                    router.show(`/home?tab=${tabIndex}`);
                });
            }
        });
    } else {
        import('components/router/appRouter').then(m => {
            const router = m.default || m.appRouter || m;
            router.show(`/home?tab=${tabIndex}`);
        });
    }
}

export function openModal(initialTab = 'streaming') {
    let idx = 1;
    if (initialTab === 'local') idx = 2;
    navigateToTab(idx);
}

export function closeModal() {
    // Embutido diretamente no sistema - sem modal para fechar
}

export function init() {
    console.log('[MatheusFlix] Inicializando Navegação Embutida...');

    if (typeof window !== 'undefined') {
        window.MatheusFlix = window.MatheusFlix || {};
        window.MatheusFlix.navigateToTab = navigateToTab;
        window.MatheusFlix.openTorrentHub = () => navigateToTab(1);
        window.MatheusFlix.openStreaming = () => navigateToTab(1);
        window.MatheusFlix.openLocalFolder = () => navigateToTab(2);
        window.MatheusFlix.openDownloads = () => navigateToTab(3);
        window.MatheusFlix.getDownloads = () => activeDownloadsCache;
        window.MatheusFlix.playCinema = openCinemaPlayer;
    }

    startPolling();
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        try {
            const data = await fetchDownloads();
            activeDownloadsCache = data.downloads || [];
        } catch {
            // Polling error ignored
        }
    }, 4000);
}

// Auto init on module load
if (typeof window !== 'undefined') {
    init();
}
