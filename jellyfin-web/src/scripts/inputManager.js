import { appHost } from 'components/apphost';
import focusManager from 'components/focusManager';
import { playbackManager } from 'components/playback/playbackmanager';
import { appRouter } from 'components/router/appRouter';
import { AppFeature } from 'constants/appFeature';
import dom from 'utils/dom';

let lastInputTime = new Date().getTime();

export function notify() {
    lastInputTime = new Date().getTime();
    handleCommand('unknown');
}

export function notifyMouseMove() {
    lastInputTime = new Date().getTime();
}

export function idleTime() {
    return new Date().getTime() - lastInputTime;
}

export function select(sourceElement) {
    sourceElement.click();
}

let eventListenerCount = 0;
export function on(scope, fn) {
    eventListenerCount++;
    dom.addEventListener(scope, 'command', fn, {});
}

export function off(scope, fn) {
    if (eventListenerCount) {
        eventListenerCount--;
    }

    dom.removeEventListener(scope, 'command', fn, {});
}

const commandTimes = {};

function checkCommandTime(command) {
    const last = commandTimes[command] || 0;
    const now = new Date().getTime();

    if ((now - last) < 1000) {
        return false;
    }

    commandTimes[command] = now;
    return true;
}

export function handleCommand(commandName, options) {
    lastInputTime = new Date().getTime();

    let sourceElement = (options ? options.sourceElement : null);

    if (sourceElement) {
        sourceElement = focusManager.focusableParent(sourceElement);
    }

    if (!sourceElement) {
        sourceElement = document.activeElement || window;

        const dialogs = document.querySelectorAll('.dialogContainer .dialog.opened');

        // Suppose the top open dialog is active
        const dlg = dialogs.length ? dialogs[dialogs.length - 1] : null;

        if (dlg && !dlg.contains(sourceElement)) {
            sourceElement = dlg;
        }
    }

    if (eventListenerCount) {
        const customEvent = new CustomEvent('command', {
            detail: {
                command: commandName
            },
            bubbles: true,
            cancelable: true
        });

        const eventResult = sourceElement.dispatchEvent(customEvent);
        if (!eventResult) {
            // event cancelled
            return;
        }
    }

    const keyActions = (command) => ({
        'up': () => {
            focusManager.moveUp(sourceElement);
        },
        'down': () => {
            focusManager.moveDown(sourceElement);
        },
        'left': () => {
            focusManager.moveLeft(sourceElement);
        },
        'right': () => {
            focusManager.moveRight(sourceElement);
        },
        'home': () => {
            appRouter.goHome();
        },
        'settings': () => {
            appRouter.showSettings();
        },
        'back': () => {
            // Se houver player de cinema, modal stremio, atalhos ou diálogo de confirmação ativo, não interfere
            if (document.querySelector('.mf-cinema-player') ||
                document.querySelector('.mf-confirm-backdrop') ||
                document.querySelector('.mf-stremio-modal') ||
                document.querySelector('.mf-shortcuts-backdrop')) {
                return;
            }

            const isHome = window.location.hash.startsWith('#/home') || window.location.hash === '' || window.location.hash === '#/';

            if (isHome || !appRouter.canGoBack()) {
                import('./matheusflix/confirmModal').then(({ showConfirmModal }) => {
                    showConfirmModal({
                        title: 'Sair do MatheusFlix',
                        subtitle: 'Deseja realmente sair da aplicação?',
                        icon: 'exit_to_app',
                        confirmText: 'Sair do App',
                        cancelText: 'Continuar Assistindo',
                        confirmType: 'danger'
                    }).then((confirmed) => {
                        if (confirmed && appHost.supports(AppFeature.Exit)) {
                            appHost.exit();
                        }
                    });
                }).catch(() => {
                    if (appHost.supports(AppFeature.Exit)) {
                        appHost.exit();
                    }
                });
                return;
            }

            appRouter.back();
        },
        'select': () => {
            select(sourceElement);
        },
        'nextchapter': () => {
            playbackManager.nextChapter();
        },
        'next': () => {
            playbackManager.nextTrack();
        },
        'nexttrack': () => {
            playbackManager.nextTrack();
        },
        'previous': () => {
            playbackManager.previousTrack();
        },
        'previoustrack': () => {
            playbackManager.previousTrack();
        },
        'previouschapter': () => {
            playbackManager.previousChapter();
        },
        'guide': () => {
            appRouter.showGuide();
        },
        'recordedtv': () => {
            appRouter.showRecordedTV();
        },
        'livetv': () => {
            appRouter.showLiveTV();
        },
        'mute': () => {
            playbackManager.setMute(true);
        },
        'unmute': () => {
            playbackManager.setMute(false);
        },
        'togglemute': () => {
            playbackManager.toggleMute();
        },
        'channelup': () => {
            playbackManager.channelUp();
        },
        'channeldown': () => {
            playbackManager.channelDown();
        },
        'volumedown': () => {
            playbackManager.volumeDown();
        },
        'volumeup': () => {
            playbackManager.volumeUp();
        },
        'play': () => {
            playbackManager.unpause();
        },
        'pause': () => {
            playbackManager.pause();
        },
        'playpause': () => {
            playbackManager.playPause();
        },
        'stop': () => {
            if (checkCommandTime('stop')) {
                playbackManager.stop();
            }
        },
        'changezoom': () => {
            playbackManager.toggleAspectRatio();
        },
        'increaseplaybackrate': () => {
            playbackManager.increasePlaybackRate();
        },
        'decreaseplaybackrate': () => {
            playbackManager.decreasePlaybackRate();
        },
        'changeaudiotrack': () => {
            playbackManager.changeAudioStream();
        },
        'changesubtitletrack': () => {
            playbackManager.changeSubtitleStream();
        },
        'search': () => {
            appRouter.showSearch();
        },
        'favorites': () => {
            appRouter.showFavorites();
        },
        'fastforward': () => {
            playbackManager.fastForward();
        },
        'rewind': () => {
            playbackManager.rewind();
        },
        'seek': () => {
            playbackManager.seekMs(options);
        },
        'togglefullscreen': () => {
            playbackManager.toggleFullscreen();
        },
        'disabledisplaymirror': () => {
            playbackManager.enableDisplayMirroring(false);
        },
        'enabledisplaymirror': () => {
            playbackManager.enableDisplayMirroring(true);
        },
        'toggledisplaymirror': () => {
            playbackManager.toggleDisplayMirroring();
        },
        'nowplaying': () => {
            appRouter.showNowPlaying();
        },
        'repeatnone': () => {
            playbackManager.setRepeatMode('RepeatNone');
        },
        'repeatall': () => {
            playbackManager.setRepeatMode('RepeatAll');
        },
        'repeatone': () => {
            playbackManager.setRepeatMode('RepeatOne');
        },
        'unknown': () => {
            // This is the command given by 'notify', it's a no-op
        }
    })[command];

    const action = keyActions(commandName);
    if (action !== undefined) {
        action.call();
    } else {
        console.debug(`inputManager: tried to process command with no action assigned: ${commandName}`);
    }
}

dom.addEventListener(document, 'click', notify, {
    passive: true
});

export default {
    handleCommand: handleCommand,
    notify: notify,
    notifyMouseMove: notifyMouseMove,
    idleTime: idleTime,
    on: on,
    off: off
};
