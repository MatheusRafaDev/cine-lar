/**
 * MatheusFlix Cinema Player
 * Player integrado com suporte a HTTP 206 Range (Offline/Local ou Streaming de Torrents)
 * Controles de cinema, barra de progresso, volume, atalhos de teclado e telemetria de buffer.
 */

import { API_BASE, getStreamStatus } from './api';
import { escapeHtml } from './utils';
import toast from 'components/toast/toast';

let activePlayerInstance = null;
const noop = () => {
    // Intentionally empty no-op handler
};

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
    infoHash = null
}) {
    if (activePlayerInstance) {
        closeCinemaPlayer();
    }

    const fullStreamUrl = streamUrl.startsWith('http') ? streamUrl : `${API_BASE.replace('/api', '')}${streamUrl}`;

    const playerEl = document.createElement('div');
    playerEl.className = 'mf-cinema-player';
    playerEl.innerHTML = `
        <div class="mf-player-topbar">
            <div class="mf-player-meta">
                <h3 class="mf-player-title">${escapeHtml(title)}</h3>
                <span class="mf-player-sub">${escapeHtml(subInfo || quality)}</span>
            </div>
            <div class="mf-player-top-actions">
                <button type="button" class="mf-btn-cast-tv" title="Transmitir na TV">
                    <span class="material-icons" style="font-size: 18px;">cast</span>
                    <span>TV</span>
                </button>
                <button type="button" class="mf-player-close-btn" title="Fechar (Esc)">✕</button>
            </div>
        </div>

        <div class="mf-player-video-wrap">
            <video class="mf-player-video" playsinline preload="auto">
                <source src="${fullStreamUrl}" type="video/mp4">
            </video>

            ${!isLocal ? `
            <div class="mf-player-buffer-overlay">
                <div class="mf-player-spinner">🍿</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Conectando e Carregando Filme...</h2>
                <p style="margin: 0 0 16px 0; color: #a0a6b5; font-size: 14px; max-width: 480px;">
                    O MatheusFlix está baixando os primeiros megabytes para você começar a assistir imediatamente!
                </p>
                <div class="mf-buffer-stats">
                    <span class="mf-buffer-pill mf-buf-speed">⚡ Velocidade: ...</span>
                    <span class="mf-buffer-pill mf-buf-peers">👥 Peers: ...</span>
                    <span class="mf-buffer-pill mf-buf-progress">📊 Buffer: 0%</span>
                </div>
            </div>
            ` : ''}
        </div>

        <div class="mf-player-bottom-bar">
            <div class="mf-player-timeline">
                <input type="range" class="mf-player-seek" min="0" max="100" value="0" step="0.1" />
                <div class="mf-player-progress-fill"></div>
                <div class="mf-player-buffer-fill"></div>
            </div>

            <div class="mf-player-controls-row">
                <div class="mf-player-controls-left">
                    <button type="button" class="mf-ctrl-btn mf-btn-play" title="Play/Pause (Espaço)">
                        <span class="material-icons">play_arrow</span>
                    </button>
                    <button type="button" class="mf-ctrl-btn mf-btn-rw" title="Voltar 10s (←)">
                        <span class="material-icons">replay_10</span>
                    </button>
                    <button type="button" class="mf-ctrl-btn mf-btn-ff" title="Avançar 10s (→)">
                        <span class="material-icons">forward_10</span>
                    </button>

                    <div class="mf-player-time">
                        <span class="mf-time-cur">00:00</span> / <span class="mf-time-dur">00:00</span>
                    </div>
                </div>

                <div class="mf-player-controls-right">
                    <div class="mf-player-vol-wrap">
                        <button type="button" class="mf-ctrl-btn mf-btn-vol" title="Mudo (M)">
                            <span class="material-icons">volume_up</span>
                        </button>
                        <input type="range" class="mf-player-vol-slider" min="0" max="1" step="0.05" value="1" />
                    </div>

                    <span class="mf-player-quality-tag">${quality}</span>

                    <button type="button" class="mf-ctrl-btn mf-btn-fullscreen" title="Tela Cheia (F)">
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
        if (video.paused) {
            video.play().catch(noop);
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

    btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });

    btnRw.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = Math.max(0, video.currentTime - 10);
    });

    btnFf.addEventListener('click', (e) => {
        e.stopPropagation();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    });

    btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
    });

    btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCinemaPlayer();
    });

    const btnCastTv = playerEl.querySelector('.mf-btn-cast-tv');
    if (btnCastTv) {
        const canCast = Boolean(video.remote && typeof video.remote.prompt === 'function');
        if (!canCast) {
            btnCastTv.remove();
        } else {
            btnCastTv.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // Abre o seletor nativo do navegador (Chromecast / TVs compatíveis na mesma rede)
                    await video.remote.prompt();
                } catch (err) {
                    if (err?.name === 'NotFoundError') {
                        toast('Nenhuma TV encontrada. Ligue a TV/Chromecast na mesma rede Wi-Fi.');
                    } else if (err?.name !== 'AbortError') {
                        toast('Não foi possível transmitir este vídeo para a TV.');
                    }
                }
            });
        }
    }

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

    // Seek controls
    seekSlider.addEventListener('input', () => {
        const pct = parseFloat(seekSlider.value);
        if (video.duration) {
            video.currentTime = (pct / 100) * video.duration;
        }
    });

    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const pct = (video.currentTime / video.duration) * 100;
            seekSlider.value = pct;
            progressFill.style.width = `${pct}%`;
            timeCur.textContent = formatSeconds(video.currentTime);
            timeDur.textContent = formatSeconds(video.duration);
        }

        // Buffer fill
        if (video.buffered.length > 0 && video.duration) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const bPct = (bufferedEnd / video.duration) * 100;
            bufferFill.style.width = `${bPct}%`;
        }
    });

    video.addEventListener('play', () => {
        btnPlay.querySelector('.material-icons').textContent = 'pause';
        if (overlay) overlay.style.display = 'none';
        showControls();
    });

    video.addEventListener('playing', () => {
        btnPlay.querySelector('.material-icons').textContent = 'pause';
        if (overlay) overlay.style.display = 'none';
        showControls();
    });

    video.addEventListener('canplay', () => {
        if (isLocal) {
            video.play().catch(noop);
        }
    });

    video.addEventListener('pause', () => {
        btnPlay.querySelector('.material-icons').textContent = 'play_arrow';
        playerEl.classList.add('controls-visible');
    });

    video.addEventListener('loadedmetadata', () => {
        timeDur.textContent = formatSeconds(video.duration);
        if (isLocal) {
            video.play().catch(noop);
        }
    });

    // Torrent streaming status polling
    if (!isLocal && infoHash) {
        statusInterval = setInterval(async () => {
            const data = await getStreamStatus(infoHash);
            if (!data) return;

            const spEl = playerEl.querySelector('.mf-buf-speed');
            const prEl = playerEl.querySelector('.mf-buf-peers');
            const progEl = playerEl.querySelector('.mf-buf-progress');

            if (spEl) spEl.textContent = `⚡ Velocidade: ${data.downloadSpeed}`;
            if (prEl) prEl.textContent = `👥 Peers: ${data.numPeers}`;
            if (progEl) progEl.textContent = `📊 Buffer: ${data.progress}%`;

            if (data.canPlay && overlay && overlay.style.display !== 'none') {
                video.play().then(() => {
                    overlay.style.display = 'none';
                }).catch(noop);
            }
        }, 1200);
    }

    // Keyboard Shortcuts
    function handleKeyDown(e) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        if (e.key === ' ' || e.key === 'k') {
            e.preventDefault();
            togglePlay();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
            showControls();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 10);
            showControls();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            volSlider.value = video.volume;
            updateVolIcon();
            showControls();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            volSlider.value = video.volume;
            updateVolIcon();
            showControls();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            video.muted = !video.muted;
            updateVolIcon();
            showControls();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(noop);
            } else {
                closeCinemaPlayer();
            }
        }
    }

    window.addEventListener('keydown', handleKeyDown);

    playerEl._cleanup = () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (statusInterval) clearInterval(statusInterval);
        clearTimeout(controlsTimer);
        video.pause();
        video.src = '';
    };

    showControls();
}

export function closeCinemaPlayer() {
    if (activePlayerInstance) {
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(noop);
        }
        if (activePlayerInstance._cleanup) {
            activePlayerInstance._cleanup();
        }
        activePlayerInstance.remove();
        activePlayerInstance = null;
    }
}

