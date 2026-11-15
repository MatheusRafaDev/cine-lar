/**
 * MatheusFlix - Downloads Tab Controller
 * Controlador nativo da aba de Downloads embutida no Jellyfin.
 */

import { renderDownloadsView } from './downloadsView';

class DownloadsTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.container = view.querySelector('.mf-embedded-tab-content');
        this.rendered = false;
    }

    onResume(options = {}) {
        const container = this.view?.querySelector('.mf-embedded-tab-content') || this.container || this.view;
        if (container && (!this.rendered || options.refresh)) {
            renderDownloadsView(container);
            this.rendered = true;
            this.container = container;
        }
        return Promise.resolve();
    }

    onPause() {
        // Paused state
    }

    destroy() {
        this.view = null;
        this.container = null;
        this.rendered = false;
    }
}

export default DownloadsTab;
