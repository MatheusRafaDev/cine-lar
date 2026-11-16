/**
 * MatheusFlix - Stremio Tab Controller
 * Controlador nativo da aba de Torrents e Stremio embutida no Jellyfin.
 */

import { renderStreamingView } from './streamingView';

class StremioTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.container = view.querySelector('.mf-embedded-tab-content');
        this.rendered = false;
        this.lastHash = '';

        this.onHashChange = () => {
            const h = window.location.hash || '';
            if (h.includes('tab=1') && this.lastHash !== h) {
                this.onResume({ refresh: true });
            }
        };
        window.addEventListener('hashchange', this.onHashChange);
    }

    onResume(options = {}) {
        const container = this.view?.querySelector('.mf-embedded-tab-content') || this.container || this.view;
        const currentHash = window.location.hash || '';
        if (container && (!this.rendered || options.refresh || this.lastHash !== currentHash)) {
            this.lastHash = currentHash;
            renderStreamingView(container);
            this.rendered = true;
            this.container = container;
        }
        return Promise.resolve();
    }

    onPause() {
        // Paused state
    }

    destroy() {
        if (this.onHashChange) {
            window.removeEventListener('hashchange', this.onHashChange);
        }
        this.view = null;
        this.container = null;
        this.rendered = false;
    }
}

export default StremioTab;

