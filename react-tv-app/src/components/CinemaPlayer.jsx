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
  const { streamUrl, title, poster, infoHash, isLocal, resumePosition = 0 } = streamConfig;

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [osdMessage, setOsdMessage] = useState('');
  const [streamStats, setStreamStats] = useState(null);
  const [isBuffering, setIsBuffering] = useState(!isLocal);

  const controlsTimeoutRef = useRef(null);
  const osdTimeoutRef = useRef(null);

  // Monta a URL completa apontando para o torrent-service
  const fullStreamUrl = streamUrl.startsWith('http')
    ? streamUrl
    : `${getServerUrl()}${streamUrl.startsWith('/') ? streamUrl : `/${streamUrl}`}`;

  const showOsd = useCallback((msg) => {
    setOsdMessage(msg);
    clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setOsdMessage('');
    }, 900);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3500);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        showOsd('Reproduzindo');
        showControlsTemporarily();
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setControlsVisible(true);
      showOsd('Pausado');
    }
  }, [showOsd, showControlsTemporarily]);

  const seekRelative = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    showOsd(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
    showControlsTemporarily();
  }, [showOsd, showControlsTemporarily]);

  const adjustVolume = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVol = Math.max(0, Math.min(1, video.volume + delta));
    video.volume = nextVol;
    showOsd(`Volume: ${Math.round(nextVol * 100)}%`);
    showControlsTemporarily();
  }, [showOsd, showControlsTemporarily]);

  // Vincula controles espaciais
  useEffect(() => {
    if (spatialNavControls) {
      spatialNavControls.onPlayPause = togglePlay;
      spatialNavControls.onSeek = seekRelative;
      spatialNavControls.onVolume = adjustVolume;
    }
  }, [spatialNavControls, togglePlay, seekRelative, adjustVolume]);

  // Carregamento inicial do vídeo e retomada de posição
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = fullStreamUrl;
    video.load();

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (resumePosition > 10 && resumePosition < (video.duration - 15)) {
        video.currentTime = resumePosition;
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
      if (video.duration) {
        setDuration(video.duration);
        // Calcula buffer
        if (video.buffered.length > 0) {
          const bufEnd = video.buffered.end(video.buffered.length - 1);
          setBufferedPercent(Math.min(100, (bufEnd / video.duration) * 100));
        }
      }
      if (isBuffering && video.currentTime > 0) {
        setIsBuffering(false);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);

      // Limpeza profunda de mídia ao desmontar o player
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
  }, [fullStreamUrl, resumePosition, infoHash, title, poster, isBuffering, showControlsTemporarily]);

  // Polling de telemetria do torrent
  useEffect(() => {
    if (isLocal || !infoHash) return;

    const interval = setInterval(async () => {
      const stats = await getStreamStatus(infoHash);
      if (stats) {
        setStreamStats(stats);
        if (stats.canPlay || stats.ready) {
          setIsBuffering(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocal, infoHash]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="tv-player-wrap" onClick={showControlsTemporarily}>
      <video
        ref={videoRef}
        className="tv-player-video"
        playsInline
        preload="auto"
      />

      {/* OSD Feedback */}
      {osdMessage && (
        <div className="tv-osd-feedback">{osdMessage}</div>
      )}

      {/* Buffer Overlay */}
      {isBuffering && (
        <div className="tv-buffer-overlay">
          <div className="tv-spinner" />
          <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Carregando filme...</h3>
          {streamStats && (
            <div className="tv-buffer-stats">
              Velocidade: {streamStats.downloadSpeed || '0 KB/s'} • Sementes: {streamStats.numPeers || 0} • Buffer: {streamStats.progress || 0}%
            </div>
          )}
        </div>
      )}

      {/* Controles da TV */}
      <div className={`tv-player-controls ${controlsVisible ? 'visible' : ''}`}>
        <div className="tv-player-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              className="tv-btn tv-btn-secondary focused"
              onClick={onClose}
              title="Voltar ao início"
            >
              <span className="material-icons">arrow_back</span>
              <span>Voltar</span>
            </button>
            <h2 className="tv-player-movie-title">{title}</h2>
          </div>

          {streamStats && (
            <div style={{ fontSize: '13px', background: 'rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: '8px' }}>
              {streamStats.downloadSpeed} • Buffer {streamStats.progress}%
            </div>
          )}
        </div>

        <div className="tv-player-bottom">
          <div className="tv-timeline-box">
            <div className="tv-timeline-track">
              <div
                className="tv-timeline-buffer"
                style={{ width: `${bufferedPercent}%` }}
              />
              <div
                className="tv-timeline-progress"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="tv-time-row">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          <div className="tv-player-btns-row">
            <button
              type="button"
              className="tv-btn tv-btn-primary focused"
              onClick={togglePlay}
            >
              <span className="material-icons">{isPlaying ? 'pause' : 'play_arrow'}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
