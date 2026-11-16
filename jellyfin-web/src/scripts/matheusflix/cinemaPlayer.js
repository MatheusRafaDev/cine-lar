/**
 * MatheusFlix Cinema Player
 * Player integrado com suporte a HTTP 206 Range (Offline/Local ou Streaming de Torrents)
 * Controles de cinema, barra de progresso, volume, atalhos de teclado e telemetria de buffer.
 */

import { API_BASE, getStreamStatus, saveWatchProgress } from './api';
import { escapeHtml, parseDuration } from './utils';
import toast from 'components/toast/toast';
import { playbackManager } from 'components/playback/playbackmanager';
import Events from 'utils/events';

let activePlayerInstance = null;
let lastFocusedBeforePlayer = null;
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
    infoHash = null,
    movieId = null,
    poster = null,
    resumePosition = 0,
    duration = 0
}) {
    if (document.activeElement && document.activeElement !== document.body) {
        lastFocusedBeforePlayer = document.activeElement;
    }

    // 1. Encerra qualquer reprodução cinema ativa para garantir apenas UM filme por vez
    if (activePlayerInstance) {
        closeCinemaPlayer();
    }

    // 2. Interrompe qualquer mídia nativa do Jellyfin para não rodar simultaneamente
    try {
        if (playbackManager && (playbackManager.isPlaying?.() || playbackManager.isPlayingVideo?.() || playbackManager.isPlayingAudio?.())) {
            playbackManager.stop();
        }
    } catch (_) {}

    // 3. Força interrupção e limpeza de quaisquer elementos de vídeo e áudio existentes na página
    document.querySelectorAll('video, audio').forEach((media) => {
        try {
            media.pause();
            media.removeAttribute('src');
            media.src = '';
            media.load();
        } catch (_) {}
    });

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

    const fullStreamUrl = streamUrl.startsWith('http') ? streamUrl : `${API_BASE.replace('/api', '')}${streamUrl}`;

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
                <button type="button" class="mf-btn-cast-tv focusable" title="Transmitir na TV">
                    <span class="material-icons">cast</span>
                    <span>TV</span>
                </button>
                <button type="button" class="mf-player-close-btn focusable" title="Fechar (Esc)">
                    <span class="material-icons">close</span>
                </button>
            </div>
        </div>

        <div class="mf-player-video-wrap">
            <video class="mf-player-video" playsinline preload="auto" controlslist="nodownload"></video>

            <div class="mf-player-buffer-overlay" style="${isLocal ? 'display: none;' : ''}">
                <div class="mf-player-spinner">
                    <span class="material-icons">sync</span>
                </div>
                <h2 class="mf-buf-title">Conectando e Carregando Filme...</h2>
                <p class="mf-buf-msg">
                    O MatheusFlix está preparando o filme para você começar a assistir imediatamente!
                </p>
                <div class="mf-buffer-stats">
                    <span class="mf-buffer-pill mf-buf-speed"><span class="material-icons">speed</span> Velocidade: ...</span>
                    <span class="mf-buffer-pill mf-buf-peers"><span class="material-icons">group</span> Peers: ...</span>
                    <span class="mf-buffer-pill mf-buf-progress"><span class="material-icons">cloud_sync</span> Buffer: 0%</span>
                </div>
                <button type="button" class="mf-btn-force-play focusable">
                    <span class="material-icons">play_arrow</span>
                    <span>Forçar Reprodução</span>
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

                    <button type="button" class="mf-ctrl-btn mf-btn-subtitles focusable" title="Legendas e Áudio (S)">
                        <span class="material-icons">subtitles</span>
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

    // Força pré-carregamento imediato
    video.src = fullStreamUrl;
    video.preload = 'auto';
    video.load();

    function forcePlay() {
        const p = video.play();
        if (p && typeof p.then === 'function') {
            p.then(() => {
                hideOverlay();
            }).catch(() => {
                // Tenta mutado se o navegador restringir reprodução automática com áudio
                video.muted = true;
                video.play().then(hideOverlay).catch(noop);
            });
        }
    }

    // Tenta iniciar a reprodução imediatamente
    forcePlay();

    const btnForcePlay = playerEl.querySelector('.mf-btn-force-play');
    if (btnForcePlay) {
        btnForcePlay.addEventListener('click', (e) => {
            e.stopPropagation();
            hideOverlay();
            forcePlay();
        });
    }

    function hideOverlay() {
        if (overlay && overlay.style.display !== 'none') {
            overlay.style.display = 'none';
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

    function handleExit() {
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

    const btnCastTv = playerEl.querySelector('.mf-btn-cast-tv');
    if (btnCastTv) {
        const canCast = Boolean(video.remote && typeof video.remote.prompt === 'function');
        if (!canCast) {
            btnCastTv.remove();
        } else {
            btnCastTv.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
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

    let totalDuration = parseDuration({ duration });

    // Se a duração não foi passada pelo chamador, obtém via cabeçalho HEAD do servidor
    if (!totalDuration || totalDuration <= 0) {
        fetch(fullStreamUrl, { method: 'HEAD' }).then(res => {
            const d = parseFloat(res.headers.get('x-media-duration'));
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
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
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
        if (movieId && dur > 0 && currentSec > 5) {
            const isCompleted = (currentSec / dur) >= 0.90;
            saveWatchProgress({
                movieId,
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
        hideOverlay();
        updateDurationUI();
        video.play().catch(() => {
            // Se autoplay bloqueado pelo navegador, inicia mutado
            video.muted = true;
            video.play().then(() => {
                toast('Vídeo pronto. Clique no player para ativar o som.');
            }).catch(noop);
        });
    });

    video.addEventListener('canplay', () => {
        hideOverlay();
        updateDurationUI();
        tryResumePlayback();
        video.play().catch(noop);
    });

    video.addEventListener('play', () => {
        btnPlay.querySelector('.material-icons').textContent = 'pause';
        hideOverlay();
        showControls();
        requestWakeLock();
    });

    video.addEventListener('playing', () => {
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
        if (!totalDuration && video.duration && isFinite(video.duration) && video.duration > 180) {
            totalDuration = Math.round(video.duration);
        }
        updateDurationUI();
        tryResumePlayback();
        hideOverlay();
        video.play().catch(noop);
    });

    // Tratamento de Erros e Auto-recuperação com Transcode
    video.addEventListener('error', () => {
        if (video.error && video.error.code === 1) return; // MEDIA_ERR_ABORTED

        console.warn('[CinemaPlayer] Erro de mídia detectado:', video.error);

        // Se o navegador falhou ao decodificar (ex: MKV ou áudio AC3) e ainda não tentamos o transcode
        if (!hasFallbackTranscoded && !fullStreamUrl.includes('transcode=1')) {
            hasFallbackTranscoded = true;
            const sep = fullStreamUrl.includes('?') ? '&' : '?';
            const fallbackUrl = `${fullStreamUrl}${sep}transcode=1`;
            console.log('[CinemaPlayer] Ativando conversao em tempo real (remux):', fallbackUrl);
            toast('Ajustando formato para compatibilidade com o navegador...');

            video.src = fallbackUrl;
            video.load();
            video.play().then(hideOverlay).catch(() => {
                video.muted = true;
                video.play().then(hideOverlay).catch(noop);
            });
            return;
        }

        const msgEl = playerEl.querySelector('.mf-buf-msg');
        if (msgEl) {
            msgEl.textContent = 'Não foi possível reproduzir este vídeo diretamente. O arquivo pode estar incompleto ou requer outro codec. Experimente selecionar outra opção da lista.';
        }
        toast('Erro ao carregar o vídeo. Tente outra fonte.');
    });

    // Torrent streaming status polling
    if (!isLocal && currentHash) {
        statusInterval = setInterval(async () => {
            const data = await getStreamStatus(currentHash);
            if (!data) return;

            const spEl = playerEl.querySelector('.mf-buf-speed');
            const prEl = playerEl.querySelector('.mf-buf-peers');
            const progEl = playerEl.querySelector('.mf-buf-progress');
            const msgEl = playerEl.querySelector('.mf-buf-msg');

            if (spEl) spEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">speed</span> Velocidade: ${escapeHtml(data.downloadSpeed || '0 KB/s')}`;
            if (prEl) prEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">group</span> Peers: ${data.numPeers || 0}`;
            if (progEl) progEl.innerHTML = `<span class="material-icons" style="font-size: 14px; vertical-align: middle;">cloud_sync</span> Buffer: ${data.progress || 0}%`;

            if (data.numPeers === 0 && msgEl) {
                msgEl.textContent = 'Conectando a sementes e peers na rede... Se demorar, experimente selecionar outra fonte na lista.';
            }

            const canStart = data.canPlay
                || data.ready
                || parseFloat(data.progress) > 0.05
                || (video.readyState >= 1);

            if (canStart) {
                forcePlay();
            }
        }, 500);
    }

    // Watchdog: após 7s, se o vídeo já tem buffer ou pode tocar, força tentativa
    const watchdogTimer = setTimeout(() => {
        if (video.readyState >= 1) {
            video.play().then(hideOverlay).catch(noop);
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
            showControls();
        } else if (e.key === 'ArrowLeft' || e.key === 'MediaRewind') {
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
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            toggleSubtitles();
            showControls();
        } else if (['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(e.key)) {
            e.preventDefault();
            handleExit();
        }
    }

    // Encerra imediatamente o player ao navegar para outra tela ou mudar rota
    function handleNavAway() {
        closeCinemaPlayer();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handleNavAway);
    window.addEventListener('hashchange', handleNavAway);
    window.addEventListener('pagehide', handleNavAway);
    window.addEventListener('beforeunload', handleNavAway);
    document.addEventListener('viewbeforehide', handleNavAway);
    document.addEventListener('viewshow', handleNavAway);
    Events.on(playbackManager, 'playbackstart', handleNavAway);

    playerEl._cleanup = () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', handleNavAway);
        window.removeEventListener('hashchange', handleNavAway);
        window.removeEventListener('pagehide', handleNavAway);
        window.removeEventListener('beforeunload', handleNavAway);
        document.removeEventListener('viewbeforehide', handleNavAway);
        document.removeEventListener('viewshow', handleNavAway);
        Events.off(playbackManager, 'playbackstart', handleNavAway);

        releaseWakeLock();
        if (statusInterval) clearInterval(statusInterval);
        clearTimeout(controlsTimer);
        clearTimeout(watchdogTimer);
        persistCurrentProgress();

        try {
            video.pause();
            video.removeAttribute('src');
            video.src = '';
            video.load();
        } catch (_) {}
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
    if (!activePlayerInstance) return;

    const playerEl = activePlayerInstance;
    activePlayerInstance = null;

    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(noop);
    }

    if (playerEl._cleanup) {
        playerEl._cleanup();
    }

    const video = playerEl.querySelector('video');
    if (video) {
        try {
            video.pause();
            video.removeAttribute('src');
            video.src = '';
            video.load();
        } catch (_) {}
    }

    playerEl.remove();
    document.body.style.overflow = '';

    if (lastFocusedBeforePlayer && typeof lastFocusedBeforePlayer.focus === 'function' && lastFocusedBeforePlayer.isConnected) {
        const el = lastFocusedBeforePlayer;
        setTimeout(() => {
            try {
                el.focus();
            } catch (_) {}
        }, 60);
    }
}
