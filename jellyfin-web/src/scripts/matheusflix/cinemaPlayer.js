/**
 * MatheusFlix Cinema Player
 * Player integrado com suporte a HTTP 206 Range (Offline/Local ou Streaming de Torrents)
 * Controles de cinema, barra de progresso, volume, atalhos de teclado e telemetria de buffer.
 */

import { API_BASE, getStreamStatus, saveWatchProgress } from './api';
import { escapeHtml, parseDuration } from './utils';
import { openShortcutsModal } from './shortcutsModal';
import toast from 'components/toast/toast';
import { playbackManager } from 'components/playback/playbackmanager';
import Events from 'utils/events';

let activePlayerInstance = null;
let lastFocusedBeforePlayer = null;
const noop = () => {
    // Intentionally empty no-op handler
};

export function stopAndDestroyVideo(video) {
    if (!video) return;
    try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        try {
            video.currentTime = 0;
        } catch (_) {}
        video.removeAttribute('src');
        video.src = '';
        while (video.firstChild) {
            try {
                video.removeChild(video.firstChild);
            } catch (_) {}
        }
        if (video.srcObject) {
            try {
                const tracks = video.srcObject.getTracks?.() || [];
                tracks.forEach(t => t.stop?.());
            } catch (_) {}
            video.srcObject = null;
        }
        if (video.textTracks) {
            for (let i = 0; i < video.textTracks.length; i++) {
                try {
                    video.textTracks[i].mode = 'disabled';
                } catch (_) {}
            }
        }
        video.load();
    } catch (_) {}
}

export function stopAllMedia() {
    const allCinemaPlayers = document.querySelectorAll('.mf-cinema-player');
    allCinemaPlayers.forEach(p => {
        try {
            if (p._cleanup) p._cleanup();
        } catch (_) {}
        p.querySelectorAll('video, audio').forEach(stopAndDestroyVideo);
        p.remove();
    });

    document.querySelectorAll('video, audio').forEach(stopAndDestroyVideo);

    try {
        if (playbackManager && (playbackManager.isPlaying?.() || playbackManager.isPlayingVideo?.() || playbackManager.isPlayingAudio?.())) {
            playbackManager.stop();
        }
    } catch (_) {}

    document.body.style.overflow = '';
}

if (typeof window !== 'undefined') {
    window.MatheusFlix = window.MatheusFlix || {};
    window.MatheusFlix.closeCinema = closeCinemaPlayer;
    window.MatheusFlix.stopAllMedia = stopAllMedia;
}

function formatSeconds(sec) {
    if (isNaN(sec) || sec === Infinity || sec < 0) return '00:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const remS = s % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(remM)}:${pad(remS)}`;
    return `${pad(remM)}:${pad(remS)}`;
}

export function openCinemaPlayer({
    streamUrl,
    title,
    subInfo,
    quality = '1080p',
    isLocal = false,
    infoHash = null,
    movieId = null,
    poster = null,
    resumePosition = 0,
    duration = 0
}) {
    if (document.activeElement && document.activeElement !== document.body) {
        lastFocusedBeforePlayer = document.activeElement;
    }

    // 1. Encerra qualquer reprodução ativa globalmente para garantir apenas UM filme por vez
    stopAllMedia();

    // Remove qualquer modal de detalhes ou tela anterior para ir direto para o filme
    document.querySelectorAll('.mf-movie-page, .mf-stremio-modal, .mf-stremio-modal-backdrop').forEach(el => el.remove());
    document.body.style.overflow = 'hidden';

    // Gerencia o histórico para que o botão Voltar do navegador funcione perfeitamente
    if (window.history.state?.mfMoviePage) {
        window.history.replaceState({ mfCinemaPlayer: true }, '');
    } else if (!window.history.state?.mfCinemaPlayer) {
        window.history.pushState({ mfCinemaPlayer: true }, '');
    }

    // Auto-recupera infoHash se não foi fornecido explicitamente
    let currentHash = infoHash;
    if (!currentHash && streamUrl) {
        const hashMatch = streamUrl.match(/\/api\/stream\/([a-f0-9]{40})/i)
            || streamUrl.match(/btih:([a-f0-9]{40})/i);
        if (hashMatch) {
            currentHash = hashMatch[1].toLowerCase();
        }
    }

    const progressStorageKey = 'mf_resume_' + (currentHash || movieId || encodeURIComponent(title || ''));
    if (!resumePosition || resumePosition <= 0) {
        try {
            const saved = parseFloat(localStorage.getItem(progressStorageKey) || '0');
            if (saved > 10) {
                resumePosition = saved;
            }
        } catch (_) {}
    }

    let fullStreamUrl = streamUrl.startsWith('http') ? streamUrl : `${API_BASE.replace('/api', '')}${streamUrl}`;

    const playerEl = document.createElement('div');
    playerEl.className = 'mf-cinema-player';
    playerEl.innerHTML = `
        <div class="mf-player-topbar">
            <div class="mf-player-meta">
                <button type="button" class="mf-player-back-nav-btn focusable" title="Voltar (Esc)">
                    <span class="material-icons">arrow_back</span>
                    <span>Voltar</span>
                </button>
                <div class="mf-player-title-box">
                    <h3 class="mf-player-title">${escapeHtml(title)}</h3>
                    <span class="mf-player-sub">${escapeHtml(subInfo || quality)}</span>
                </div>
            </div>
            <div class="mf-player-top-actions">
                <div class="mf-player-telemetry-pill hide"></div>
                <button type="button" class="mf-player-close-btn focusable" title="Fechar (Esc)">
                    <span class="material-icons">close</span>
                </button>
            </div>
        </div>

        <div class="mf-player-video-wrap">
            <video class="mf-player-video" playsinline preload="auto" controlslist="nodownload"></video>

            <div class="mf-player-buffer-overlay ${isLocal ? 'hide is-hidden' : ''}" style="${isLocal ? 'display: none !important;' : ''}">
                <div class="mf-player-spinner">
                    <span class="material-icons">sync</span>
                </div>
                <h2 class="mf-buf-title">Carregando transmissão...</h2>
                <div class="mf-buffer-stats">
                    <span class="mf-buffer-pill mf-buf-speed"><span class="material-icons">speed</span> Velocidade: ...</span>
                    <span class="mf-buffer-pill mf-buf-peers"><span class="material-icons">group</span> Sementes: ...</span>
                    <span class="mf-buffer-pill mf-buf-progress"><span class="material-icons">cloud_sync</span> Buffer: 0%</span>
                </div>
                <button type="button" class="mf-btn-force-play focusable">
                    <span class="material-icons">play_arrow</span>
                    <span>Iniciar</span>
                </button>
            </div>
        </div>

        <div class="mf-player-bottom-bar">
            <div class="mf-player-timeline">
                <input type="range" class="mf-player-seek focusable" min="0" max="100" value="0" step="0.1" title="Posição do Vídeo" />
                <div class="mf-player-buffer-fill"></div>
                <div class="mf-player-progress-fill"></div>
            </div>

            <div class="mf-player-controls-row">
                <div class="mf-player-controls-left">
                    <button type="button" class="mf-ctrl-btn mf-btn-play focusable" title="Play/Pause (Espaço)">
                        <span class="material-icons">play_arrow</span>
                    </button>
                    <button type="button" class="mf-ctrl-btn mf-btn-rw focusable" title="Voltar 10s (←)">
                        <span class="material-icons">replay_10</span>
                    </button>
                    <button type="button" class="mf-ctrl-btn mf-btn-ff focusable" title="Avançar 10s (→)">
                        <span class="material-icons">forward_10</span>
                    </button>

                    <div class="mf-player-time">
                        <span class="mf-time-cur">00:00</span> <span class="mf-time-sep">/</span> <span class="mf-time-dur">00:00</span>
                    </div>
                </div>

                <div class="mf-player-controls-right">
                    <div class="mf-player-vol-wrap">
                        <button type="button" class="mf-ctrl-btn mf-btn-vol focusable" title="Mudo (M)">
                            <span class="material-icons">volume_up</span>
                        </button>
                        <input type="range" class="mf-player-vol-slider focusable" min="0" max="1" step="0.05" value="1" title="Volume" />
                    </div>

                    <span class="mf-player-quality-tag">${escapeHtml(quality)}</span>

                    <button type="button" class="mf-ctrl-btn mf-btn-speed focusable" title="Velocidade (C)">
                        <span class="mf-speed-badge">1.0x</span>
                    </button>

                    <button type="button" class="mf-ctrl-btn mf-btn-pip focusable" title="Miniplayer / PiP (P)">
                        <span class="material-icons">picture_in_picture_alt</span>
                    </button>

                    <button type="button" class="mf-ctrl-btn mf-btn-subtitles focusable" title="Legendas e Áudio (S)">
                        <span class="material-icons">subtitles</span>
                    </button>

                    <button type="button" class="mf-ctrl-btn mf-btn-shortcuts focusable" title="Atalhos e Controles (?)">
                        <span class="material-icons">help_outline</span>
                    </button>

                    <button type="button" class="mf-ctrl-btn mf-btn-fullscreen focusable" title="Tela Cheia (F)">
                        <span class="material-icons">fullscreen</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(playerEl);
    activePlayerInstance = playerEl;

    const video = playerEl.querySelector('.mf-player-video');
    const overlay = playerEl.querySelector('.mf-player-buffer-overlay');
    const btnPlay = playerEl.querySelector('.mf-btn-play');
    const btnRw = playerEl.querySelector('.mf-btn-rw');
    const btnFf = playerEl.querySelector('.mf-btn-ff');
    const seekSlider = playerEl.querySelector('.mf-player-seek');
    const progressFill = playerEl.querySelector('.mf-player-progress-fill');
    const bufferFill = playerEl.querySelector('.mf-player-buffer-fill');
    const timeCur = playerEl.querySelector('.mf-time-cur');
    const timeDur = playerEl.querySelector('.mf-time-dur');
    const btnVol = playerEl.querySelector('.mf-btn-vol');
    const volSlider = playerEl.querySelector('.mf-player-vol-slider');
    const btnFullscreen = playerEl.querySelector('.mf-btn-fullscreen');
    const btnClose = playerEl.querySelector('.mf-player-close-btn');

    let statusInterval = null;
    let controlsTimer = null;
    let hasFallbackTranscoded = false;
    let isDestroyed = false;
    let isExiting = false;

    // Força pré-carregamento imediato
    video.src = fullStreamUrl;
    video.preload = 'auto';
    video.load();

    function safePlay() {
        if (isDestroyed || !activePlayerInstance) return;
        try {
            const p = video.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    if (isDestroyed) {
                        stopAndDestroyVideo(video);
                        return;
                    }
                    hideOverlay();
                }).catch(() => {
                    if (isDestroyed) return;
                    video.muted = true;
                    video.play().then(() => {
                        if (isDestroyed) {
                            stopAndDestroyVideo(video);
                            return;
                        }
                        hideOverlay();
                    }).catch(noop);
                });
            }
        } catch (_) {}
    }

    // Tenta iniciar a reprodução imediatamente
    safePlay();

    const btnForcePlay = playerEl.querySelector('.mf-btn-force-play');
    if (btnForcePlay) {
        btnForcePlay.addEventListener('click', (e) => {
            e.stopPropagation();
            hideOverlay();
            safePlay();
        });
    }

    function hideOverlay() {
        if (overlay) {
            overlay.classList.add('hide');
            overlay.classList.add('is-hidden');
            overlay.style.setProperty('display', 'none', 'important');
            overlay.style.setProperty('opacity', '0', 'important');
            overlay.style.setProperty('visibility', 'hidden', 'important');
            overlay.style.setProperty('pointer-events', 'none', 'important');
        }
    }

    function showOverlay() {
        if (overlay) {
            overlay.classList.remove('hide');
            overlay.classList.remove('is-hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('opacity');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('pointer-events');
        }
    }

    // Show/hide controls smoothly
    function showControls() {
        playerEl.classList.add('controls-visible');
        clearTimeout(controlsTimer);
        controlsTimer = setTimeout(() => {
            if (!video.paused) {
                playerEl.classList.remove('controls-visible');
            }
        }, 3000);
    }

    playerEl.addEventListener('mousemove', showControls);
    playerEl.addEventListener('click', (e) => {
        if (e.target.closest('.mf-player-bottom-bar') || e.target.closest('.mf-player-topbar')) return;
        togglePlay();
    });

    function togglePlay() {
        if (isDestroyed) return;
        if (video.paused) {
            safePlay();
        } else {
            video.pause();
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            playerEl.requestFullscreen?.().catch(noop);
        } else {
            document.exitFullscreen?.().catch(noop);
        }
    }

    function showSeekFeedback(text) {
        let badge = playerEl.querySelector('.mf-player-feedback-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'mf-player-feedback-badge';
            playerEl.appendChild(badge);
        }
        badge.textContent = text;
        badge.classList.remove('active');
        void badge.offsetWidth;
        badge.classList.add('active');
        clearTimeout(badge._timer);
        badge._timer = setTimeout(() => {
            badge.classList.remove('active');
        }, 700);
    }

    btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });

    btnRw.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = Math.max(0, video.currentTime - 10);
        showSeekFeedback('-10s');
    });

    btnFf.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        showSeekFeedback('+10s');
    });

    btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
    });

    function handleExit() {
        if (isExiting) return;
        isExiting = true;
        closeCinemaPlayer();
        if (window.history.state?.mfCinemaPlayer) {
            window.history.back();
        }
    }

    const btnBackNav = playerEl.querySelector('.mf-player-back-nav-btn');
    if (btnBackNav) {
        btnBackNav.addEventListener('click', (e) => {
            e.stopPropagation();
            handleExit();
        });
    }

    btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        handleExit();
    });

    // Volume controls
    volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        video.volume = parseFloat(volSlider.value);
        video.muted = (video.volume === 0);
        updateVolIcon();
    });

    btnVol.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        updateVolIcon();
    });

    function updateVolIcon() {
        const icon = btnVol.querySelector('.material-icons');
        if (video.muted || video.volume === 0) {
            icon.textContent = 'volume_off';
        } else if (video.volume < 0.5) {
            icon.textContent = 'volume_down';
        } else {
            icon.textContent = 'volume_up';
        }
    }

    let totalDuration = parseDuration({ duration });

    // Se a duração não foi passada pelo chamador, obtém via cabeçalho HEAD do servidor
    if (!totalDuration || totalDuration <= 30) {
        fetch(fullStreamUrl, { method: 'HEAD' }).then(res => {
            const raw = res.headers.get('x-media-duration') || res.headers.get('X-Media-Duration');
            const d = parseFloat(raw);
            if (!isNaN(d) && d > 30) {
                totalDuration = Math.round(d);
                updateDurationUI();
            }
        }).catch(noop);
    }

    function getEffectiveDuration() {
        if (totalDuration > 30) {
            return totalDuration;
        }
        if (video.duration && isFinite(video.duration) && video.duration > 180) {
            return video.duration;
        }
        return 0;
    }

    function updateDurationUI() {
        const dur = getEffectiveDuration();
        if (dur > 0) {
            timeDur.textContent = formatSeconds(dur);
        } else {
            timeDur.textContent = '--:--';
        }
    }

    // Gerenciador de Wake Lock (mantém a tela da TV/computador acesa durante reprodução)
    let wakeLock = null;
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator && !wakeLock) {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (_) {}
    }

    function releaseWakeLock() {
        try {
            if (wakeLock) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (_) {}
    }

    // Alternar legendas e áudio
    function toggleSubtitles() {
        const tracks = video.textTracks;
        if (!tracks || tracks.length === 0) {
            toast('Nenhuma legenda embutida encontrada neste vídeo.');
            return;
        }
        let anyShowing = false;
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].mode === 'showing') {
                anyShowing = true;
                tracks[i].mode = 'disabled';
                break;
            }
        }
        if (!anyShowing) {
            let targetTrack = tracks[0];
            for (let i = 0; i < tracks.length; i++) {
                if (/por|pt|bra/i.test(tracks[i].language || tracks[i].label || '')) {
                    targetTrack = tracks[i];
                    break;
                }
            }
            targetTrack.mode = 'showing';
            toast(`Legendas ativadas: ${targetTrack.label || targetTrack.language || 'Legenda 1'}`);
        } else {
            toast('Legendas desativadas');
        }
    }

    const btnSubtitles = playerEl.querySelector('.mf-btn-subtitles');
    if (btnSubtitles) {
        btnSubtitles.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSubtitles();
        });
    }

    // Velocidade de reprodução (0.75x, 1x, 1.25x, 1.5x)
    const speeds = [1.0, 1.25, 1.5, 0.75];
    let speedIdx = 0;
    const btnSpeed = playerEl.querySelector('.mf-btn-speed');
    const speedBadge = playerEl.querySelector('.mf-speed-badge');

    function cycleSpeed() {
        speedIdx = (speedIdx + 1) % speeds.length;
        const s = speeds[speedIdx];
        video.playbackRate = s;
        if (speedBadge) speedBadge.textContent = `${s}x`;
        showSeekFeedback(`Velocidade: ${s}x`);
    }

    if (btnSpeed) {
        btnSpeed.addEventListener('click', (e) => {
            e.stopPropagation();
            cycleSpeed();
        });
    }

    // Miniplayer / Picture-in-Picture
    const btnPip = playerEl.querySelector('.mf-btn-pip');
    async function togglePip() {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (video && video.requestPictureInPicture) {
                await video.requestPictureInPicture();
            }
        } catch (_) {
            toast('Miniplayer indisponível no momento.');
        }
    }

    if (btnPip) {
        if (!document.pictureInPictureEnabled) {
            btnPip.classList.add('hide');
        } else {
            btnPip.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePip();
            });
        }
    }

    // Modal de atalhos e controle remoto
    const btnShortcuts = playerEl.querySelector('.mf-btn-shortcuts');
    if (btnShortcuts) {
        btnShortcuts.addEventListener('click', (e) => {
            e.stopPropagation();
            openShortcutsModal();
        });
    }

    // Seek controls robustos com suporte a tempo total e transcoder
    let seekDebounce = null;
    seekSlider.addEventListener('input', () => {
        const pct = parseFloat(seekSlider.value);
        const dur = getEffectiveDuration();
        if (dur > 0) {
            const targetTime = (pct / 100) * dur;
            progressFill.style.width = `${pct}%`;
            timeCur.textContent = formatSeconds(targetTime);

            if (video.duration && isFinite(video.duration) && video.duration > 180 && !video.src.includes('transcode=1')) {
                video.currentTime = targetTime;
            } else {
                clearTimeout(seekDebounce);
                seekDebounce = setTimeout(() => {
                    try {
                        const u = new URL(video.src, window.location.href);
                        u.searchParams.set('startTime', String(Math.floor(targetTime)));
                        video.src = u.toString();
                        video.load();
                        video.play().catch(noop);
                    } catch {
                        video.currentTime = targetTime;
                    }
                }, 200);
            }
        }
    });

    let lastProgressSave = 0;
    let hasResumed = false;

    function getCurrentTimeSec() {
        let offsetTime = 0;
        try {
            const u = new URL(video.src, window.location.href);
            offsetTime = parseFloat(u.searchParams.get('startTime') || 0) || 0;
        } catch {}
        return offsetTime + (video.currentTime || 0);
    }

    function persistCurrentProgress() {
        const dur = getEffectiveDuration();
        const currentSec = getCurrentTimeSec();
        if (currentSec > 5) {
            try {
                if (dur > 0 && (currentSec / dur) >= 0.92) {
                    localStorage.removeItem(progressStorageKey);
                } else {
                    localStorage.setItem(progressStorageKey, String(Math.floor(currentSec)));
                }
            } catch (_) {}
        }
        const effectiveMovieId = movieId || currentHash || (title ? encodeURIComponent(title) : null);
        if (effectiveMovieId && dur > 0 && currentSec > 5) {
            const isCompleted = (currentSec / dur) >= 0.90;
            saveWatchProgress({
                movieId: effectiveMovieId,
                title,
                poster,
                position: Math.floor(currentSec),
                duration: Math.floor(dur),
                completed: isCompleted
            }).catch(noop);
        }
    }

    function tryResumePlayback() {
        const dur = getEffectiveDuration();
        if (!hasResumed && resumePosition > 10 && (dur === 0 || resumePosition < (dur - 15))) {
            hasResumed = true;
            video.currentTime = resumePosition;
            toast(`Retomando de ${formatSeconds(resumePosition)}...`);
        }
    }

    video.addEventListener('timeupdate', () => {
        if (video.currentTime > 0) {
            hideOverlay();
        }

        const dur = getEffectiveDuration();
        const currentSec = getCurrentTimeSec();

        if (dur > 0) {
            const pct = (currentSec / dur) * 100;
            seekSlider.value = pct;
            progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
            timeCur.textContent = formatSeconds(currentSec);
            timeDur.textContent = formatSeconds(dur);

            const now = Date.now();
            if (now - lastProgressSave > 5000) {
                lastProgressSave = now;
                persistCurrentProgress();
            }
        } else {
            timeCur.textContent = formatSeconds(currentSec);
            timeDur.textContent = '--:--';
        }

        // Buffer fill
        if (video.buffered.length > 0 && dur > 0) {
            let offsetTime = 0;
            try {
                const u = new URL(video.src, window.location.href);
                offsetTime = parseFloat(u.searchParams.get('startTime') || 0) || 0;
            } catch {}
            const bufferedEnd = offsetTime + video.buffered.end(video.buffered.length - 1);
            const bPct = (bufferedEnd / dur) * 100;
            bufferFill.style.width = `${Math.min(100, Math.max(0, bPct))}%`;
        }
    });

    video.addEventListener('loadeddata', () => {
        if (isDestroyed) return;
        hideOverlay();
        updateDurationUI();
        safePlay();
    });

    video.addEventListener('canplay', () => {
        if (isDestroyed) return;
        hideOverlay();
        updateDurationUI();
        tryResumePlayback();
        safePlay();
    });

    video.addEventListener('play', () => {
        if (isDestroyed) {
            stopAndDestroyVideo(video);
            return;
        }
        btnPlay.querySelector('.material-icons').textContent = 'pause';
        hideOverlay();
        showControls();
        requestWakeLock();
    });

    video.addEventListener('playing', () => {
        if (isDestroyed) {
            stopAndDestroyVideo(video);
            return;
        }
        btnPlay.querySelector('.material-icons').textContent = 'pause';
        hideOverlay();
        tryResumePlayback();
        showControls();
        requestWakeLock();
    });

    video.addEventListener('pause', () => {
        btnPlay.querySelector('.material-icons').textContent = 'play_arrow';
        playerEl.classList.add('controls-visible');
        persistCurrentProgress();
        releaseWakeLock();
    });

    video.addEventListener('ended', () => {
        const dur = getEffectiveDuration();
        const currentSec = getCurrentTimeSec();
        if (dur > 60 && currentSec < (dur - 15)) {
            // Chunk intermediário de stream, não finaliza a reprodução
            return;
        }
        btnPlay.querySelector('.material-icons').textContent = 'replay';
        persistCurrentProgress();
        releaseWakeLock();
    });

    video.addEventListener('loadedmetadata', () => {
        if (isDestroyed) return;
        if (!totalDuration && video.duration && isFinite(video.duration) && video.duration > 180) {
            totalDuration = Math.round(video.duration);
        }
        updateDurationUI();
        tryResumePlayback();
        hideOverlay();
        safePlay();
    });

    // Tratamento de Erros e Auto-recuperação com Transcode
    video.addEventListener('error', () => {
        if (isDestroyed) return;
        if (video.error && video.error.code === 1) return; // MEDIA_ERR_ABORTED

        console.warn('[CinemaPlayer] Erro de mídia detectado:', video.error);

        // Se o navegador falhou ao decodificar (ex: MKV ou áudio AC3) e ainda não tentamos o transcode
        if (!hasFallbackTranscoded && !fullStreamUrl.includes('transcode=1')) {
            hasFallbackTranscoded = true;
            const sep = fullStreamUrl.includes('?') ? '&' : '?';
            const fallbackUrl = `${fullStreamUrl}${sep}transcode=1`;
            console.log('[CinemaPlayer] Ativando conversao em tempo real (remux):', fallbackUrl);
            toast('Ajustando formato para compatibilidade com o navegador...');

            fullStreamUrl = fallbackUrl;
            video.src = fallbackUrl;
            video.load();
            safePlay();
            return;
        }

        const msgEl = playerEl.querySelector('.mf-buf-msg');
        if (msgEl) {
            msgEl.textContent = 'Não foi possível reproduzir este vídeo diretamente. O arquivo pode estar incompleto ou requer outro codec. Experimente selecionar outra opção da lista.';
        }
        toast('Erro ao carregar o vídeo. Tente outra fonte.');
    });

    // Telemetria discreta para arquivo local
    if (isLocal) {
        const telemEl = playerEl.querySelector('.mf-player-telemetry-pill');
        if (telemEl) {
            telemEl.classList.remove('hide');
            telemEl.innerHTML = `<span class="mf-telemetry-dot" style="background:#22c55e;"></span><span>Arquivo Local</span>`;
        }
    }

    // Torrent streaming status polling
    if (!isLocal && currentHash) {
        statusInterval = setInterval(async () => {
            if (isDestroyed) return;
            const data = await getStreamStatus(currentHash);
            if (!data) return;

            const spEl = playerEl.querySelector('.mf-buf-speed');
            const prEl = playerEl.querySelector('.mf-buf-peers');
            const progEl = playerEl.querySelector('.mf-buf-progress');
            const msgEl = playerEl.querySelector('.mf-buf-msg');

            if (spEl) spEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">speed</span> Velocidade: ${escapeHtml(data.downloadSpeed || '0 KB/s')}`;
            if (prEl) prEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">group</span> Peers: ${data.numPeers || 0}`;
            if (progEl) progEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">cloud_sync</span> Buffer: ${data.progress || 0}%`;

            const telemEl = playerEl.querySelector('.mf-player-telemetry-pill');
            if (telemEl) {
                telemEl.classList.remove('hide');
                telemEl.innerHTML = `<span class="mf-telemetry-dot"></span><span>${escapeHtml(data.downloadSpeed || '0 KB/s')}</span><span style="opacity:0.4;">•</span><span>${data.numPeers || 0} peers</span><span style="opacity:0.4;">•</span><span>Buffer ${data.progress || 0}%</span>`;
            }

            if (data.numPeers === 0 && msgEl) {
                msgEl.textContent = 'Conectando a sementes e peers na rede... Se demorar, experimente selecionar outra fonte na lista.';
            }

            const canStart = data.canPlay
                || data.ready
                || parseFloat(data.progress) > 0.05
                || (video.readyState >= 1);

            if (canStart) {
                safePlay();
            }
        }, 500);
    }

    // Watchdog: após 7s, se o vídeo já tem buffer ou pode tocar, força tentativa
    const watchdogTimer = setTimeout(() => {
        if (isDestroyed) return;
        if (video.readyState >= 1) {
            safePlay();
        }
    }, 7000);

    // Keyboard Shortcuts
    function handleKeyDown(e) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        showControls();

        if (e.key === ' ' || e.key === 'k' || e.key === 'MediaPlayPause') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'MediaPlay') {
            e.preventDefault();
            video.play().catch(noop);
        } else if (e.key === 'MediaPause' || e.key === 'MediaStop') {
            e.preventDefault();
            video.pause();
        } else if (e.key === 'ArrowRight' || e.key === 'MediaFastForward') {
            e.preventDefault();
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
            showSeekFeedback('+10s');
            showControls();
        } else if (e.key === 'ArrowLeft' || e.key === 'MediaRewind') {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 10);
            showSeekFeedback('-10s');
            showControls();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            volSlider.value = video.volume;
            updateVolIcon();
            showSeekFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
            showControls();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            volSlider.value = video.volume;
            updateVolIcon();
            showSeekFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
            showControls();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            video.muted = !video.muted;
            updateVolIcon();
            showSeekFeedback(video.muted ? 'Mudo' : `Volume: ${Math.round(video.volume * 100)}%`);
            showControls();
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            toggleSubtitles();
            showControls();
        } else if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            cycleSpeed();
            showControls();
        } else if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            togglePip();
            showControls();
        } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            openShortcutsModal();
        } else if (['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(e.key)) {
            e.preventDefault();
            handleExit();
        }
    }

    // Encerra imediatamente o player ao navegar para outra tela ou mudar rota
    function handleNavAway() {
        closeCinemaPlayer();
    }

    const onVisibilityChange = () => {
        if (document.hidden && video && !video.paused) {
            video.pause();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handleNavAway);
    window.addEventListener('hashchange', handleNavAway);
    window.addEventListener('pagehide', handleNavAway);
    window.addEventListener('beforeunload', handleNavAway);
    document.addEventListener('viewbeforehide', handleNavAway);
    document.addEventListener('viewshow', handleNavAway);
    document.addEventListener('visibilitychange', onVisibilityChange);
    Events.on(playbackManager, 'playbackstart', handleNavAway);

    playerEl._cleanup = () => {
        isDestroyed = true;
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', handleNavAway);
        window.removeEventListener('hashchange', handleNavAway);
        window.removeEventListener('pagehide', handleNavAway);
        window.removeEventListener('beforeunload', handleNavAway);
        document.removeEventListener('viewbeforehide', handleNavAway);
        document.removeEventListener('viewshow', handleNavAway);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        Events.off(playbackManager, 'playbackstart', handleNavAway);

        releaseWakeLock();
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
        clearTimeout(controlsTimer);
        clearTimeout(watchdogTimer);
        clearTimeout(seekDebounce);
        persistCurrentProgress();

        stopAndDestroyVideo(video);
    };

    showControls();

    setTimeout(() => {
        const playBtn = playerEl.querySelector('.mf-btn-play');
        const backBtn = playerEl.querySelector('.mf-player-btn-back');
        if (playBtn) {
            playBtn.focus();
        } else if (backBtn) {
            backBtn.focus();
        }
    }, 100);
}

export function closeCinemaPlayer() {
    const playerEl = activePlayerInstance;
    activePlayerInstance = null;

    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(noop);
    }

    if (playerEl && playerEl._cleanup) {
        try {
            playerEl._cleanup();
        } catch (_) {}
    }

    // Limpeza profunda garantida em todo o DOM e nos players
    stopAllMedia();

    if (lastFocusedBeforePlayer && typeof lastFocusedBeforePlayer.focus === 'function' && lastFocusedBeforePlayer.isConnected) {
        const el = lastFocusedBeforePlayer;
        setTimeout(() => {
            try {
                el.focus();
            } catch (_) {}
        }, 60);
    }
}
