import TabbedView from '../components/tabbedview/tabbedview';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';
import '../elements/emby-scroller/emby-scroller';
import LibraryMenu from '../scripts/libraryMenu';

class HomeView extends TabbedView {
    constructor(view, params) {
        super(view, params);

        this._switchTabTo = (targetIndex) => {
            if (!this.view) return;
            const tabContainers = this.view.querySelectorAll('.tabContent');
            tabContainers.forEach((tc, idx) => {
                if (idx === targetIndex) {
                    tc.classList.add('is-active');
                } else {
                    tc.classList.remove('is-active');
                }
            });

            this.getTabController(targetIndex).then((controller) => {
                if (controller?.onResume) {
                    controller.onResume({ refresh: false });
                }
            });
        };

        this._onHashChange = () => {
            const hash = window.location.hash || '';
            if (!hash.includes('/home')) return;

            let targetIndex = 0;
            if (hash.includes('tab=1')) targetIndex = 1;
            else if (hash.includes('tab=2')) targetIndex = 2;
            else if (hash.includes('tab=3')) targetIndex = 3;

            this._switchTabTo(targetIndex);
        };

        window.addEventListener('hashchange', this._onHashChange);
    }

    setTitle() {
        LibraryMenu.setTitle(null);
    }

    onPause() {
        super.onPause();
        document.querySelector('.skinHeader')?.classList.remove('noHomeButtonHeader');
    }

    onResume(options) {
        super.onResume(options);
        document.querySelector('.skinHeader')?.classList.add('noHomeButtonHeader');

        const hash = window.location.hash || '';
        let targetIndex = 0;
        if (hash.includes('tab=1')) targetIndex = 1;
        else if (hash.includes('tab=2')) targetIndex = 2;
        else if (hash.includes('tab=3')) targetIndex = 3;
        else if (this.params?.tab != null) targetIndex = parseInt(this.params.tab, 10);

        this._switchTabTo(targetIndex);
    }

    destroy() {
        if (this._onHashChange) {
            window.removeEventListener('hashchange', this._onHashChange);
        }
    }

    getDefaultTabIndex() {
        return 0;
    }

    getTabs() {
        return [{
            name: 'Início',
            href: '#/home?tab=0'
        }, {
            name: 'Torrents',
            href: '#/home?tab=1'
        }, {
            name: 'Pasta Local',
            href: '#/home?tab=2'
        }, {
            name: 'Downloads',
            href: '#/home?tab=3'
        }];
    }

    getTabController(index) {
        if (index == null) {
            throw new Error('index cannot be null');
        }

        let loader = null;

        switch (index) {
            case 0:
                loader = import(/* webpackChunkName: "hometab" */ './hometab');
                break;

            case 1:
                loader = import(/* webpackChunkName: "stremioTab" */ '../scripts/matheusflix/stremioTab');
                break;

            case 2:
                loader = import(/* webpackChunkName: "localFolderTab" */ '../scripts/matheusflix/localFolderTab');
                break;

            case 3:
                loader = import(/* webpackChunkName: "downloadsTab" */ '../scripts/matheusflix/downloadsTab');
                break;

            default:
                throw new Error(`invalid tab index: ${index}`);
        }

        const instance = this;
        return loader.then(({ default: ControllerFactory }) => {
            let controller = instance.tabControllers[index];

            if (!controller) {
                controller = new ControllerFactory(instance.view.querySelector(".tabContent[data-index='" + index + "']"), instance.params);
                instance.tabControllers[index] = controller;
            }

            return controller;
        });
    }
}

export default HomeView;
