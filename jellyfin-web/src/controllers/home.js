import TabbedView from '../components/tabbedview/tabbedview';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';
import '../elements/emby-scroller/emby-scroller';
import LibraryMenu from '../scripts/libraryMenu';

class HomeView extends TabbedView {
    setTitle() {
        LibraryMenu.setTitle(null);
    }

    onPause() {
        super.onPause(this);
        document.querySelector('.skinHeader').classList.remove('noHomeButtonHeader');
    }

    onResume(options) {
        super.onResume(this, options);
        document.querySelector('.skinHeader').classList.add('noHomeButtonHeader');
    }

    getDefaultTabIndex() {
        return 0;
    }

    getTabs() {
        return [{
            name: 'Início'
        }, {
            name: 'Torrents'
        }, {
            name: 'Pasta Local'
        }, {
            name: 'Downloads'
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
