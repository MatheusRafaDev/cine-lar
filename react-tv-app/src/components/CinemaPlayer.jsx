import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getServerUrl, getStreamStatus, stopStream, saveWatchProgress } from '../services/api';

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

export function CinemaPlayer({
  streamConfig,
  onClose,
  spatialNavControls
}) {
  const {
    streamUrl,
    title = 'Reproduzindo',
    poster,
    backdrop,
    infoHash,
    quality = '1080p Full HD',
    isLocal,
    resumePosition = 0
  } = streamConfig;

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [osd, setOsd] = useState({ icon: '', text: '', visible: false });
  const [streamStats, setStreamStats] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const controlsTimeoutRef = useRef(null);
  const osdTimeoutRef = useRef(null);
  const bufferTimeoutRef = useRef(null);

  // Monta a URL completa apontando para o torrent-service
  const fullStreamUrl = streamUrl.startsWith('http')
    ? streamUrl
    : `${getServerUrl()}${streamUrl.startsWith('/') ? streamUrl : `/${streamUrl}`}`;

  const showOsd = useCallback((icon, text) => {
    setOsd({ icon, text, visible: true });
    clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setOsd(prev => ({ ...prev, visible: false }));
    }, 1100);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 4000);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        showOsd('play_arrow', 'Reproduzindo');
        showControlsTemporarily();
      }).catch((e) => {
        console.warn('[Player] Erro ao retomar reproducao:', e);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      setControlsVisible(true);
      showOsd('pause', 'Pausado');
    }
  }, [showOsd, showControlsTemporarily]);

  const seekRelative = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    const target = Math.max(0, Math.min(dur > 0 ? dur - 2 : Infinity, video.currentTime + seconds));
    video.currentTime = target;
    setCurrentTime(target);
    const icon = seconds > 0 ? 'forward_10' : 'replay_10';
    const text = seconds > 0 ? `+${seconds}s (${formatSeconds(target)})` : `${seconds}s (${formatSeconds(target)})`;
    showOsd(icon, text);
    showControlsTemporarily();
  }, [showOsd, showControlsTemporarily]);

  const restartVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
    video.play().catch(() => {});
    showOsd('replay', 'Reiniciado do início');
    showControlsTemporarily();
  }, [showOsd, showControlsTemporarily]);

  const adjustVolume = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVol = Math.max(0, Math.min(1, Math.round((video.volume + delta) * 10) / 10));
    video.volume = nextVol;
    const volPercent = Math.round(nextVol * 100);
    const icon = nextVol === 0 ? 'volume_off' : nextVol > 0.5 ? 'volume_up' : 'volume_down';
    showOsd(icon, `Volume: ${volPercent}%`);
    showControlsTemporarily();
  }, [showOsd, showControlsTemporarily]);

  // Listener de controle remoto direto e prioritário durante a reprodução
  useEffect(() => {
    const handlePlayerKeyDown = (e) => {
      const code = e.keyCode || e.which || 0;
      const key = e.key || '';

      // 1. Play / Pause / OK (Enter, Space, MediaPlayPause, MediaPlay, MediaPause)
      if (code === 13 || code === 10252 || code === 415 || code === 19 || code === 32 || key === 'MediaPlayPause' || key === ' ' || key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        return;
      }

      // 2. Retroceder -10s (Seta Esquerda, MediaRewind)
      if (code === 37 || code === 412 || key === 'ArrowLeft' || key === 'MediaRewind') {
        e.preventDefault();
        e.stopPropagation();
        seekRelative(-10);
        return;
      }

      // 3. Avançar +10s (Seta Direita, MediaFastForward)
      if (code === 39 || code === 417 || key === 'ArrowRight' || key === 'MediaFastForward') {
        e.preventDefault();
        e.stopPropagation();
        seekRelative(10);
        return;
      }

      // 4. Volume Mais (Seta Cima)
      if (code === 38 || key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        adjustVolume(0.1);
        return;
      }

      // 5. Volume Menos (Seta Baixo)
      if (code === 40 || key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        adjustVolume(-0.1);
        return;
      }

      // 6. Botão Voltar (Tizen 10009, Esc, Backspace)
      if (code === 10009 || code === 27 || code === 8 || key === 'Back' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (onClose) onClose();
        return;
      }
    };

    window.addEventListener('keydown', handlePlayerKeyDown, true);
    return () => window.removeEventListener('keydown', handlePlayerKeyDown, true);
  }, [togglePlay, seekRelative, adjustVolume, onClose]);

  // Carregamento do vídeo e tratamento de eventos nativos
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setIsBuffering(true);
    video.src = fullStreamUrl;
    video.load();

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
      }
      if (resumePosition > 10 && dur && resumePosition < (dur - 15)) {
        video.currentTime = resumePosition;
        showOsd('history', `Retomando de ${formatSeconds(resumePosition)}`);
      }
      video.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
        showControlsTemporarily();
      }).catch(() => {
        setIsBuffering(false);
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const dur = video.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
        if (video.buffered.length > 0) {
          const bufEnd = video.buffered.end(video.buffered.length - 1);
          setBufferedPercent(Math.min(100, (bufEnd / dur) * 100));
        }
      }
      if (isBuffering && video.currentTime > 0) {
        setIsBuffering(false);
      }
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };

    const handleError = (e) => {
      console.warn('[Player] Erro no video HTML5:', e);
      setHasError(true);
      setIsBuffering(false);
      setErrorMessage('Não foi possível reproduzir este fluxo. O formato pode requerer transcodificação ou o arquivo foi movido.');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);

      // Limpeza profunda de decodificadores ao fechar o player
      try {
        if (video.duration && video.currentTime > 5) {
          saveWatchProgress({
            id: infoHash || title,
            title,
            poster,
            position: video.currentTime,
            duration: video.duration
          });
        }
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.removeAttribute('src');
        video.src = '';
        video.load();
      } catch (_) {}

      // Libera stream no servidor backend
      if (infoHash) {
        stopStream(infoHash).catch(() => {});
      }
    };
  }, [fullStreamUrl, resumePosition, infoHash, title, poster, showControlsTemporarily, showOsd]);

  // Polling de telemetria do torrent
  useEffect(() => {
    if (isLocal || !infoHash) return;

    const interval = setInterval(async () => {
      const stats = await getStreamStatus(infoHash);
      if (stats) {
        setStreamStats(stats);
        if ((stats.canPlay || stats.ready) && isBuffering && videoRef.current?.currentTime > 0) {
          setIsBuffering(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocal, infoHash, isBuffering]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = duration > currentTime ? duration - currentTime : 0;

  return (
    <div className="tv-player-wrap" onClick={showControlsTemporarily}>
      <video
        ref={videoRef}
        className="tv-player-video"
        playsInline
        preload="auto"
      />

      {/* OSD Feedback Central (Pausado, +10s, Volume) */}
      {osd.visible && (
        <div className="tv-osd-feedback">
          <span className="material-icons" style={{ fontSize: '38px', color: 'var(--primary)' }}>
            {osd.icon}
          </span>
          <span>{osd.text}</span>
        </div>
      )}

      {/* Tela de Erro com Recuperação */}
      {hasError && (
        <div className="tv-buffer-overlay" style={{ background: 'rgba(11, 11, 10, 0.95)' }}>
          <span className="material-icons" style={{ fontSize: '64px', color: '#ef4444' }}>error_outline</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Falha na Reprodução</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px', textAlign: 'center', lineHeight: 1.5 }}>
            {errorMessage}
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <button
              type="button"
              className="tv-btn tv-btn-primary focused"
              onClick={onClose}
            >
              <span className="material-icons">list</span>
              <span>Escolher Outra Opção</span>
            </button>
            <button
              type="button"
              className="tv-btn tv-btn-secondary"
              onClick={() => {
                setHasError(false);
                setIsBuffering(true);
                if (videoRef.current) {
                  videoRef.current.src = fullStreamUrl;
                  videoRef.current.load();
                }
              }}
            >
              <span className="material-icons">refresh</span>
              <span>Tentar Novamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Overlay de Buffer e Conexão ao Enxame */}
      {isBuffering && !hasError && (
        <div className="tv-buffer-overlay">
          <div className="tv-spinner" />
          <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '8px' }}>
            {isLocal ? 'Carregando arquivo local...' : 'Conectando ao enxame de sementes...'}
          </h3>
          {streamStats && (
            <div className="tv-buffer-stats-box">
              <div className="tv-buffer-stats-item">
                <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)' }}>speed</span>
                <span>{streamStats.downloadSpeed || '0 KB/s'}</span>
              </div>
              <div className="tv-buffer-stats-item">
                <span className="material-icons" style={{ fontSize: '18px', color: 'var(--accent)' }}>group</span>
                <span>{streamStats.numPeers || 0} sementes</span>
              </div>
              <div className="tv-buffer-stats-item">
                <span className="material-icons" style={{ fontSize: '18px', color: '#22c55e' }}>data_usage</span>
                <span>Buffer: {streamStats.progress || 0}%</span>
              </div>
            </div>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-subtle)', marginTop: '6px' }}>
            Dica: Pressione OK / Enter para pausar a qualquer momento.
          </p>
        </div>
      )}

      {/* Controles de Cinema da TV */}
      <div className={`tv-player-controls ${controlsVisible ? 'visible' : ''}`}>
        {/* Barra Superior */}
        <div className="tv-player-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              type="button"
              className="tv-player-icon-btn"
              onClick={onClose}
              title="Voltar"
            >
              <span className="material-icons" style={{ fontSize: '26px' }}>arrow_back</span>
            </button>

            <div>
              <h2 className="tv-player-movie-title">{title}</h2>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <span className="tv-badge-pill" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)' }}>
                  {quality}
                </span>
                {isLocal ? (
                  <span className="tv-badge-pill" style={{ fontSize: '11px', background: '#22c55e', color: '#000' }}>
                    Arquivo Local
                  </span>
                ) : (
                  <span className="tv-badge-pill" style={{ fontSize: '11px', background: 'rgba(229, 9, 20, 0.25)', color: 'var(--primary)', borderColor: 'rgba(229, 9, 20, 0.5)' }}>
                    Torrent Streaming
                  </span>
                )}
              </div>
            </div>
          </div>

          {streamStats && (
            <div className="tv-player-telemetry-badge">
              <span style={{ color: 'var(--accent)' }}>{streamStats.numPeers || 0} sementes</span>
              <span>•</span>
              <span style={{ color: '#22c55e' }}>{streamStats.downloadSpeed}</span>
              <span>•</span>
              <span>Buffer {streamStats.progress}%</span>
            </div>
          )}
        </div>

        {/* Barra Inferior com Linha do Tempo Estilo Netflix */}
        <div className="tv-player-bottom">
          <div className="tv-timeline-box">
            <div className="tv-timeline-track" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              if (duration > 0 && videoRef.current) {
                videoRef.current.currentTime = pos * duration;
              }
            }}>
              <div
                className="tv-timeline-buffer"
                style={{ width: `${bufferedPercent}%` }}
              />
              <div
                className="tv-timeline-progress"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="tv-timeline-thumb" />
              </div>
            </div>

            <div className="tv-time-row">
              <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{formatSeconds(currentTime)}</span>
              <span style={{ color: 'var(--text-subtle)' }}>
                {duration > 0 ? `-${formatSeconds(remainingTime)}  /  ${formatSeconds(duration)}` : '00:00'}
              </span>
            </div>
          </div>

          <div className="tv-player-btns-row">
            <button
              type="button"
              className="tv-btn tv-btn-primary focused"
              onClick={togglePlay}
            >
              <span className="material-icons" style={{ fontSize: '24px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'Pausar (OK)' : 'Reproduzir (OK)'}</span>
            </button>

            <button
              type="button"
              className="tv-btn tv-btn-secondary"
              onClick={() => seekRelative(-10)}
            >
              <span className="material-icons">replay_10</span>
              <span>-10s</span>
            </button>

            <button
              type="button"
              className="tv-btn tv-btn-secondary"
              onClick={() => seekRelative(10)}
            >
              <span className="material-icons">forward_10</span>
              <span>+10s</span>
            </button>

            <button
              type="button"
              className="tv-btn tv-btn-secondary"
              onClick={restartVideo}
              title="Reiniciar filme do início"
            >
              <span className="material-icons">replay</span>
              <span>Reiniciar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default CinemaPlayer;
