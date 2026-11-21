import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getServerUrl, getStreamStatus, stopStream, saveWatchProgress, clearWatchProgress } from '../services/api';

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
  streamConfig = {},
  onClose,
  spatialNavControls
}) {
  const {
    id = '',
    movieId = '',
    imdbId = '',
    streamUrl,
    title = 'Reproduzindo',
    poster = '',
    backdrop = '',
    infoHash = null,
    quality = '1080p Full HD',
    isLocal = false,
    filePath = '',
    videoPath = '',
    duration: initialDuration = 0,
    resumePosition = 0,
    isSeries = false,
    season = null,
    episode = null,
    episodeName = '',
    year = ''
  } = streamConfig;

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [scrubTime, setScrubTime] = useState(null);
  const [duration, setDuration] = useState(Number(initialDuration) || 0);
  const durationRef = useRef(Number(initialDuration) || 0);
  const serverDurationRef = useRef(Number(initialDuration) || 0);
  const streamOffsetRef = useRef(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [focusZone, setFocusZone] = useState('timeline'); // 'timeline' | 'buttons' | 'top'
  const [focusedBtnIndex, setFocusedBtnIndex] = useState(0);
  const [osd, setOsd] = useState({ icon: '', text: '', visible: false });
  const [streamStats, setStreamStats] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [effectiveQuality, setEffectiveQuality] = useState(quality);

  useEffect(() => {
    setEffectiveQuality(quality);
  }, [quality]);

  const controlsTimeoutRef = useRef(null);
  const osdTimeoutRef = useRef(null);
  const bufferTimeoutRef = useRef(null);
  const scrubCommitTimerRef = useRef(null);
  const scrubTargetRef = useRef(null);
  const scrubStepCountRef = useRef(0);
  const lastScrubKeyTimeRef = useRef(0);
  const hasResumedRef = useRef(false);
  const lastSavedPosRef = useRef(0);

  // Função centralizada para salvar e persistir o progresso de exibição
  const persistProgress = useCallback((pos, dur) => {
    if (!dur || isNaN(dur) || pos < 5) return;
    const effectiveId = id || movieId || imdbId || filePath || videoPath || infoHash || title;
    if (!effectiveId) return;

    const completed = (pos / dur) >= 0.92;
    if (completed) {
      clearWatchProgress(effectiveId);
    } else {
      saveWatchProgress({
        id: effectiveId,
        movieId: movieId || effectiveId,
        imdbId: imdbId || '',
        title,
        poster,
        backdrop,
        position: pos,
        duration: dur,
        isLocal: Boolean(isLocal || filePath || videoPath),
        filePath: filePath || videoPath || '',
        streamUrl,
        infoHash,
        quality,
        isSeries: Boolean(isSeries),
        season,
        episode,
        episodeName,
        year
      });
    }
  }, [id, movieId, imdbId, filePath, videoPath, infoHash, title, poster, backdrop, isLocal, streamUrl, quality, isSeries, season, episode, episodeName, year]);

  // Monta a URL completa apontando para o torrent-service
  const safeStreamUrl = typeof streamUrl === 'string' ? streamUrl.trim() : '';
  const fullStreamUrl = safeStreamUrl.startsWith('http')
    ? safeStreamUrl
    : (safeStreamUrl ? `${getServerUrl()}${safeStreamUrl.startsWith('/') ? safeStreamUrl : `/${safeStreamUrl}`}` : '');

  const showOsd = useCallback((icon, text, holdMs = 1200) => {
    setOsd({ icon, text, visible: true });
    clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setOsd(prev => ({ ...prev, visible: false }));
    }, holdMs);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && scrubTargetRef.current === null) {
        setControlsVisible(false);
      }
    }, 4500);
  }, []);

  const getEffectiveDuration = useCallback(() => {
    const video = videoRef.current;
    const vidDur = (video && video.duration && !isNaN(video.duration) && isFinite(video.duration))
      ? (streamOffsetRef.current + video.duration)
      : 0;
    return Math.max(serverDurationRef.current || 0, durationRef.current || 0, vidDur);
  }, []);

  const loadWithStartOffset = useCallback((offsetSec) => {
    const video = videoRef.current;
    if (!video || !fullStreamUrl) {
      setHasError(true);
      setErrorMessage('Não foi possível localizar o endereço de reprodução.');
      setIsBuffering(false);
      return;
    }
    const cleanOffset = Math.max(0, Math.floor(offsetSec));
    streamOffsetRef.current = cleanOffset;
    setCurrentTime(cleanOffset);
    setScrubTime(null);
    scrubTargetRef.current = null;

    // Se for stream externo da nuvem (Google Drive / HTTPS direto), usa seek nativo via Range requests
    const isCloudStream = fullStreamUrl.includes('drive.google.com') || fullStreamUrl.includes('drive.usercontent.google.com') || (!fullStreamUrl.includes('/api/local/stream') && !fullStreamUrl.includes('/api/stream/'));
    if (isCloudStream) {
      if (video.src !== fullStreamUrl) {
        video.src = fullStreamUrl;
        video.load();
      }
      try {
        video.currentTime = cleanOffset;
        video.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => {});
        return;
      } catch (_) {}
    }

    const baseUrl = fullStreamUrl
      .replace(/([?&])startTime=[^&]+(&?)/i, (m, p1, p2) => (p2 ? p1 : ''))
      .replace(/[?&]$/, '');
    const sep = baseUrl.includes('?') ? '&' : '?';
    video.src = cleanOffset > 0 ? `${baseUrl}${sep}startTime=${cleanOffset}` : baseUrl;
    video.load();
    video.play().then(() => {
      setIsPlaying(true);
      setIsBuffering(false);
    }).catch(() => {});
  }, [fullStreamUrl]);

  // Verifica se o elemento <video> consegue fazer seek nativo sem recarregar com startTime no FFmpeg
  const canSeekNativelyTo = useCallback((targetSec) => {
    const video = videoRef.current;
    if (!video) return false;
    const isCloudStream = fullStreamUrl.includes('drive.google.com') || fullStreamUrl.includes('drive.usercontent.google.com') || (!fullStreamUrl.includes('/api/local/stream') && !fullStreamUrl.includes('/api/stream/'));
    if (isCloudStream) {
      return true;
    }
    if (streamOffsetRef.current > 0) return false;
    const fPath = (filePath || videoPath || fullStreamUrl || '').toLowerCase();
    if (fPath.includes('.mkv') || fPath.includes('.avi') || fPath.includes('transcode=1')) {
      return false;
    }
    if (!video.duration || !isFinite(video.duration)) return false;
    if (video.seekable && video.seekable.length > 0) {
      const seekEnd = video.seekable.end(video.seekable.length - 1);
      if (targetSec <= seekEnd - 1) return true;
    }
    return false;
  }, [filePath, videoPath, fullStreamUrl]);

  // Executa o salto definitivo para o segundo escolhido
  const commitSeek = useCallback((targetSec) => {
    if (scrubCommitTimerRef.current) {
      clearTimeout(scrubCommitTimerRef.current);
      scrubCommitTimerRef.current = null;
    }
    const video = videoRef.current;
    if (!video) return;

    const dur = getEffectiveDuration();
    const clamped = Math.max(0, dur > 2 ? Math.min(dur - 2, targetSec) : targetSec);

    scrubTargetRef.current = null;
    scrubStepCountRef.current = 0;
    setScrubTime(null);
    setCurrentTime(clamped);

    if (canSeekNativelyTo(clamped)) {
      try {
        video.currentTime = clamped;
        if (video.paused) {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      } catch (_) {
        loadWithStartOffset(clamped);
      }
    } else {
      loadWithStartOffset(clamped);
    }

    if (dur > 0) {
      persistProgress(clamped, dur);
    }
    showControlsTemporarily();
  }, [getEffectiveDuration, canSeekNativelyTo, loadWithStartOffset, persistProgress, showControlsTemporarily]);

  // Scrubbing suave e acelerado ao navegar pela barra de progresso (D-Pad Esquerda / Direita)
  const scheduleScrub = useCallback((direction, fixedSeconds = null) => {
    const video = videoRef.current;
    if (!video) return;

    const now = Date.now();
    const isRapidRepeat = (now - lastScrubKeyTimeRef.current) < 750;
    lastScrubKeyTimeRef.current = now;

    if (fixedSeconds !== null) {
      scrubStepCountRef.current = 0;
    } else {
      scrubStepCountRef.current = isRapidRepeat ? (scrubStepCountRef.current + 1) : 1;
    }

    // Aceleração progressiva estilo Smart TV (10s -> 30s -> 1m -> 3m ao segurar/apertar rápido)
    let stepSec = fixedSeconds !== null ? Math.abs(fixedSeconds) : 10;
    if (fixedSeconds === null) {
      const count = scrubStepCountRef.current;
      if (count >= 14) stepSec = 180;
      else if (count >= 8) stepSec = 60;
      else if (count >= 4) stepSec = 30;
      else stepSec = 10;
    }

    const delta = direction >= 0 ? stepSec : -stepSec;
    const dur = getEffectiveDuration();
    const basePos = scrubTargetRef.current !== null
      ? scrubTargetRef.current
      : (streamOffsetRef.current + (video.currentTime || 0));

    const nextTarget = Math.max(0, dur > 2 ? Math.min(dur - 2, basePos + delta) : (basePos + delta));
    scrubTargetRef.current = nextTarget;
    setScrubTime(nextTarget);
    setCurrentTime(nextTarget);

    const stepLabel = stepSec >= 60 ? `${Math.round(stepSec / 60)} min` : `${stepSec}s`;
    const sign = direction >= 0 ? '+' : '-';
    const icon = direction >= 0 ? 'fast_forward' : 'fast_rewind';
    showOsd(icon, `${sign}${stepLabel}  •  ${formatSeconds(nextTarget)}${dur > 0 ? ` / ${formatSeconds(dur)}` : ''}`, 1500);
    setControlsVisible(true);
    clearTimeout(controlsTimeoutRef.current);

    if (scrubCommitTimerRef.current) {
      clearTimeout(scrubCommitTimerRef.current);
    }
    scrubCommitTimerRef.current = setTimeout(() => {
      if (scrubTargetRef.current !== null) {
        commitSeek(scrubTargetRef.current);
      }
    }, 420);
  }, [getEffectiveDuration, showOsd, commitSeek]);

  const seekRelative = useCallback((seconds) => {
    scheduleScrub(seconds >= 0 ? 1 : -1, Math.abs(seconds));
  }, [scheduleScrub]);

  const togglePlay = useCallback(() => {
    // Se o usuário estava arrastando a barra e apertou OK, confirma o salto imediatamente!
    if (scrubTargetRef.current !== null) {
      commitSeek(scrubTargetRef.current);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
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
      const totalDur = getEffectiveDuration();
      persistProgress(streamOffsetRef.current + video.currentTime, totalDur);
    }
  }, [commitSeek, showOsd, showControlsTemporarily, getEffectiveDuration, persistProgress]);

  const restartVideo = useCallback(() => {
    commitSeek(0);
    showOsd('replay', 'Reiniciado do início');
  }, [commitSeek, showOsd]);

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

  // Botões de controle rápido na barra inferior
  const playerButtons = [
    {
      id: 'play_pause',
      icon: isPlaying ? 'pause' : 'play_arrow',
      label: isPlaying ? 'Pausar' : 'Reproduzir',
      primary: true,
      action: togglePlay
    },
    {
      id: 'back_60',
      icon: 'fast_rewind',
      label: '-1 min',
      action: () => seekRelative(-60)
    },
    {
      id: 'back_10',
      icon: 'replay_10',
      label: '-10s',
      action: () => seekRelative(-10)
    },
    {
      id: 'fwd_10',
      icon: 'forward_10',
      label: '+10s',
      action: () => seekRelative(10)
    },
    {
      id: 'fwd_60',
      icon: 'fast_forward',
      label: '+1 min',
      action: () => seekRelative(60)
    },
    {
      id: 'fwd_300',
      icon: 'skip_next',
      label: '+5 min',
      action: () => seekRelative(300)
    },
    {
      id: 'restart',
      icon: 'replay',
      label: 'Do Início',
      action: restartVideo
    }
  ];

  // Listener de controle remoto direto e prioritário durante a reprodução
  useEffect(() => {
    const handlePlayerKeyDown = (e) => {
      const code = e.keyCode || e.which || 0;
      const key = e.key || '';

      const isEnter = code === 13 || key === 'Enter';
      const isMediaPlayPause = code === 10252 || code === 415 || code === 19 || code === 32 || key === 'MediaPlayPause' || key === ' ';
      const isLeft = code === 37 || key === 'ArrowLeft';
      const isRight = code === 39 || key === 'ArrowRight';
      const isRewindKey = code === 412 || key === 'MediaRewind';
      const isFastForwardKey = code === 417 || key === 'MediaFastForward';
      const isUp = code === 38 || key === 'ArrowUp';
      const isDown = code === 40 || key === 'ArrowDown';
      const isBack = code === 10009 || code === 27 || code === 8 || key === 'Back' || key === 'Escape';

      // 1. Teclas dedicadas de mídia no controle da TV
      if (isMediaPlayPause) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        return;
      }
      if (isRewindKey) {
        e.preventDefault();
        e.stopPropagation();
        scheduleScrub(-1);
        return;
      }
      if (isFastForwardKey) {
        e.preventDefault();
        e.stopPropagation();
        scheduleScrub(1);
        return;
      }

      // 2. Botão OK / Enter
      if (isEnter) {
        e.preventDefault();
        e.stopPropagation();
        if (scrubTargetRef.current !== null) {
          commitSeek(scrubTargetRef.current);
          return;
        }
        if (!controlsVisible) {
          showControlsTemporarily();
          togglePlay();
          return;
        }
        if (focusZone === 'top') {
          onClose?.();
          return;
        }
        if (focusZone === 'buttons') {
          const btn = playerButtons[focusedBtnIndex];
          if (btn) btn.action();
          showControlsTemporarily();
          return;
        }
        togglePlay();
        return;
      }

      // 3. Seta Esquerda
      if (isLeft) {
        e.preventDefault();
        e.stopPropagation();
        showControlsTemporarily();
        if (controlsVisible && focusZone === 'buttons') {
          setFocusedBtnIndex(prev => Math.max(0, prev - 1));
          return;
        }
        setFocusZone('timeline');
        scheduleScrub(-1);
        return;
      }

      // 4. Seta Direita
      if (isRight) {
        e.preventDefault();
        e.stopPropagation();
        showControlsTemporarily();
        if (controlsVisible && focusZone === 'buttons') {
          setFocusedBtnIndex(prev => Math.min(playerButtons.length - 1, prev + 1));
          return;
        }
        setFocusZone('timeline');
        scheduleScrub(1);
        return;
      }

      // 5. Seta Baixo (navega apenas entre os controles do player: Topo -> Barra de Tempo -> Botões de Ação)
      if (isDown) {
        e.preventDefault();
        e.stopPropagation();
        showControlsTemporarily();
        if (focusZone === 'top') {
          setFocusZone('timeline');
        } else if (focusZone === 'timeline') {
          setFocusZone('buttons');
        }
        return;
      }

      // 6. Seta Cima (navega apenas entre os controles do player: Botões de Ação -> Barra de Tempo -> Botão Voltar)
      if (isUp) {
        e.preventDefault();
        e.stopPropagation();
        showControlsTemporarily();
        if (focusZone === 'buttons') {
          setFocusZone('timeline');
        } else if (focusZone === 'timeline') {
          setFocusZone('top');
        }
        return;
      }

      // 7. Botão Voltar (Tizen 10009, Esc, Backspace)
      if (isBack) {
        e.preventDefault();
        e.stopPropagation();
        if (scrubTargetRef.current !== null) {
          clearTimeout(scrubCommitTimerRef.current);
          scrubTargetRef.current = null;
          setScrubTime(null);
          return;
        }
        if (onClose) onClose();
        return;
      }
    };

    window.addEventListener('keydown', handlePlayerKeyDown, true);
    return () => window.removeEventListener('keydown', handlePlayerKeyDown, true);
  }, [
    controlsVisible,
    focusZone,
    focusedBtnIndex,
    playerButtons,
    togglePlay,
    scheduleScrub,
    commitSeek,
    adjustVolume,
    showControlsTemporarily,
    onClose
  ]);

  // Carregamento do vídeo e tratamento de eventos nativos
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setIsBuffering(true);
    hasResumedRef.current = false;
    lastSavedPosRef.current = 0;
    streamOffsetRef.current = 0;
    scrubTargetRef.current = null;
    setScrubTime(null);

    if (!fullStreamUrl) {
      setHasError(true);
      setErrorMessage('Não foi possível localizar o endereço de reprodução.');
      setIsBuffering(false);
      return;
    }

    // Sempre consulta X-Media-Duration via HEAD para ter a duração total exata do filme (mesmo em remux MKV)
    fetch(fullStreamUrl, { method: 'HEAD' }).then(r => {
      const hdrDur = parseFloat(r.headers.get('X-Media-Duration') || '0');
      if (hdrDur > 0) {
        serverDurationRef.current = hdrDur;
        durationRef.current = Math.max(durationRef.current || 0, hdrDur);
        setDuration(durationRef.current);
      }
    }).catch(() => {});

    // Se houver posicao de retomada em arquivo local / stream remuxado, ja inicia direto na posicao com startTime
    const initialOffset = (resumePosition > 10 && (!durationRef.current || resumePosition < durationRef.current - 15))
      ? Math.floor(resumePosition)
      : 0;

    if (initialOffset > 0 && isLocal) {
      streamOffsetRef.current = initialOffset;
      hasResumedRef.current = true;
      const sep = fullStreamUrl.includes('?') ? '&' : '?';
      video.src = `${fullStreamUrl}${sep}startTime=${initialOffset}`;
      setCurrentTime(initialOffset);
    } else {
      video.src = fullStreamUrl;
    }
    video.load();

    const clearBufferOverlay = () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
        bufferTimeoutRef.current = null;
      }
      setIsBuffering(false);
    };

    const applyResumeIfPending = () => {
      const dur = getEffectiveDuration();
      if (!hasResumedRef.current && resumePosition > 10 && dur && resumePosition < (dur - 15)) {
        hasResumedRef.current = true;
        try {
          if (video.duration && isFinite(video.duration) && streamOffsetRef.current === 0) {
            if (Math.abs(video.currentTime - resumePosition) > 3) {
              video.currentTime = resumePosition;
            }
          }
          showOsd('history', `Retomando de ${formatSeconds(resumePosition)}`);
        } catch (_) {}
      }
    };

    const handleLoadedMetadata = () => {
      const dur = getEffectiveDuration();
      if (dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
      }

      // Detecção de hardware da resolução decodificada real
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vh > 0) {
        let detected = '';
        if (vh >= 2160 || vw >= 3840) detected = '4K UHD';
        else if (vh >= 1080 || vw >= 1920) detected = '1080p Full HD';
        else if (vh >= 720 || vw >= 1280) detected = '720p HD';
        else if (vh >= 480 || vw >= 640) detected = '480p SD';
        if (detected) {
          setEffectiveQuality(detected);
        }
      }

      if (!hasResumedRef.current && resumePosition > 10 && dur && resumePosition < (dur - 15) && streamOffsetRef.current === 0) {
        try {
          if (canSeekNativelyTo(resumePosition)) {
            video.currentTime = resumePosition;
            hasResumedRef.current = true;
          }
        } catch (_) {}
      }
      video.play().then(() => {
        setIsPlaying(true);
        clearBufferOverlay();
        showControlsTemporarily();
        if (streamOffsetRef.current > 0) {
          showOsd('history', `Reproduzindo de ${formatSeconds(streamOffsetRef.current)}`);
        }
      }).catch(() => {
        clearBufferOverlay();
      });
    };

    const handleTimeUpdate = () => {
      const rawTime = video.currentTime || 0;
      const effectivePos = streamOffsetRef.current + rawTime;
      if (scrubTargetRef.current === null) {
        setCurrentTime(effectivePos);
      }

      // Sempre que o tempo estiver avancando, remove imediatamente o overlay de buffer
      if (rawTime > 0 && !video.paused) {
        clearBufferOverlay();
        setIsPlaying(true);
      }

      const dur = getEffectiveDuration();
      if (dur && dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
        if (video.buffered.length > 0) {
          const bufEnd = streamOffsetRef.current + video.buffered.end(video.buffered.length - 1);
          setBufferedPercent(Math.min(100, (bufEnd / dur) * 100));
        }
        // Salva periodicamente o progresso a cada 10 segundos
        if (Math.abs(effectivePos - lastSavedPosRef.current) >= 10) {
          lastSavedPosRef.current = effectivePos;
          persistProgress(effectivePos, dur);
        }
      }
    };

    const handleWaiting = () => {
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      const snapshotTime = video.currentTime;
      bufferTimeoutRef.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && Math.abs(videoRef.current.currentTime - snapshotTime) < 0.05) {
          setIsBuffering(true);
        }
      }, 750);
    };

    const handleCanPlay = () => {
      clearBufferOverlay();
      applyResumeIfPending();
    };

    const handlePlaying = () => {
      clearBufferOverlay();
      setIsPlaying(true);
      applyResumeIfPending();
    };

    const handleError = (e) => {
      console.warn('[Player] Erro no video HTML5:', e);
      clearBufferOverlay();
      setHasError(true);
      const isCloud = fullStreamUrl.includes('drive.google.com') || fullStreamUrl.includes('drive.usercontent.google.com');
      if (isCloud) {
        setErrorMessage('Não foi possível reproduzir este vídeo da Nuvem. Verifique o compartilhamento da pasta no Google Drive ou se o vídeo está em formato MP4 compatível.');
      } else {
        setErrorMessage('Não foi possível reproduzir este fluxo. O formato pode requerer transcodificação ou o arquivo foi movido.');
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
        bufferTimeoutRef.current = null;
      }
      if (scrubCommitTimerRef.current) {
        clearTimeout(scrubCommitTimerRef.current);
        scrubCommitTimerRef.current = null;
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);

      // Limpeza profunda de decodificadores e salvamento final ao fechar o player
      try {
        const finalDur = getEffectiveDuration();
        const finalPos = streamOffsetRef.current + (video.currentTime || 0);
        if (finalDur && finalPos > 5) {
          persistProgress(finalPos, finalDur);
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
  }, [fullStreamUrl]);

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

  const displayTime = scrubTime !== null ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const remainingTime = duration > displayTime ? duration - displayTime : 0;
  const isTimelineFocused = controlsVisible && focusZone === 'timeline';

  return (
    <div className="tv-player-wrap" onClick={showControlsTemporarily}>
      <video
        ref={videoRef}
        className="tv-player-video"
        playsInline
        preload="auto"
      />

      {/* OSD Feedback Central (Pausado, +10s, Scrubbing, Volume) */}
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

      {/* Overlay de Buffer */}
      {isBuffering && !hasError && (
        <div className="tv-buffer-overlay">
          <div className="tv-spinner" />
          <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '8px' }}>
            {isLocal ? 'Carregando arquivo local...' : 'Preparando reprodução...'}
          </h3>
          {streamStats && (
            <div className="tv-buffer-stats-box">
              <div className="tv-buffer-stats-item">
                <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)' }}>speed</span>
                <span>{streamStats.downloadSpeed || '0 KB/s'}</span>
              </div>
              <div className="tv-buffer-stats-item">
                <span className="material-icons" style={{ fontSize: '18px', color: '#22c55e' }}>data_usage</span>
                <span>Buffer: {streamStats.progress || 0}%</span>
              </div>
            </div>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-subtle)', marginTop: '6px' }}>
            Dica: Use as setas Esquerda/Direita para avançar ou voltar para qualquer parte do filme.
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
              className={`tv-player-icon-btn ${focusZone === 'top' ? 'focused' : ''}`}
              style={focusZone === 'top' ? { background: '#FFFFFF', color: '#000000', transform: 'scale(1.08)' } : undefined}
              onClick={onClose}
              title="Voltar"
            >
              <span className="material-icons" style={{ fontSize: '26px' }}>arrow_back</span>
            </button>

            <div>
              <h2 className="tv-player-movie-title">{title}</h2>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <span
                  className={`tv-badge-pill ${effectiveQuality.includes('4K') ? 'q-4k' : effectiveQuality.toLowerCase().includes('cam') ? 'q-cam' : ''}`}
                  style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)' }}
                >
                  {effectiveQuality}
                </span>
                {isLocal ? (
                  <span className="tv-badge-pill" style={{ fontSize: '11px', background: '#22c55e', color: '#000' }}>
                    Arquivo Local
                  </span>
                ) : (
                  <span className="tv-badge-pill" style={{ fontSize: '11px', background: 'rgba(229, 9, 20, 0.25)', color: 'var(--primary)' }}>
                    Transmissão Online
                  </span>
                )}
              </div>
            </div>
          </div>

          {streamStats && (
            <div className="tv-player-telemetry-badge">
              <span style={{ color: '#22c55e' }}>{streamStats.downloadSpeed}</span>
              <span>•</span>
              <span>Buffer {streamStats.progress}%</span>
            </div>
          )}
        </div>

        {/* Barra Inferior com Linha do Tempo Interativa Estilo Netflix */}
        <div className="tv-player-bottom">
          <div className="tv-timeline-box">
            <div
              className={`tv-timeline-track ${isTimelineFocused ? 'focused' : ''}`}
              style={{
                height: isTimelineFocused ? '12px' : '8px',
                cursor: 'pointer',
                border: isTimelineFocused ? '2px solid #FFFFFF' : 'none',
                transition: 'height 0.12s ease'
              }}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const dur = getEffectiveDuration();
                if (dur > 0) {
                  commitSeek(pos * dur);
                }
              }}
            >
              <div
                className="tv-timeline-buffer"
                style={{ width: `${bufferedPercent}%` }}
              />
              <div
                className="tv-timeline-progress"
                style={{ width: `${progressPercent}%` }}
              >
                <div
                  className="tv-timeline-thumb"
                  style={isTimelineFocused || scrubTime !== null ? {
                    transform: 'translateY(-50%) scale(1.45)',
                    background: '#FFFFFF',
                    border: '3px solid var(--primary)'
                  } : undefined}
                />
              </div>
            </div>

            <div className="tv-time-row">
              <span style={{ color: scrubTime !== null ? '#F5C518' : '#FFFFFF', fontWeight: 800, fontSize: '15px' }}>
                {formatSeconds(displayTime)}
                {scrubTime !== null && ' (Solte ou aperte OK para ir)'}
              </span>
              <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>
                {duration > 0 ? `-${formatSeconds(remainingTime)}  /  ${formatSeconds(duration)}` : '00:00'}
              </span>
            </div>
          </div>

          <div className="tv-player-btns-row">
            {playerButtons.map((btn, idx) => {
              const isBtnFocused = focusZone === 'buttons' && focusedBtnIndex === idx;
              return (
                <button
                  key={btn.id}
                  type="button"
                  className={`tv-btn ${btn.primary ? 'tv-btn-primary' : 'tv-btn-secondary'} ${isBtnFocused ? 'focused' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusZone('buttons');
                    setFocusedBtnIndex(idx);
                    btn.action();
                  }}
                >
                  <span className="material-icons" style={{ fontSize: btn.primary ? '24px' : '20px' }}>
                    {btn.icon}
                  </span>
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
export default CinemaPlayer;
