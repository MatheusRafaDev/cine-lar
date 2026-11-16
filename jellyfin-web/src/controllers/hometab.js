import loading from '../components/loading/loading';
import focusManager from '../components/focusManager';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { embedMatheusFlixHomeSections } from '../scripts/matheusflix/homeSectionsEmbed';

import '../elements/emby-itemscontainer/emby-itemscontainer';

class HomeTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient();
        this.sectionsContainer = view.querySelector('.sections');
        view.querySelector('.sections')?.addEventListener('settingschange', onHomeScreenSettingsChanged.bind(this));
    }
    onResume(options = {}) {
        if (this.sectionsRendered) {
            embedMatheusFlixHomeSections(this.view);
            return Promise.resolve();
        }

        loading.show();
        const view = this.view;
        this.destroyHomeSections();
        this.sectionsRendered = true;
        return embedMatheusFlixHomeSections(view)
            .then(() => {
                if (options?.autoFocus) {
                    focusManager.autoFocus(view);
                }
            }).catch(err => {
                console.error('[HomeTab] Error rendering MatheusFlix sections:', err);
            }).finally(() => {
                loading.hide();
            });
    }
    onPause() {
        // Nada para pausar
    }
    destroy() {
        this.view = null;
        this.params = null;
        this.apiClient = null;
        this.destroyHomeSections();
        this.sectionsContainer = null;
    }
    destroyHomeSections() {
        // Limpa seções se necessário
    }
}

function onHomeScreenSettingsChanged() {
    this.sectionsRendered = false;

    if (!this.paused) {
        this.onResume({
            refresh: true
        });
    }
}

export default HomeTab;
