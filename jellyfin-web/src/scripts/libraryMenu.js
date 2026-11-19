import escapeHtml from 'escape-html';
import Headroom from 'headroom.js';
// NOTE: Used for jsdoc
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApiClient } from 'jellyfin-apiclient';

import { AppFeature } from 'constants/appFeature';
import { getUserViewsQuery } from 'hooks/useUserViews';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { EventType } from 'constants/eventType';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import dom from '../utils/dom';
import layoutManager from '../components/layoutManager';
import inputManager from './inputManager';
import viewManager from '../components/viewManager/viewManager';
import { appRouter } from '../components/router/appRouter';
import { appHost } from '../components/apphost';
import { playbackManager } from '../components/playback/playbackmanager';
import browser from './browser';
import imageHelper from '../utils/image';
import { getMenuLinks } from '../scripts/settings/webSettings';
import Dashboard, { pageClassOn } from '../utils/dashboard';
import Events from '../utils/events.ts';
import { getParameterByName } from '../utils/url.ts';
import datetime from '../scripts/datetime';

import '../elements/emby-button/paper-icon-button-light';

import 'material-design-icons-iconfont';
import '../styles/scrollstyles.scss';
import '../styles/flexstyles.scss';

function renderHeader() {
    let html = '';
    html += '<div class="flex align-items-center flex-grow headerTop">';
    html += '<div class="headerLeft">';
    html += '<button type="button" is="paper-icon-button-light" class="headerButton headerButtonLeft headerBackButton hide" aria-label="Voltar"><span class="material-icons ' + (browser.safari ? 'chevron_left' : 'arrow_back') + '" aria-hidden="true"></span></button>';
    html += '<div class="mf-header-logo focusable" role="button" tabindex="0" title="MatheusFlix - Início" aria-label="MatheusFlix">';
    html += '<svg class="mf-logo-badge" width="36" height="36" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="hdrLogoG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E50914" /><stop offset="100%" stop-color="#D97757" /></linearGradient></defs><rect width="92" height="92" x="4" y="4" rx="26" fill="url(#hdrLogoG)" /><path d="M 28 25 L 40 25 L 50 47 L 60 25 L 72 25 L 72 75 L 61 75 L 61 41 L 54 57 L 46 57 L 39 41 L 39 75 L 28 75 Z" fill="#141413" /></svg>';
    html += '<span class="mf-logo-wordmark">MATHEUS<b>FLIX</b></span>';
    html += '</div>';
    html += '<h3 class="pageTitle hide" aria-hidden="true"></h3>';
    html += '<div class="headerTabs sectionTabs"></div>';
    html += '</div>';
    html += '<div class="headerRight">';
    html += '<button type="button" is="paper-icon-button-light" class="headerButton headerButtonRight headerSearchButton" aria-label="Buscar"><span class="material-icons search" aria-hidden="true"></span></button>';
    html += '<button type="button" is="paper-icon-button-light" class="headerButton headerButtonRight headerHelpButton" aria-label="Atalhos" title="Atalhos do Controle e Teclado (?)"><span class="material-icons help_outline" aria-hidden="true"></span></button>';
    html += '<button is="paper-icon-button-light" class="headerButton headerButtonRight headerUserButton" aria-label="Perfil"></button>';
    html += '<div class="currentTimeText hide"></div>';
    html += '</div>';
    html += '</div>';

    skinHeader.classList.add('skinHeader-withBackground');
    skinHeader.classList.add('skinHeader-blurred');
    skinHeader.innerHTML = html;

    // MatheusFlix: assegurar remoção completa de qualquer nuvem/discover/hamburguer/casinha residual
    const residuals = skinHeader.querySelectorAll('.matheusflixDiscoverBtn, .cloud_download, .mainDrawerButton, .barsMenuButton, .headerHomeButton, .headerCastButton, .castButton, button:has(.material-icons.menu), button:has(.material-icons.home)');
    residuals.forEach((el) => {
        const btn = el.closest('button') || el;
        btn.remove();
    });

    Events.trigger(document, EventType.HEADER_RENDERED);

    headerBackButton = skinHeader.querySelector('.headerBackButton');
    headerHomeButton = null;
    mainDrawerButton = null;
    headerUserButton = skinHeader.querySelector('.headerUserButton');
    headerCastButton = skinHeader.querySelector('.headerCastButton');
    headerAudioPlayerButton = skinHeader.querySelector('.headerAudioPlayerButton');
    headerSearchButton = skinHeader.querySelector('.headerSearchButton');
    headerSyncButton = skinHeader.querySelector('.headerSyncButton');
    currentTimeText = skinHeader.querySelector('.currentTimeText');

    const headerLogo = skinHeader.querySelector('.mf-header-logo');
    if (headerLogo) {
        const goHome = () => {
            if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
                window.MatheusFlix.closeCinema();
            }
            window.location.hash = '#/home?tab=0';
        };
        headerLogo.addEventListener('click', goHome);
        headerLogo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goHome();
            }
        });
    }

    const pageTitleElem = skinHeader.querySelector('.pageTitle');
    if (pageTitleElem) {
        pageTitleElem.style.cursor = 'pointer';
        pageTitleElem.addEventListener('click', () => {
            if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
                window.MatheusFlix.closeCinema();
            }
            window.location.hash = '#/home?tab=0';
        });
    }

    import('../components/maintabsmanager').then((mainTabsManager) => {
        mainTabsManager.renderMatheusFlixDefaultTabs();
    });

    retranslateUi();
    lazyLoadViewMenuBarImages();
    bindMenuEvents();
    updateCastIcon();
    updateClock();
}

function getCurrentApiClient() {
    if (currentUser?.localUser) {
        return ServerConnections.getApiClient(currentUser.localUser.ServerId);
    }

    return ServerConnections.currentApiClient();
}

function lazyLoadViewMenuBarImages() {
    import('../components/images/imageLoader').then((imageLoader) => {
        imageLoader.lazyChildren(skinHeader);
    });
}

function onBackClick() {
    if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
        window.MatheusFlix.closeCinema();
    }
    if (appRouter.canGoBack()) {
        appRouter.back();
    } else {
        window.location.hash = '#/home?tab=0';
    }
}

function retranslateUi() {
    if (headerBackButton) {
        headerBackButton.title = globalize.translate('ButtonBack');
    }

    if (headerHomeButton) {
        headerHomeButton.title = globalize.translate('Home');
    }

    if (mainDrawerButton) {
        mainDrawerButton.title = globalize.translate('Menu');
    }

    if (headerSyncButton) {
        headerSyncButton.title = globalize.translate('ButtonSyncPlay');
    }

    if (headerAudioPlayerButton) {
        headerAudioPlayerButton.title = globalize.translate('ButtonPlayer');
    }

    if (headerCastButton) {
        headerCastButton.title = globalize.translate('ButtonCast');
    }

    if (headerSearchButton) {
        headerSearchButton.title = globalize.translate('Search');
    }

    if (headerUserButton) {
        headerUserButton.title = globalize.translate('Settings');
    }
}

function updateUserInHeader(user) {
    retranslateUi();

    let hasImage;

    if (user?.name) {
        if (user.imageUrl) {
            const url = user.imageUrl;
            updateHeaderUserButton(url);
            hasImage = true;
        }
        if (headerUserButton) {
            headerUserButton.title = user.name;
            headerUserButton.classList.remove('hide');
        }
    } else {
        if (headerUserButton) {
            headerUserButton.classList.add('hide');
        }
    }

    if (!hasImage) {
        updateHeaderUserButton(null);
    }

    if (user?.localUser) {
        if (headerSearchButton) {
            headerSearchButton.classList.remove('hide');
        }

        // MatheusFlix: Botão de Cast/Transmitir na TV desativado
        if (headerCastButton) {
            headerCastButton.classList.add('hide');
        }

        // MatheusFlix: Grupos (SyncPlay) desativados por simplificação da interface
        if (headerSyncButton) {
            headerSyncButton.classList.add('hide');
        }

        // MatheusFlix: assegurar remoção completa de qualquer residual (hamburguer, home, nuvem)
        skinHeader.querySelectorAll('.matheusflixDiscoverBtn, .cloud_download, .mainDrawerButton, .barsMenuButton, .headerHomeButton, button:has(.material-icons.menu), button:has(.material-icons.home)').forEach((el) => {
            const btn = el.closest('button') || el;
            btn.remove();
        });
    } else {
        if (headerCastButton) {
            headerCastButton.classList.add('hide');
        }
        if (headerSyncButton) {
            headerSyncButton.classList.add('hide');
        }

        if (headerSearchButton) {
            headerSearchButton.classList.add('hide');
        }
    }

    requiresUserRefresh = false;
}

function updateHeaderActiveNavigation() {
    const hash = window.location.hash || '';
    const isProfilePage = hash.includes('mypreferencesmenu') ||
                          hash.includes('/settings') ||
                          hash.includes('/user') ||
                          Boolean(document.querySelector('#myPreferencesMenuPage, .userPreferencesPage'));
    if (headerUserButton) {
        if (isProfilePage) {
            headerUserButton.classList.add('headerUserButtonActive');
            // Garantir que nenhuma aba principal (Início, Torrents, etc) fique destacada no Perfil
            const tabsContainer = skinHeader.querySelector('.headerTabs');
            if (tabsContainer) {
                tabsContainer.querySelectorAll('.emby-tab-button').forEach(btn => {
                    btn.classList.remove('emby-tab-button-active');
                });
            }
        } else {
            headerUserButton.classList.remove('headerUserButtonActive');
        }
    }
}

function updateHeaderUserButton(src) {
    if (!headerUserButton) {
        return;
    }

    const userName = currentUser?.Name || currentUser?.localUser?.Name || localStorage.getItem('mf_user_name') || 'R';
    const initial = userName.charAt(0).toUpperCase();

    if (src) {
        headerUserButton.classList.remove('mf-avatar-text');
        headerUserButton.innerHTML = '<div class="headerUserButtonImage" style="background-image:url(\'' + src + "');\"></div>";
    } else {
        headerUserButton.classList.add('mf-avatar-text');
        headerUserButton.innerHTML = '<span class="mf-avatar-initial">' + initial + '</span>';
    }
    updateHeaderActiveNavigation();
}

function updateClock() {
    if (!currentTimeText) {
        return;
    }

    if (layoutManager.tv) {
        currentTimeText.classList.remove('hide');
        setInterval(function() {
            currentTimeText.innerText = datetime.getDisplayTime(new Date());
        }, 1000);
    } else {
        currentTimeText.classList.add('hide');
    }
}

function showSearch() {
    if (typeof window !== 'undefined' && window.MatheusFlix?.closeCinema) {
        window.MatheusFlix.closeCinema();
    }
    window.location.hash = '#/home?tab=1';
    setTimeout(() => {
        const input = document.querySelector('.mf-search-input');
        if (input) {
            input.focus();
            input.select?.();
        }
    }, 180);
}

function onHeaderUserButtonClick() {
    Dashboard.navigate('mypreferencesmenu');
}

function onHeaderHomeButtonClick() {
    Dashboard.navigate('home');
}

function showAudioPlayer() {
    return appRouter.showNowPlaying();
}

function bindMenuEvents() {
    if (mainDrawerButton) {
        mainDrawerButton.addEventListener('click', toggleMainDrawer);
    }

    if (headerBackButton) {
        headerBackButton.addEventListener('click', onBackClick);
    }

    if (headerSearchButton) {
        headerSearchButton.addEventListener('click', showSearch);
    }

    const headerHelpButton = skinHeader.querySelector('.headerHelpButton');
    if (headerHelpButton) {
        headerHelpButton.addEventListener('click', () => {
            import('./matheusflix/shortcutsModal').then(m => m.openShortcutsModal());
        });
    }

    if (headerUserButton) {
        headerUserButton.addEventListener('click', onHeaderUserButtonClick);
    }

    if (headerHomeButton) {
        headerHomeButton.addEventListener('click', onHeaderHomeButtonClick);
    }

    if (!layoutManager.tv && headerCastButton) {
        headerCastButton.addEventListener('click', onCastButtonClicked);
    }

    if (headerAudioPlayerButton) {
        headerAudioPlayerButton.addEventListener('click', showAudioPlayer);
    }

    if (headerSyncButton) {
        headerSyncButton.addEventListener('click', onSyncButtonClicked);
    }

    if (layoutManager.mobile && skinHeader) {
        initHeadRoom(skinHeader);
    }
    Events.on(playbackManager, 'playbackstart', onPlaybackStart);
    Events.on(playbackManager, 'playbackstop', onPlaybackStop);
}

function onPlaybackStart() {
    if (!headerAudioPlayerButton) {
        return;
    }

    if (playbackManager.isPlayingAudio() && layoutManager.tv) {
        headerAudioPlayerButton.classList.remove('hide');
    } else {
        headerAudioPlayerButton.classList.add('hide');
    }
}

function onPlaybackStop(e, stopInfo) {
    if (!headerAudioPlayerButton) {
        return;
    }

    if (stopInfo.nextMediaType != 'Audio') {
        headerAudioPlayerButton.classList.add('hide');
    }
}

function onCastButtonClicked() {
    const btn = this;

    import('../components/playback/playerSelectionMenu').then((playerSelectionMenu) => {
        playerSelectionMenu.show(btn);
    });
}

function onSyncButtonClicked() {
    // SyncPlay / Grupos desativados
}

function getItemHref(item, context) {
    return appRouter.getRouteUrl(item, {
        context: context
    });
}

function toggleMainDrawer() {
    if (navDrawerInstance.isVisible) {
        closeMainDrawer();
    } else {
        openMainDrawer();
    }
}

function openMainDrawer() {
    navDrawerInstance.open();
}

function onMainDrawerOpened() {
    if (layoutManager.mobile) {
        document.body.classList.add('bodyWithPopupOpen');
    }
}

function closeMainDrawer() {
    navDrawerInstance.close();
}

function onMainDrawerSelect() {
    if (navDrawerInstance.isVisible) {
        onMainDrawerOpened();
    } else {
        document.body.classList.remove('bodyWithPopupOpen');
    }
}

function refreshLibraryInfoInDrawer(user) {
    let html = '';
    html += '<div style="height:.5em;"></div>';
    html += `<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder lnkNavHome" href="#/home?tab=0"><span class="material-icons navMenuOptionIcon home" aria-hidden="true"></span><span class="navMenuOptionText">${globalize.translate('Home')}</span></a>`;
    html += '<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder lnkNavStremio" href="#/home?tab=1"><span class="material-icons navMenuOptionIcon movie" aria-hidden="true"></span><span class="navMenuOptionText">Torrents</span></a>';
    html += '<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder lnkNavLocal" href="#/home?tab=2"><span class="material-icons navMenuOptionIcon folder" aria-hidden="true"></span><span class="navMenuOptionText">Pasta Local</span></a>';
    html += '<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder lnkNavDownloads" href="#/home?tab=3"><span class="material-icons navMenuOptionIcon download" aria-hidden="true"></span><span class="navMenuOptionText">Downloads</span></a>';

    // placeholder for custom menu links
    html += '<div class="customMenuOptions"></div>';

    // libraries are added here
    html += '<div class="libraryMenuOptions"></div>';

    if (user.localUser?.Policy.IsAdministrator) {
        html += '<div class="adminMenuOptions">';
        html += '<h3 class="sidebarHeader">';
        html += globalize.translate('HeaderAdmin');
        html += '</h3>';
        html += `<a is="emby-linkbutton" class="navMenuOption lnkManageServer" data-itemid="dashboard" href="#/dashboard"><span class="material-icons navMenuOptionIcon dashboard" aria-hidden="true"></span><span class="navMenuOptionText">${globalize.translate('TabDashboard')}</span></a>`;
        html += `<a is="emby-linkbutton" class="navMenuOption editorViewMenu" data-itemid="editor" href="#/metadata"><span class="material-icons navMenuOptionIcon mode_edit" aria-hidden="true"></span><span class="navMenuOptionText">${globalize.translate('MetadataManager')}</span></a>`;
        html += '</div>';
    }

    if (user.localUser) {
        html += '<div class="userMenuOptions">';
        html += '<h3 class="sidebarHeader">';
        html += globalize.translate('HeaderUser');
        html += '</h3>';

        html += `<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder btnSettings" data-itemid="settings" href="#"><span class="material-icons navMenuOptionIcon settings" aria-hidden="true"></span><span class="navMenuOptionText">${globalize.translate('Settings')}</span></a>`;

        if (appHost.supports(AppFeature.ExitMenu)) {
            html += `<a is="emby-linkbutton" class="navMenuOption lnkMediaFolder exitApp" data-itemid="exitapp" href="#"><span class="material-icons navMenuOptionIcon close" aria-hidden="true"></span><span class="navMenuOptionText">${globalize.translate('ButtonExitApp')}</span></a>`;
        }

        html += '</div>';
    }

    // add buttons to navigation drawer
    navDrawerScrollContainer.innerHTML = html;

    const bindDrawerTab = (selector, tabIndex) => {
        const btn = navDrawerScrollContainer.querySelector(selector);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeMainDrawer();
                if (window.MatheusFlix?.navigateToTab) {
                    window.MatheusFlix.navigateToTab(tabIndex);
                }
            });
        }
    };

    bindDrawerTab('.lnkNavHome', 0);
    bindDrawerTab('.lnkNavStremio', 1);
    bindDrawerTab('.lnkNavLocal', 2);
    bindDrawerTab('.lnkNavDownloads', 3);

    const btnSelectServer = navDrawerScrollContainer.querySelector('.btnSelectServer');
    if (btnSelectServer) {
        btnSelectServer.addEventListener('click', onSelectServerClick);
    }

    const btnSettings = navDrawerScrollContainer.querySelector('.btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', onSettingsClick);
    }

    const btnExit = navDrawerScrollContainer.querySelector('.exitApp');
    if (btnExit) {
        btnExit.addEventListener('click', onExitAppClick);
    }
}

function onSidebarLinkClick() {
    const section = this.getElementsByClassName('sectionName')[0];
    const text = section ? section.innerHTML : this.innerHTML;
    LibraryMenu.setTitle(text);
}

function getUserViews(apiClient, userId) {
    return queryClient
        .fetchQuery(getUserViewsQuery(toApi(apiClient), userId))
        .then(function (result) {
            const items = result.Items;
            const list = [];

            for (let i = 0, length = items.length; i < length; i++) {
                const view = items[i];
                list.push(view);

                if (view.CollectionType == 'livetv') {
                    view.icon = 'live_tv';
                    const guideView = Object.assign({}, view);
                    guideView.Name = globalize.translate('Guide');
                    guideView.ImageTags = {};
                    guideView.icon = 'dvr';
                    guideView.url = '#/livetv?tab=1';
                    list.push(guideView);
                }
            }

            return list;
        });
}

function showBySelector(selector, show) {
    const elem = document.querySelector(selector);

    if (elem) {
        if (show) {
            elem.classList.remove('hide');
        } else {
            elem.classList.add('hide');
        }
    }
}

function updateLibraryMenu(user) {
    if (!user) {
        showBySelector('.userMenuOptions', false);
        return;
    }

    const userId = Dashboard.getCurrentUserId();
    const apiClient = getCurrentApiClient();

    const customMenuOptions = document.querySelector('.customMenuOptions');
    if (customMenuOptions) {
        getMenuLinks().then(links => {
            links.forEach(link => {
                const option = document.createElement('a', 'emby-linkbutton');
                option.classList.add('navMenuOption', 'lnkMediaFolder');
                option.rel = 'noopener noreferrer';
                option.target = '_blank';
                option.href = link.url;

                const icon = document.createElement('span');
                icon.className = `material-icons navMenuOptionIcon ${link.icon || 'link'}`;
                icon.setAttribute('aria-hidden', 'true');
                option.appendChild(icon);

                const label = document.createElement('span');
                label.className = 'navMenuOptionText';
                label.textContent = link.name;
                option.appendChild(label);

                customMenuOptions.appendChild(option);
            });
        });
    }

    const libraryMenuOptions = document.querySelector('.libraryMenuOptions');

    if (libraryMenuOptions) {
        getUserViews(apiClient, userId).then(function (result) {
            const items = result;
            let html = `<h3 class="sidebarHeader">${globalize.translate('HeaderMedia')}</h3>`;
            html += items.map(function (i) {
                const icon = i.icon || imageHelper.getLibraryIcon(i.CollectionType);
                const itemId = i.Id;

                return `<a is="emby-linkbutton" data-itemid="${itemId}" class="lnkMediaFolder navMenuOption" href="${getItemHref(i, i.CollectionType)}">
                                    <span class="material-icons navMenuOptionIcon ${icon}" aria-hidden="true"></span>
                                    <span class="sectionName navMenuOptionText">${escapeHtml(i.Name)}</span>
                                  </a>`;
            }).join('');
            libraryMenuOptions.innerHTML = html;
            const elem = libraryMenuOptions;
            const sidebarLinks = elem.querySelectorAll('.navMenuOption');

            for (const sidebarLink of sidebarLinks) {
                sidebarLink.removeEventListener('click', onSidebarLinkClick);
                sidebarLink.addEventListener('click', onSidebarLinkClick);
            }
        });
    }
}

function getTopParentId() {
    return getParameterByName('topParentId') || null;
}

function onMainDrawerClick(e) {
    if (dom.parentWithTag(e.target, 'A')) {
        setTimeout(closeMainDrawer, 30);
    }
}

function onSelectServerClick() {
    Dashboard.selectServer();
}

function onSettingsClick() {
    Dashboard.navigate('mypreferencesmenu');
}

function onExitAppClick() {
    appHost.exit();
}

function onLogoutClick() {
    Dashboard.logout();
}

function updateCastIcon() {
    if (!headerCastButton) {
        return;
    }
    const context = document;
    const info = playbackManager.getPlayerInfo();
    const icon = headerCastButton.querySelector('.material-icons');
    if (!icon) {
        return;
    }

    icon.classList.remove('cast_connected', 'cast');

    if (info && !info.isLocalPlayer) {
        icon.classList.add('cast_connected');
        headerCastButton.classList.add('castButton-active');
        context.querySelector('.headerSelectedPlayer').innerText = info.deviceName || info.name;
    } else {
        icon.classList.add('cast');
        headerCastButton.classList.remove('castButton-active');
        context.querySelector('.headerSelectedPlayer').innerHTML = '';
    }
}

function updateLibraryNavLinks(page) {
    const isLiveTvPage = page.classList.contains('liveTvPage');
    const isChannelsPage = page.classList.contains('channelsPage');
    const isEditorPage = page.classList.contains('metadataEditorPage');
    const isMySyncPage = page.classList.contains('mySyncPage');
    const id = isLiveTvPage || isChannelsPage || isEditorPage || isMySyncPage || page.classList.contains('allLibraryPage') ? '' : getTopParentId() || '';
    const elems = document.getElementsByClassName('lnkMediaFolder');

    for (let i = 0, length = elems.length; i < length; i++) {
        const lnkMediaFolder = elems[i];
        const itemId = lnkMediaFolder.getAttribute('data-itemid');

        if (isChannelsPage && itemId === 'channels') {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else if (isLiveTvPage && itemId === 'livetv') {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else if (isEditorPage && itemId === 'editor') {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else if (isMySyncPage && itemId === 'manageoffline' && window.location.href.toString().indexOf('mode=download') != -1) {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else if (isMySyncPage && itemId === 'syncotherdevices' && window.location.href.toString().indexOf('mode=download') == -1) {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else if (id && itemId == id) {
            lnkMediaFolder.classList.add('navMenuOption-selected');
        } else {
            lnkMediaFolder.classList.remove('navMenuOption-selected');
        }
    }
}

function updateMenuForPageType(isDashboardPage, isLibraryPage) {
    let newPageType = 3;
    if (isDashboardPage) {
        newPageType = 2;
    } else if (isLibraryPage) {
        newPageType = 1;
    }

    if (currentPageType !== newPageType) {
        currentPageType = newPageType;

        if (isDashboardPage && !layoutManager.mobile) {
            skinHeader.classList.add('headroomDisabled');
        } else {
            skinHeader.classList.remove('headroomDisabled');
        }

        const bodyClassList = document.body.classList;

        if (isLibraryPage) {
            bodyClassList.add('libraryDocument');
        } else {
            bodyClassList.remove('libraryDocument');
        }
        bodyClassList.remove('hideMainDrawer');

        if (navDrawerInstance) {
            navDrawerInstance.setEdgeSwipeEnabled(true);
        }
    }

    if (requiresUserRefresh) {
        ServerConnections.user(getCurrentApiClient()).then(updateUserInHeader);
    }
}

function updateTitle(page) {
    const title = page.getAttribute('data-title');
    if (title) {
        LibraryMenu.setTitle(title);
    } else {
        LibraryMenu.setDefaultTitle();
    }
}

function updateBackButton(page) {
    if (headerBackButton) {
        const hash = window.location.hash || '';
        const isHome = hash.includes('/home') || hash === '' || hash === '#/' || hash === '#';
        if (!isHome) {
            headerBackButton.classList.remove('hide');
        } else if (page?.getAttribute?.('data-backbutton') !== 'false' && appRouter.canGoBack()) {
            headerBackButton.classList.remove('hide');
        } else {
            headerBackButton.classList.add('hide');
        }
    }
}

function initHeadRoom(elem) {
    const headroom = new Headroom(elem);
    headroom.init();
}

function refreshLibraryDrawer(user) {
    loadNavDrawer();
    currentDrawerType = 'library';

    if (user) {
        Promise.resolve(user);
    } else {
        ServerConnections.user(getCurrentApiClient()).then(function (userResult) {
            refreshLibraryInfoInDrawer(userResult);
            updateLibraryMenu(userResult.localUser);
        });
    }
}

function getNavDrawerOptions() {
    let drawerWidth = window.screen.availWidth - 50;
    drawerWidth = Math.max(drawerWidth, 240);
    drawerWidth = Math.min(drawerWidth, 320);
    return {
        target: navDrawerElement,
        onChange: onMainDrawerSelect,
        width: drawerWidth
    };
}

function loadNavDrawer() {
    if (navDrawerInstance) {
        return Promise.resolve(navDrawerInstance);
    }

    navDrawerElement = document.querySelector('.mainDrawer');
    navDrawerScrollContainer = navDrawerElement.querySelector('.scrollContainer');
    navDrawerScrollContainer.addEventListener('click', onMainDrawerClick);
    return new Promise(function (resolve) {
        import('../lib/navdrawer/navdrawer').then(({ default: NavDrawer }) => {
            navDrawerInstance = new NavDrawer(getNavDrawerOptions());

            if (!layoutManager.tv) {
                navDrawerElement.classList.remove('hide');
            }

            resolve(navDrawerInstance);
        });
    });
}

let navDrawerElement;
let navDrawerScrollContainer;
let navDrawerInstance;
let mainDrawerButton;
let headerHomeButton;
let currentDrawerType;
let documentTitle = 'Jellyfin';
let pageTitleElement;
let headerBackButton;
let headerUserButton;
let currentUser;
let headerCastButton;
let headerSearchButton;
let headerAudioPlayerButton;
let headerSyncButton;
let currentTimeText;
const skinHeader = document.querySelector('.skinHeader');
let requiresUserRefresh = true;

function setTabs (type, selectedIndex, builder) {
    Events.trigger(document, EventType.SET_TABS, type ? [ type, selectedIndex, builder()] : []);

    import('../components/maintabsmanager').then((mainTabsManager) => {
        if (type) {
            mainTabsManager.setTabs(viewManager.currentView(), selectedIndex, builder, function () {
                return [];
            });
        } else {
            mainTabsManager.setTabs(null);
        }
    });
}

/**
 * Fetch the server name and update the document title.
 * @param {ApiClient} [_apiClient] The current api client.
 */
const fetchServerName = (_apiClient) => {
    _apiClient
        ?.getPublicSystemInfo()
        .then(({ ServerName }) => {
            documentTitle = ServerName || documentTitle;
            document.title = documentTitle;
        })
        .catch(err => {
            console.error('[LibraryMenu] failed to fetch system info', err);
        });
};

function setDefaultTitle () {
    if (!pageTitleElement) {
        pageTitleElement = document.querySelector('.pageTitle');
    }

    if (pageTitleElement) {
        pageTitleElement.classList.add('pageTitleWithLogo');
        pageTitleElement.classList.add('pageTitleWithDefaultLogo');
        pageTitleElement.style.backgroundImage = null;
        pageTitleElement.innerHTML = '';
    }

    document.title = documentTitle;
}

function setTitle (title) {
    if (!pageTitleElement) {
        pageTitleElement = document.querySelector('.pageTitle');
    }

    if (pageTitleElement) {
        pageTitleElement.classList.add('pageTitleWithLogo');
        pageTitleElement.classList.add('pageTitleWithDefaultLogo');
        pageTitleElement.style.backgroundImage = null;
        pageTitleElement.innerHTML = '';
    }

    document.title = title ? `${title} - MatheusFlix` : documentTitle;
}

function setTransparentMenu (transparent) {
    if (transparent) {
        skinHeader.classList.add('semiTransparent');
    } else {
        skinHeader.classList.remove('semiTransparent');
    }
}

let currentPageType;
pageClassOn('pagebeforeshow', 'page', function () {
    if (!this.classList.contains('withTabs')) {
        LibraryMenu.setTabs(null);
    }
});

pageClassOn('pageshow', 'page', function (e) {
    const page = this;
    const isDashboardPage = page.classList.contains('type-interior');
    const isLibraryPage = !isDashboardPage && page.classList.contains('libraryPage');

    if (mainDrawerButton) {
        mainDrawerButton.remove();
        mainDrawerButton = null;
    }
    if (skinHeader) {
        skinHeader.querySelectorAll('.mainDrawerButton, .barsMenuButton, .headerHomeButton, button:has(.material-icons.menu), button:has(.material-icons.home)').forEach(el => el.remove());
    }

    if (!isDashboardPage && currentDrawerType !== 'library') {
        refreshLibraryDrawer();
    }

    updateMenuForPageType(isDashboardPage, isLibraryPage);
    updateHeaderActiveNavigation();

    // TODO: Seems to do nothing? Check if needed (also in other views).
    if (!e.detail.isRestored) {
        window.scrollTo(0, 0);
    }

    updateTitle(page);
    updateBackButton(page);
    updateLibraryNavLinks(page);
});

Events.on(ServerConnections, 'apiclientcreated', (e, newApiClient) => {
    fetchServerName(newApiClient);
});

Events.on(ServerConnections, 'localusersignedin', function (e, user) {
    const currentApiClient = ServerConnections.getApiClient(user.ServerId);

    currentDrawerType = null;
    currentUser = {
        localUser: user
    };

    loadNavDrawer();

    ServerConnections.user(currentApiClient).then(function (userResult) {
        currentUser = userResult;
        updateUserInHeader(userResult);
    });
});

Events.on(ServerConnections, 'localusersignedout', function () {
    currentUser = {};
    updateUserInHeader();
});

Events.on(playbackManager, 'playerchange', updateCastIcon);

fetchServerName(getCurrentApiClient());
loadNavDrawer();

const LibraryMenu = {
    getTopParentId,
    onHardwareMenuButtonClick: function () {
        toggleMainDrawer();
    },
    setTabs,
    setDefaultTitle,
    setTitle,
    setTransparentMenu
};

window.addEventListener('hashchange', updateHeaderActiveNavigation);

window.LibraryMenu = LibraryMenu;
window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.querySelector('.mf-cinema-player')) {
        e.preventDefault();
        showSearch();
    }
});
renderHeader();

export default LibraryMenu;
