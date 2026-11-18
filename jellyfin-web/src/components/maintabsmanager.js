import dom from '../utils/dom';
import browser from '../scripts/browser';
import Events from '../utils/events.ts';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';

let tabOwnerView;
const queryScope = document.querySelector('.skinHeader');
let headerTabsContainer;
let tabsElem;

function ensureElements() {
    if (!headerTabsContainer || !headerTabsContainer.isConnected) {
        headerTabsContainer = document.querySelector('.skinHeader .headerTabs') || document.querySelector('.headerTabs');
    }
}

function onViewTabsReady() {
    this.selectedIndex(this.readySelectedIndex);
    this.readySelectedIndex = null;
}

function allowSwipe(target) {
    function allowSwipeOn(elem) {
        if (dom.parentWithTag(elem, 'input')) {
            return false;
        }

        const classList = elem.classList;
        if (classList) {
            return !classList.contains('scrollX') && !classList.contains('animatedScrollX');
        }

        return true;
    }

    let parent = target;
    while (parent != null) {
        if (!allowSwipeOn(parent)) {
            return false;
        }
        parent = parent.parentNode;
    }

    return true;
}

function configureSwipeTabs(view, currentElement) {
    if (!browser.touch) {
        return;
    }

    // implement without hammer
    const onSwipeLeft = function (e, target) {
        if (allowSwipe(target) && view.contains(target)) {
            currentElement.selectNext();
        }
    };

    const onSwipeRight = function (e, target) {
        if (allowSwipe(target) && view.contains(target)) {
            currentElement.selectPrevious();
        }
    };

    import('../scripts/touchHelper').then(({ default: TouchHelper }) => {
        const touchHelper = new TouchHelper(view.parentNode.parentNode);

        Events.on(touchHelper, 'swipeleft', onSwipeLeft);
        Events.on(touchHelper, 'swiperight', onSwipeRight);

        view.addEventListener('viewdestroy', function () {
            touchHelper.destroy();
        });
    });
}

const MATHEUSFLIX_GLOBAL_TABS = [
    { name: 'Início', href: '#/home?tab=0' },
    { name: 'Torrents', href: '#/home?tab=1' },
    { name: 'Pasta Local', href: '#/home?tab=2' },
    { name: 'Downloads', href: '#/home?tab=3' }
];

export function renderMatheusFlixDefaultTabs(activeIdx = null) {
    ensureElements();
    if (!headerTabsContainer) return;

    headerTabsContainer.classList.remove('hide');
    document.body.classList.add('withSectionTabs');

    const currentHash = window.location.hash || '';
    const isProfile = currentHash.includes('mypreferencesmenu') || currentHash.includes('/settings') || currentHash.includes('/user');
    if (isProfile) {
        activeIdx = null;
    } else if (activeIdx == null) {
        if (currentHash.includes('tab=1')) activeIdx = 1;
        else if (currentHash.includes('tab=2')) activeIdx = 2;
        else if (currentHash.includes('tab=3')) activeIdx = 3;
        else if (currentHash.includes('/item')) {
            activeIdx = null;
        } else if (currentHash.includes('/home') || currentHash === '' || currentHash === '#/') {
            activeIdx = 0;
        } else {
            activeIdx = null;
        }
    }

    const tabsItems = MATHEUSFLIX_GLOBAL_TABS.map((t, idx) => {
        const isActive = activeIdx !== null && activeIdx !== undefined && Number(activeIdx) === idx;
        const activeClass = isActive ? ' emby-tab-button-active' : '';
        return `<a href="${t.href}" is="emby-linkbutton" class="emby-tab-button${activeClass}" data-index="${idx}"><div class="emby-button-foreground">${t.name}</div></a>`;
    }).join('');
    const indexAttr = (activeIdx != null && activeIdx !== undefined) ? ` data-index="${activeIdx}"` : ' data-index="-1"';
    const tabsHtml = `<div is="emby-tabs"${indexAttr} class="tabs-viewmenubar"><div class="emby-tabs-slider" style="white-space:nowrap;">${tabsItems}</div></div>`;

    headerTabsContainer.innerHTML = tabsHtml;
    window.CustomElements.upgradeSubtree(headerTabsContainer);
    tabsElem = headerTabsContainer.querySelector('[is="emby-tabs"]');

    if (activeIdx == null) {
        headerTabsContainer.querySelectorAll('.emby-tab-button').forEach(btn => {
            btn.classList.remove('emby-tab-button-active');
        });
    }

    headerTabsContainer.querySelectorAll('.emby-tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
                window.MatheusFlix.closeCinema();
            }
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            if (!isNaN(idx)) {
                const homeView = document.querySelector('#indexPage');
                if (homeView) {
                    homeView.querySelectorAll('.tabContent').forEach((tc, i) => {
                        if (i === idx) tc.classList.add('is-active');
                        else tc.classList.remove('is-active');
                    });
                }
            }
        });
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '';
        const isHome = hash.includes('/home') || hash === '' || hash === '#/' || hash === '#';
        if (!isHome) {
            tabOwnerView = null;
            renderMatheusFlixDefaultTabs(null);
        } else if (!tabOwnerView) {
            renderMatheusFlixDefaultTabs();
        }
    });
}

export function setTabs(view, selectedIndex, getTabsFn, getTabContainersFn, onBeforeTabChange, onTabChange, setSelectedIndex) {
    ensureElements();

    if (!view) {
        if (tabOwnerView) {
            tabOwnerView = null;
        }

        renderMatheusFlixDefaultTabs();

        return {
            tabsContainer: headerTabsContainer,
            replaced: false
        };
    }

    const tabsContainerElem = headerTabsContainer;

    if (!tabOwnerView) {
        tabsContainerElem.classList.remove('hide');
    }

    if (tabOwnerView !== view) {
        let index = 0;

        const indexAttribute = selectedIndex == null ? '' : (' data-index="' + selectedIndex + '"');
        const tabsHtml = '<div is="emby-tabs"' + indexAttribute + ' class="tabs-viewmenubar"><div class="emby-tabs-slider" style="white-space:nowrap;">' + getTabsFn().map(function (t) {
            let tabClass = 'emby-tab-button';

            if (t.enabled === false) {
                tabClass += ' hide';
            }

            let tabHtml;

            if (t.cssClass) {
                tabClass += ' ' + t.cssClass;
            }

            if (t.href) {
                tabHtml = '<a href="' + t.href + '" is="emby-linkbutton" class="' + tabClass + '" data-index="' + index + '"><div class="emby-button-foreground">' + t.name + '</div></a>';
            } else {
                tabHtml = '<button type="button" is="emby-button" class="' + tabClass + '" data-index="' + index + '"><div class="emby-button-foreground">' + t.name + '</div></button>';
            }

            index++;
            return tabHtml;
        }).join('') + '</div></div>';

        tabsContainerElem.innerHTML = tabsHtml;
        window.CustomElements.upgradeSubtree(tabsContainerElem);

        document.body.classList.add('withSectionTabs');
        tabOwnerView = view;

        tabsElem = tabsContainerElem.querySelector('[is="emby-tabs"]');

        configureSwipeTabs(view, tabsElem);

        if (getTabContainersFn) {
            const initialContainers = getTabContainersFn();
            const initIdx = selectedIndex != null ? selectedIndex : 0;
            if (initialContainers && initialContainers[initIdx]) {
                initialContainers[initIdx].classList.add('is-active');
            }

            tabsElem.addEventListener('beforetabchange', function (e) {
                const tabContainers = getTabContainersFn();
                if (e.detail.previousIndex != null) {
                    const previousPanel = tabContainers[e.detail.previousIndex];
                    if (previousPanel) {
                        previousPanel.classList.remove('is-active');
                    }
                }

                const newPanel = tabContainers[e.detail.selectedTabIndex];

                if (newPanel) {
                    newPanel.classList.add('is-active');
                }
            });
        }

        if (onBeforeTabChange) {
            tabsElem.addEventListener('beforetabchange', onBeforeTabChange);
        }
        if (onTabChange) {
            tabsElem.addEventListener('tabchange', onTabChange);
        }

        if (setSelectedIndex !== false) {
            if (tabsElem.selectedIndex) {
                tabsElem.selectedIndex(selectedIndex);
            } else {
                tabsElem.readySelectedIndex = selectedIndex;
                tabsElem.addEventListener('ready', onViewTabsReady);
            }
        }

        return {
            tabsContainer: tabsContainerElem,
            tabs: tabsElem,
            replaced: true
        };
    }

    tabsElem.selectedIndex(selectedIndex);

    return {
        tabsContainer: tabsContainerElem,
        tabs: tabsElem,
        replaced: false
    };
}

export function selectedTabIndex(index) {
    if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
        window.MatheusFlix.closeCinema();
    }
    if (index != null) {
        tabsElem.selectedIndex(index);
    } else {
        tabsElem.triggerTabChange();
    }
}

export function getTabsElement() {
    return document.querySelector('.tabs-viewmenubar');
}
