import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getMovieDetails,
  getSeriesMeta,
  getEpisodeStreams,
  getSeasonTorrents,
  downloadSeason,
  downloadAllSeries,
  isFavorite,
  toggleFavorite,
  startDownload,
  getSavedProgress,
  clearWatchProgress,
  formatTime
} from '../services/api';

export function MovieDetailsModal({
  movie,
  isZoneFocused,
  focusedIndex,
  onClose,
  onPlayStream,
  modalActionRef,
  onToggleFavorite
}) {
  const [details, setDetails] = useState(movie);
  const [loading, setLoading] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Estados específicos para Séries
  const [seriesMeta, setSeriesMeta] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [episodeStreams, setEpisodeStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);

  // Estados para escolha de versão de download e ação de stream
  const [downloadPickerOpen, setDownloadPickerOpen] = useState(false);
  const [downloadPickerIndex, setDownloadPickerIndex] = useState(0);
  const [streamActionTarget, setStreamActionTarget] = useState(null);
  const [streamActionIndex, setStreamActionIndex] = useState(0);

  // Estados para Download de Temporada Completa ou Todos os Episódios da Série
  const [seriesDownloadModalOpen, setSeriesDownloadModalOpen] = useState(false);
  const [seriesDownloadStep, setSeriesDownloadStep] = useState('options'); // 'options' | 'packs'
  const [seriesDownloadModalIndex, setSeriesDownloadModalIndex] = useState(0);
  const [seasonPacks, setSeasonPacks] = useState([]);
  const [loadingSeasonPacks, setLoadingSeasonPacks] = useState(false);

  const isSeries = Boolean(details?.isSeries || details?.type === 'series' || movie?.isSeries || movie?.type === 'series');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (!movie) return;
    const target = details || movie;
    setFavorite(isFavorite(target.id || target.movieId || movie.id, target.imdbId || movie.imdbId, target.title || movie.title));

    let isMounted = true;
    setLoading(true);

    if (isSeries) {
      // Carrega metadados da série (temporadas e episódios)
      getSeriesMeta(movie.imdbId || movie.id)
        .then(meta => {
          if (isMounted && meta) {
            setSeriesMeta(meta);
            const videos = meta.videos || [];
            const validSeasons = Array.from(new Set(videos.map(v => v.season).filter(s => s > 0))).sort((a, b) => a - b);
            const initialSeason = validSeasons.length > 0 ? validSeasons[0] : 1;
            setSelectedSeason(initialSeason);

            const firstEp = videos.find(v => v.season === initialSeason);
            if (firstEp) {
              setSelectedEpisode(firstEp);
              loadStreamsForEpisode(movie.imdbId || movie.id, firstEp.season, firstEp.episode || firstEp.number, movie.title);
            }
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      // Carrega detalhes do filme e streams
      getMovieDetails(movie)
        .then(res => {
          if (isMounted && res) {
            setDetails(prev => ({ ...prev, ...res }));
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => { isMounted = false; };
  }, [movie, isSeries]);

  const loadStreamsForEpisode = async (imdbId, season, episode, title) => {
    setLoadingStreams(true);
    try {
      const streams = await getEpisodeStreams({ imdbId, season, episode, title });
      setEpisodeStreams(streams);
    } catch (_) {
      setEpisodeStreams([]);
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleSelectSeason = (sNum) => {
    setSelectedSeason(sNum);
    const videos = seriesMeta?.videos || [];
    const firstEp = videos.find(v => v.season === sNum);
    if (firstEp) {
      setSelectedEpisode(firstEp);
      loadStreamsForEpisode(movie.imdbId || movie.id, firstEp.season, firstEp.episode || firstEp.number, movie.title);
    }
  };

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    loadStreamsForEpisode(movie.imdbId || movie.id, ep.season, ep.episode || ep.number, movie.title);
  };

  const title = details?.title || movie?.title || 'Sem título';
  const poster = details?.poster || movie?.poster || '';
  const backdrop = details?.backdrop || movie?.backdrop || poster;
  const synopsis = details?.synopsis || details?.description || movie?.synopsis || 'Sem sinopse disponível.';
  const streams = details?.streams || [];
  const isLocal = Boolean(details?.isLocal || details?.filePath || details?.videoPath);

  // Progresso salvo previamente no histórico
  const savedProgress = useMemo(() => {
    return getSavedProgress(details || movie);
  }, [details, movie]);

  const hasResume = Boolean(savedProgress && savedProgress.position > 10 && (!savedProgress.duration || (savedProgress.position / savedProgress.duration) < 0.92));
  const resumePos = hasResume ? savedProgress.position : (details?.position || movie?.position || 0);
  const streamBaseIndex = hasResume ? (isSeries ? 6 : 5) : (isSeries ? 4 : 3);

  // Ação 1: Assistir (com retomada ou do início)
  const handlePlay = useCallback((customPos) => {
    const posToResume = customPos !== undefined ? customPos : resumePos;
    if (isSeries) {
      if (episodeStreams.length > 0) {
        const best = episodeStreams[0];
        const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
        onPlayStream({
          id: `${details.imdbId || details.id || movie.id}-s${selectedSeason}e${epNum}`,
          movieId: details.id || movie.id,
          imdbId: details.imdbId || movie.imdbId,
          streamUrl: best.streamUrl,
          title: `${title} - T${selectedSeason}E${epNum}: ${selectedEpisode?.name || 'Episódio'}`,
          poster: selectedEpisode?.thumbnail || poster,
          infoHash: best.infoHash,
          quality: best.quality,
          isLocal: false,
          isSeries: true,
          season: selectedSeason,
          episode: epNum,
          episodeName: selectedEpisode?.name || '',
          resumePosition: posToResume
        });
      } else {
        showToast('Buscando fontes para reproduzir o episódio selecionado...');
      }
      return;
    }

    if (isLocal) {
      const filePath = details.filePath || details.videoPath || movie.filePath || movie.videoPath || '';
      let sUrl = details.streamUrl || movie.streamUrl || `/api/local/stream?file=${encodeURIComponent(filePath)}`;
      if (!sUrl.includes('direct=')) {
        sUrl += (sUrl.includes('?') ? '&' : '?') + 'direct=1';
      }
      onPlayStream({
        id: details.id || movie.id || filePath,
        movieId: details.id || movie.id || filePath,
        imdbId: details.imdbId || movie.imdbId,
        streamUrl: sUrl,
        title,
        poster,
        quality: details.quality || movie.quality || '1080p Full HD',
        isLocal: true,
        filePath,
        resumePosition: posToResume
      });
      return;
    }

    if (streams.length > 0) {
      const best = streams[0];
      onPlayStream({
        id: details.id || movie.id,
        movieId: details.id || movie.id,
        imdbId: details.imdbId || movie.imdbId,
        streamUrl: best.streamUrl || `/api/stream/${best.infoHash}?magnet=${encodeURIComponent(best.magnet)}`,
        title,
        poster,
        infoHash: best.infoHash,
        quality: best.quality || '1080p Full HD',
        isLocal: false,
        resumePosition: posToResume
      });
    } else {
      showToast('Aguardando fontes para reproduzir o filme...');
    }
  }, [isSeries, isLocal, episodeStreams, streams, details, movie, selectedEpisode, selectedSeason, title, poster, resumePos, onPlayStream]);

  // Ação de seleção direta de stream
  const handleStreamSelect = useCallback((streamIdx) => {
    if (isSeries) {
      if (episodeStreams[streamIdx]) {
        const s = episodeStreams[streamIdx];
        const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
        onPlayStream({
          id: `${details.imdbId || details.id || movie.id}-s${selectedSeason}e${epNum}`,
          movieId: details.id || movie.id,
          imdbId: details.imdbId || movie.imdbId,
          streamUrl: s.streamUrl,
          title: `${title} - T${selectedSeason}E${epNum}: ${selectedEpisode?.name || 'Episódio'}`,
          poster: selectedEpisode?.thumbnail || poster,
          infoHash: s.infoHash,
          quality: s.quality || '1080p Full HD',
          isLocal: false,
          isSeries: true,
          season: selectedSeason,
          episode: epNum,
          episodeName: selectedEpisode?.name || '',
          resumePosition: resumePos
        });
      }
    } else {
      if (streams[streamIdx]) {
        const s = streams[streamIdx];
        onPlayStream({
          id: details.id || movie.id,
          movieId: details.id || movie.id,
          imdbId: details.imdbId || movie.imdbId,
          streamUrl: s.streamUrl || `/api/stream/${s.infoHash}?magnet=${encodeURIComponent(s.magnet)}`,
          title: `${title} - ${s.quality || '1080p Full HD'}`,
          poster,
          infoHash: s.infoHash,
          quality: s.quality || '1080p Full HD',
          isLocal: false,
          resumePosition: resumePos
        });
      }
    }
  }, [isSeries, episodeStreams, selectedEpisode, selectedSeason, details, movie, title, poster, streams, resumePos, onPlayStream]);

  // Fontes disponíveis no momento (para série ou filme)
  const currentAvailableStreams = useMemo(() => {
    return isSeries ? episodeStreams : streams;
  }, [isSeries, episodeStreams, streams]);

  // Executa o download da versão específica selecionada
  const executeDownloadStream = useCallback(async (streamToDownload) => {
    if (!streamToDownload || !streamToDownload.magnet) {
      showToast('Opção inválida para download.');
      return;
    }
    setDownloading(true);
    try {
      if (isSeries) {
        const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
        const cleanTitle = `${title} - S${String(selectedSeason).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
        const res = await startDownload({
          magnet: streamToDownload.magnet,
          title: details.title || title,
          filename: cleanTitle,
          poster: selectedEpisode?.thumbnail || poster,
          backdrop: details.backdrop || movie.backdrop || poster,
          overview: details.overview || movie.overview || '',
          year: details.year || movie.year || '',
          imdbId: details.imdbId || movie.imdbId,
          isSeries: true,
          seriesName: details.title || title,
          season: selectedSeason,
          episode: epNum,
          quality: streamToDownload.quality || '1080p'
        });
        if (res && (res.id || res.message || res.success !== false)) {
          setDownloadSuccess(true);
          showToast(`Download de "${cleanTitle}" (${streamToDownload.quality || '1080p'}) iniciado em D:\\Filmes!`);
        } else {
          showToast('Erro ao iniciar download no PC.');
        }
      } else {
        const res = await startDownload({
          magnet: streamToDownload.magnet,
          title,
          poster,
          backdrop: details.backdrop || movie.backdrop || poster,
          overview: details.overview || movie.overview || '',
          year: details.year || movie.year || (movie.releaseDate ? movie.releaseDate.substring(0, 4) : ''),
          imdbId: details.imdbId || movie.imdbId || details.id,
          quality: streamToDownload.quality || '1080p'
        });
        if (res && (res.id || res.message || res.success !== false)) {
          setDownloadSuccess(true);
          showToast(`Download de "${title}" (${streamToDownload.quality || '1080p'}) iniciado em D:\\Filmes!`);
        } else {
          showToast('Erro ao iniciar download no PC.');
        }
      }
    } catch (err) {
      showToast(`Erro ao iniciar download: ${err.message}`);
    } finally {
      setDownloading(false);
      setDownloadPickerOpen(false);
      setStreamActionTarget(null);
    }
  }, [isSeries, selectedEpisode, selectedSeason, title, details, poster, movie]);

  // Ação 2: Download para o PC (com escolha de versão)
  const handleDownload = useCallback(() => {
    if (isLocal) {
      showToast('Este arquivo já está salvo no seu computador em D:\\Filmes.');
      return;
    }

    if (downloading) {
      showToast('Download em andamento no PC...');
      return;
    }

    const avail = isSeries ? episodeStreams : streams;
    if (avail.length === 0) {
      showToast(isSeries ? 'Buscando opções do episódio para download...' : 'Buscando opções de qualidade para download...');
      return;
    }

    if (avail.length === 1) {
      executeDownloadStream(avail[0]);
      return;
    }

    setDownloadPickerIndex(0);
    setDownloadPickerOpen(true);
  }, [isLocal, downloading, isSeries, episodeStreams, streams, executeDownloadStream]);

  // Ação 3: Favoritos
  const handleToggleFav = useCallback(() => {
    const target = details || movie;
    const next = toggleFavorite(target);
    setFavorite(next);
    showToast(next ? 'Adicionado à sua lista de Favoritos!' : 'Removido dos seus Favoritos.');
    onToggleFavorite?.(next, target);
  }, [details, movie, onToggleFavorite]);

  // Ação 4: Remover de Continuar Assistindo
  const handleRemoveHistory = useCallback(() => {
    const idToClear = details?.id || movie?.id || details?.filePath || movie?.filePath || title;
    if (idToClear) {
      clearWatchProgress(idToClear);
      showToast('Removido de Continuar Assistindo.');
      onClose?.();
    }
  }, [details, movie, title, onClose]);

  // Abre o diálogo para baixar temporada ou toda a série
  const handleOpenSeriesDownloadDialog = useCallback(async (startAtPacks = false) => {
    if (isLocal) {
      showToast('Esta série já está salva no computador em D:\\Filmes\\Series.');
      return;
    }
    setSeriesDownloadModalOpen(true);
    setSeriesDownloadModalIndex(0);

    if (startAtPacks) {
      setSeriesDownloadStep('packs');
      setLoadingSeasonPacks(true);
      try {
        const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
        const packs = await getSeasonTorrents({ imdbId: imdb, season: selectedSeason, title });
        setSeasonPacks(packs);
      } catch (_) {
        setSeasonPacks([]);
      } finally {
        setLoadingSeasonPacks(false);
      }
    } else {
      setSeriesDownloadStep('options');
    }
  }, [isLocal, details, movie, selectedSeason, title]);

  const handleSelectSeasonPacksStep = useCallback(async () => {
    setSeriesDownloadStep('packs');
    setSeriesDownloadModalIndex(0);
    setLoadingSeasonPacks(true);
    try {
      const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
      const packs = await getSeasonTorrents({ imdbId: imdb, season: selectedSeason, title });
      setSeasonPacks(packs);
    } catch (_) {
      setSeasonPacks([]);
    } finally {
      setLoadingSeasonPacks(false);
    }
  }, [details, movie, selectedSeason, title]);

  const handleExecuteSeasonPackDownload = useCallback(async (pack) => {
    if (!pack || !pack.magnet) {
      showToast('Opção de download inválida.');
      return;
    }
    setDownloading(true);
    try {
      const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
      const res = await downloadSeason({
        imdbId: imdb,
        seriesName: details?.title || title,
        season: selectedSeason,
        magnet: pack.magnet,
        quality: pack.quality || '1080p'
      });
      if (res && res.success !== false) {
        setDownloadSuccess(true);
        showToast(`Download da Temporada ${selectedSeason} de "${title}" (${pack.quality || '1080p'}) iniciado em D:\\Filmes\\Series!`);
      } else {
        showToast(res?.error || 'Erro ao iniciar download da temporada.');
      }
    } catch (err) {
      showToast(`Erro ao baixar temporada: ${err.message}`);
    } finally {
      setDownloading(false);
      setSeriesDownloadModalOpen(false);
    }
  }, [details, movie, selectedSeason, title]);

  const handleExecuteDownloadAllSeasons = useCallback(async () => {
    setDownloading(true);
    try {
      const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
      const seasonsList = Array.from(new Set(seriesMeta?.videos?.map(v => v.season).filter(s => s > 0) || [])).sort((a, b) => a - b);
      const res = await downloadAllSeries({
        imdbId: imdb,
        seriesName: details?.title || title,
        seasons: seasonsList.length > 0 ? seasonsList : [selectedSeason]
      });
      if (res && res.success !== false) {
        setDownloadSuccess(true);
        showToast(`Download de todas as temporadas de "${title}" iniciado em D:\\Filmes\\Series!`);
      } else {
        showToast(res?.error || 'Erro ao iniciar download da série completa.');
      }
    } catch (err) {
      showToast(`Erro ao baixar série: ${err.message}`);
    } finally {
      setDownloading(false);
      setSeriesDownloadModalOpen(false);
    }
  }, [details, movie, title, seriesMeta, selectedSeason]);

  // Vincula controlador de ações e sub-diálogos com prioridade total para o controle remoto da TV
  useEffect(() => {
    if (modalActionRef) {
      modalActionRef.current = {
        isSubDialogOpen: () => Boolean(downloadPickerOpen || streamActionTarget || seriesDownloadModalOpen),
        handleBack: () => {
          if (seriesDownloadModalOpen) {
            if (seriesDownloadStep === 'packs') {
              setSeriesDownloadStep('options');
              setSeriesDownloadModalIndex(0);
              return true;
            }
            setSeriesDownloadModalOpen(false);
            return true;
          }
          if (downloadPickerOpen) {
            setDownloadPickerOpen(false);
            return true;
          }
          if (streamActionTarget) {
            setStreamActionTarget(null);
            return true;
          }
          return false;
        },
        handleSubNav: (delta) => {
          if (seriesDownloadModalOpen) {
            if (seriesDownloadStep === 'options') {
              setSeriesDownloadModalIndex(prev => delta > 0 ? Math.min(2, prev + 1) : Math.max(0, prev - 1));
            } else if (seriesDownloadStep === 'packs') {
              const maxIdx = seasonPacks.length;
              setSeriesDownloadModalIndex(prev => delta > 0 ? Math.min(maxIdx, prev + 1) : Math.max(0, prev - 1));
            }
          } else if (downloadPickerOpen) {
            setDownloadPickerIndex(prev => delta > 0 ? Math.min(currentAvailableStreams.length - 1, prev + 1) : Math.max(0, prev - 1));
          } else if (streamActionTarget) {
            setStreamActionIndex(prev => delta > 0 ? Math.min(2, prev + 1) : Math.max(0, prev - 1));
          }
        },
        handleSubEnter: () => {
          if (seriesDownloadModalOpen) {
            if (seriesDownloadStep === 'options') {
              if (seriesDownloadModalIndex === 0) {
                handleSelectSeasonPacksStep();
              } else if (seriesDownloadModalIndex === 1) {
                handleExecuteDownloadAllSeasons();
              } else {
                setSeriesDownloadModalOpen(false);
              }
            } else if (seriesDownloadStep === 'packs') {
              if (seriesDownloadModalIndex < seasonPacks.length) {
                const pack = seasonPacks[seriesDownloadModalIndex];
                if (pack) handleExecuteSeasonPackDownload(pack);
              } else {
                setSeriesDownloadStep('options');
                setSeriesDownloadModalIndex(0);
              }
            }
          } else if (downloadPickerOpen) {
            const selected = currentAvailableStreams[downloadPickerIndex];
            if (selected) executeDownloadStream(selected);
          } else if (streamActionTarget) {
            if (streamActionIndex === 0) {
              const st = streamActionTarget;
              setStreamActionTarget(null);
              if (isSeries) {
                const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
                onPlayStream({
                  id: `${details.imdbId || details.id || movie.id}-s${selectedSeason}e${epNum}`,
                  movieId: details.id || movie.id,
                  imdbId: details.imdbId || movie.imdbId,
                  streamUrl: st.streamUrl,
                  title: `${title} - T${selectedSeason}E${epNum}: ${selectedEpisode?.name || 'Episódio'}`,
                  poster: selectedEpisode?.thumbnail || poster,
                  infoHash: st.infoHash,
                  quality: st.quality,
                  isLocal: false,
                  isSeries: true,
                  season: selectedSeason,
                  episode: epNum,
                  episodeName: selectedEpisode?.name || '',
                  resumePosition: resumePos
                });
              } else {
                onPlayStream({
                  id: details.id || movie.id,
                  movieId: details.id || movie.id,
                  imdbId: details.imdbId || movie.imdbId,
                  streamUrl: st.streamUrl || `/api/stream/${st.infoHash}?magnet=${encodeURIComponent(st.magnet)}`,
                  title: `${title} - ${st.quality || '1080p'}`,
                  poster,
                  infoHash: st.infoHash,
                  quality: st.quality,
                  isLocal: false,
                  resumePosition: resumePos
                });
              }
            } else if (streamActionIndex === 1) {
              const st = streamActionTarget;
              setStreamActionTarget(null);
              executeDownloadStream(st);
            } else {
              setStreamActionTarget(null);
            }
          }
        },
        triggerAction: (idx, isPlayKey) => {
          if (downloadPickerOpen || streamActionTarget || seriesDownloadModalOpen) return;

          if (hasResume) {
            if (idx === 0) {
              handlePlay(resumePos);
            } else if (idx === 1) {
              handlePlay(0);
            } else if (idx === 2) {
              handleDownload();
            } else if (isSeries && idx === 3) {
              handleOpenSeriesDownloadDialog(false);
            } else if (isSeries ? idx === 4 : idx === 3) {
              handleToggleFav();
            } else if (isSeries ? idx === 5 : idx === 4) {
              handleRemoveHistory();
            } else {
              const streamIdx = idx - (isSeries ? 6 : 5);
              const target = isSeries ? episodeStreams[streamIdx] : streams[streamIdx];
              if (isPlayKey) {
                handleStreamSelect(streamIdx);
              } else if (target) {
                setStreamActionTarget(target);
                setStreamActionIndex(0);
              }
            }
          } else {
            if (idx === 0) {
              handlePlay(0);
            } else if (idx === 1) {
              handleDownload();
            } else if (isSeries && idx === 2) {
              handleOpenSeriesDownloadDialog(false);
            } else if (isSeries ? idx === 3 : idx === 2) {
              handleToggleFav();
            } else {
              const streamIdx = idx - (isSeries ? 4 : 3);
              const target = isSeries ? episodeStreams[streamIdx] : streams[streamIdx];
              if (isPlayKey) {
                handleStreamSelect(streamIdx);
              } else if (target) {
                setStreamActionTarget(target);
                setStreamActionIndex(0);
              }
            }
          }
        }
      };
    }
  }, [
    modalActionRef,
    downloadPickerOpen,
    downloadPickerIndex,
    streamActionTarget,
    streamActionIndex,
    seriesDownloadModalOpen,
    seriesDownloadStep,
    seriesDownloadModalIndex,
    seasonPacks,
    currentAvailableStreams,
    executeDownloadStream,
    handleSelectSeasonPacksStep,
    handleExecuteSeasonPackDownload,
    handleExecuteDownloadAllSeasons,
    handleOpenSeriesDownloadDialog,
    isSeries,
    selectedEpisode,
    selectedSeason,
    details,
    movie,
    title,
    poster,
    resumePos,
    onPlayStream,
    handlePlay,
    handleDownload,
    handleToggleFav,
    handleRemoveHistory,
    handleStreamSelect,
    hasResume,
    episodeStreams,
    streams
  ]);

  if (!movie) return null;

  // Temporadas disponíveis
  const seasons = Array.from(new Set(seriesMeta?.videos?.map(v => v.season).filter(s => s > 0) || [])).sort((a, b) => a - b);

  // Episódios da temporada selecionada
  const currentEpisodes = (seriesMeta?.videos || [])
    .filter(v => v.season === selectedSeason)
    .sort((a, b) => (a.episode || a.number || 0) - (b.episode || b.number || 0));

  const isPlayFocused = isZoneFocused && focusedIndex === 0;
  const isRestartFocused = isZoneFocused && hasResume && focusedIndex === 1;
  const isDownloadEpFocused = isZoneFocused && (hasResume ? focusedIndex === 2 : focusedIndex === 1);
  const isDownloadAllFocused = isZoneFocused && isSeries && (hasResume ? focusedIndex === 3 : focusedIndex === 2);
  const isFavFocused = isZoneFocused && (
    hasResume
      ? (isSeries ? focusedIndex === 4 : focusedIndex === 3)
      : (isSeries ? focusedIndex === 3 : focusedIndex === 2)
  );
  const isRemoveHistoryFocused = isZoneFocused && hasResume && (
    isSeries ? focusedIndex === 5 : focusedIndex === 4
  );

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-modal-container" onClick={e => e.stopPropagation()}>
        {/* Banner Superior do Modal */}
        <div
          className="tv-modal-hero"
          style={{ backgroundImage: `url(${backdrop})` }}
        >
          <div className="tv-modal-hero-gradient" />

          <div className="tv-modal-hero-content">
            <img src={poster} alt={title} className="tv-modal-poster" />

            <div className="tv-modal-meta-box">
              <h1 className="tv-modal-title">{title}</h1>

              <div className="tv-modal-pills">
                {details.imdbRating && (
                  <span className="tv-badge-pill tv-badge-imdb">IMDb {details.imdbRating}</span>
                )}
                {details.year && (
                  <span className="tv-badge-pill">{details.year}</span>
                )}
                {isSeries && (
                  <span className="tv-badge-pill" style={{ background: '#3b82f6', color: '#FFFFFF' }}>Série de TV</span>
                )}
                {isLocal && (
                  <span className="tv-badge-pill" style={{ background: '#22c55e', color: '#000', fontWeight: 800 }}>Arquivo Local (D:\Filmes)</span>
                )}
              </div>

              {/* Barra de Progresso de Exibição Salva */}
              {hasResume && savedProgress && (
                <div style={{ margin: '10px 0 6px 0', maxWidth: '420px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#FAF9F5', marginBottom: '6px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons" style={{ fontSize: '15px', color: 'var(--primary)' }}>history</span>
                      <span>Continuar de {formatTime(resumePos)}</span>
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {savedProgress.duration ? `Restam ${Math.max(1, Math.round((savedProgress.duration - resumePos) / 60))} min` : `${savedProgress.progress}%`}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, savedProgress.progress || 0))}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              )}

              {/* Botões Principais de Ação */}
              <div className="tv-hero-actions">
                {/* 1. Botão Assistir ou Continuar */}
                <button
                  type="button"
                  className={`tv-btn tv-btn-primary ${isPlayFocused ? 'focused' : ''}`}
                  onClick={() => handlePlay(hasResume ? resumePos : 0)}
                >
                  <span className="material-icons">play_arrow</span>
                  <span>
                    {hasResume
                      ? `Continuar (${formatTime(resumePos)})`
                      : isLocal
                      ? 'Assistir do Disco Local'
                      : isSeries
                      ? `Assistir Episódio ${selectedEpisode?.episode || selectedEpisode?.number || 1}`
                      : loading
                      ? 'Buscando Fontes...'
                      : streams.length > 0
                      ? `Assistir Agora (${streams[0].quality || '1080p Full HD'})`
                      : 'Assistir'}
                  </span>
                </button>

                {/* 2. Botão Assistir do Início (quando houver progresso prévio) */}
                {hasResume && (
                  <button
                    type="button"
                    className={`tv-btn tv-btn-secondary ${isRestartFocused ? 'focused' : ''}`}
                    onClick={() => handlePlay(0)}
                  >
                    <span className="material-icons">replay</span>
                    <span>Do Início</span>
                  </button>
                )}

                {/* 3. Botão Baixar para o PC / Episódio */}
                <button
                  type="button"
                  className={`tv-btn tv-btn-download ${isDownloadEpFocused ? 'focused' : ''} ${isLocal ? 'already-local' : ''}`}
                  onClick={handleDownload}
                >
                  <span className="material-icons">
                    {isLocal
                      ? 'check_circle'
                      : downloadSuccess
                      ? 'cloud_done'
                      : downloading
                      ? 'sync'
                      : 'file_download'}
                  </span>
                  <span>
                    {isLocal
                      ? 'Salvo no PC (D:\\Filmes)'
                      : downloadSuccess
                      ? 'Download Iniciado!'
                      : downloading
                      ? 'Baixando para o PC...'
                      : isSeries
                      ? `Baixar Episódio ${selectedEpisode?.episode || selectedEpisode?.number || 1}`
                      : 'Baixar para o PC (D:\\Filmes)'}
                  </span>
                </button>

                {/* 4. Botão Baixar Todos os Episódios (Apenas para Séries) */}
                {isSeries && !isLocal && (
                  <button
                    type="button"
                    className={`tv-btn tv-btn-download-all ${isDownloadAllFocused ? 'focused' : ''}`}
                    onClick={() => handleOpenSeriesDownloadDialog(false)}
                  >
                    <span className="material-icons">cloud_download</span>
                    <span>Baixar Todos os Episódios</span>
                  </button>
                )}

                {/* 5. Botão Minha Lista (Favoritos) */}
                <button
                  type="button"
                  className={`tv-btn tv-btn-secondary ${isFavFocused ? 'focused' : ''}`}
                  onClick={handleToggleFav}
                >
                  <span className="material-icons">{favorite ? 'check' : 'add'}</span>
                  <span>{favorite ? 'Na Minha Lista' : 'Minha Lista'}</span>
                </button>

                {/* 6. Botão Remover do Histórico (quando aplicável) */}
                {hasResume && (
                  <button
                    type="button"
                    className={`tv-btn tv-btn-secondary ${isRemoveHistoryFocused ? 'focused' : ''}`}
                    onClick={handleRemoveHistory}
                    title="Remover de Continuar Assistindo"
                  >
                    <span className="material-icons">close</span>
                    <span>Remover</span>
                  </button>
                )}
              </div>

              {/* Notificação Toast dentro do Modal */}
              {toastMessage && (
                <div className="tv-modal-toast">
                  <span className="material-icons" style={{ fontSize: '18px', color: '#22c55e' }}>info</span>
                  <span>{toastMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Corpo do Modal: Sinopse, Temporadas e Lista de Torrents */}
        <div className="tv-modal-body">
          <p className="tv-modal-synopsis">{synopsis}</p>

          {/* Seção de Séries: Temporadas e Episódios */}
          {isSeries && (
            <div className="tv-series-episodes-section">
              <div className="tv-seasons-header-bar">
                <div className="tv-seasons-nav">
                  {seasons.map(sNum => (
                    <button
                      key={sNum}
                      type="button"
                      className={`tv-season-btn ${selectedSeason === sNum ? 'active' : ''}`}
                      onClick={() => handleSelectSeason(sNum)}
                    >
                      Temporada {sNum}
                    </button>
                  ))}
                </div>

                {!isLocal && (
                  <div className="tv-seasons-actions-right">
                    <button
                      type="button"
                      className="tv-btn tv-btn-season-action"
                      onClick={() => handleOpenSeriesDownloadDialog(true)}
                    >
                      <span className="material-icons">download</span>
                      <span>Baixar Temporada {selectedSeason} Completa</span>
                    </button>
                    <button
                      type="button"
                      className="tv-btn tv-btn-season-action"
                      onClick={() => handleOpenSeriesDownloadDialog(false)}
                    >
                      <span className="material-icons">library_add_check</span>
                      <span>Baixar Série Completa</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="tv-episodes-list">
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                  Episódios da Temporada {selectedSeason}:
                </h3>

                {currentEpisodes.map((ep, idx) => {
                  const isEpSelected = selectedEpisode?.id === ep.id || (selectedEpisode?.episode === (ep.episode || ep.number));
                  const epNum = ep.episode || ep.number || (idx + 1);
                  return (
                    <div
                      key={ep.id || idx}
                      className={`tv-episode-card ${isEpSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectEpisode(ep)}
                    >
                      {ep.thumbnail && (
                        <img src={ep.thumbnail} alt={ep.name} className="tv-episode-thumb" />
                      )}
                      <div className="tv-episode-info">
                        <div className="tv-episode-num-title">
                          Episódio {epNum}: {ep.name || 'Episódio'}
                        </div>
                        {ep.overview && (
                          <div className="tv-episode-desc">{ep.overview}</div>
                        )}
                      </div>
                      <span className="material-icons" style={{ color: isEpSelected ? 'var(--primary)' : 'var(--text-subtle)' }}>
                        {isEpSelected ? 'play_circle_filled' : 'play_circle_outline'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Opções de Transmissão do Episódio Selecionado */}
              {selectedEpisode && (
                <div className="tv-streams-section" style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                    Opções para o Episódio {selectedEpisode.episode || selectedEpisode.number} ({selectedEpisode.name || 'Episódio'}):
                  </h3>

                  {loadingStreams && (
                    <div style={{ color: 'var(--text-muted)' }}>Buscando opções disponíveis para o episódio...</div>
                  )}

                  {!loadingStreams && episodeStreams.length === 0 && (
                    <div style={{ color: 'var(--text-subtle)' }}>Nenhum stream encontrado para este episódio no momento.</div>
                  )}

                  {episodeStreams.map((stream, idx) => {
                    const streamFocusIndex = streamBaseIndex + idx;
                    const isStreamFocused = isZoneFocused && focusedIndex === streamFocusIndex;
                    return (
                      <div
                        key={stream.infoHash || idx}
                        className={`tv-stream-item ${isStreamFocused ? 'focused' : ''}`}
                        onClick={() => {
                          setStreamActionTarget(stream);
                          setStreamActionIndex(0);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span className="material-icons" style={{ color: 'var(--primary)' }}>play_circle</span>
                          <div>
                            <div className="tv-stream-title">{stream.title || stream.name || title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                              Tamanho: {stream.size || 'HD'} {stream.audio ? `• ${stream.audio}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className={`tv-stream-badge ${String(stream.quality || '').includes('4K') ? 'q-4k' : String(stream.quality || '').toLowerCase().includes('cam') ? 'q-cam' : ''}`}>
                          {stream.quality || '1080p Full HD'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Seção de Filmes: Opções de Transmissão */}
          {!isSeries && !isLocal && (
            <div className="tv-streams-section">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Opções de Transmissão e Qualidade:
              </h3>

              {loading && streams.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>Buscando melhores opções de transmissão...</div>
              )}

              {streams.map((stream, idx) => {
                const streamFocusIndex = streamBaseIndex + idx;
                const isStreamFocused = isZoneFocused && focusedIndex === streamFocusIndex;
                const is4K = String(stream.quality || '').includes('4K');
                const isCam = String(stream.quality || '').toLowerCase().includes('cam');
                return (
                  <div
                    key={stream.infoHash || idx}
                    className={`tv-stream-item ${isStreamFocused ? 'focused' : ''}`}
                    onClick={() => {
                      setStreamActionTarget(stream);
                      setStreamActionIndex(0);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="material-icons" style={{ color: 'var(--primary)' }}>play_circle</span>
                      <div>
                        <div className="tv-stream-title">{stream.title || stream.name || title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          Tamanho: {stream.size || 'HD'} {stream.audio ? `• ${stream.audio}` : ''}
                        </div>
                      </div>
                    </div>

                    <span className={`tv-stream-badge ${is4K ? 'q-4k' : isCam ? 'q-cam' : ''}`}>
                      {stream.quality || '1080p Full HD'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 1. Diálogo de Escolha de Versão para Download */}
      {downloadPickerOpen && (
        <div className="tv-version-picker-backdrop" onClick={() => setDownloadPickerOpen(false)}>
          <div className="tv-version-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="tv-version-picker-header">
              <h2 className="tv-version-picker-title">Escolher Versão para Download</h2>
              <p className="tv-version-picker-subtitle">
                {title} {isSeries && selectedEpisode ? `• T${selectedSeason}E${selectedEpisode.episode || selectedEpisode.number}` : ''} • Selecione a qualidade para salvar no PC (D:\Filmes)
              </p>
            </div>

            <div className="tv-version-picker-list">
              {currentAvailableStreams.map((st, sIdx) => {
                const isSelected = downloadPickerIndex === sIdx;
                const is4K = String(st.quality || '').toLowerCase().includes('4k') || String(st.title || '').toLowerCase().includes('2160p');
                const isCam = String(st.quality || '').toLowerCase().includes('cam') || String(st.title || '').toLowerCase().includes('cam');
                return (
                  <div
                    key={st.infoHash || sIdx}
                    className={`tv-version-picker-item ${isSelected ? 'focused' : ''}`}
                    onClick={() => executeDownloadStream(st)}
                  >
                    <div className="tv-version-item-left">
                      <span className="material-icons tv-version-icon">file_download</span>
                      <div className="tv-version-item-info">
                        <div className="tv-version-title">{st.title || st.name || title}</div>
                        <div className="tv-version-meta-row">
                          <span className={`tv-version-badge-quality ${is4K ? 'q-4k' : isCam ? 'q-cam' : ''}`}>{st.quality || '1080p Full HD'}</span>
                          {st.size && <span className="tv-version-badge-size">• {st.size}</span>}
                          {st.audio && <span style={{ color: 'var(--text-subtle)' }}>• {st.audio}</span>}
                        </div>
                      </div>
                    </div>

                    <button type="button" className="tv-version-btn-action">
                      <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                      <span>Baixar</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="tv-version-picker-footer">
              <span>Navegue com UP/DOWN • Pressione ENTER para baixar</span>
              <span>Pressione VOLTAR para fechar</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Diálogo de Ação de Stream Individual (Assistir / Baixar) */}
      {streamActionTarget && (
        <div className="tv-version-picker-backdrop" onClick={() => setStreamActionTarget(null)}>
          <div className="tv-stream-action-modal" onClick={e => e.stopPropagation()}>
            <div className="tv-stream-action-header">
              <span className="tv-version-badge-quality" style={{ alignSelf: 'flex-start' }}>{streamActionTarget.quality || '1080p'}</span>
              <h2 className="tv-stream-action-title">Opções para esta Versão</h2>
              <p className="tv-stream-action-subtitle">{streamActionTarget.title || streamActionTarget.name || title}</p>
              <div style={{ fontSize: '13px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Tamanho: {streamActionTarget.size || 'HD'} {streamActionTarget.audio ? `• ${streamActionTarget.audio}` : ''}
              </div>
            </div>

            <div className="tv-stream-action-buttons">
              {/* Botão 1: Assistir */}
              <button
                type="button"
                className={`tv-stream-action-btn btn-play ${streamActionIndex === 0 ? 'focused' : ''}`}
                onClick={() => {
                  const st = streamActionTarget;
                  setStreamActionTarget(null);
                  if (isSeries) {
                    const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
                    onPlayStream({
                      id: `${details.imdbId || details.id || movie.id}-s${selectedSeason}e${epNum}`,
                      movieId: details.id || movie.id,
                      imdbId: details.imdbId || movie.imdbId,
                      streamUrl: st.streamUrl,
                      title: `${title} - T${selectedSeason}E${epNum}: ${selectedEpisode?.name || 'Episódio'}`,
                      poster: selectedEpisode?.thumbnail || poster,
                      infoHash: st.infoHash,
                      quality: st.quality,
                      isLocal: false,
                      isSeries: true,
                      season: selectedSeason,
                      episode: epNum,
                      episodeName: selectedEpisode?.name || '',
                      resumePosition: resumePos
                    });
                  } else {
                    onPlayStream({
                      id: details.id || movie.id,
                      movieId: details.id || movie.id,
                      imdbId: details.imdbId || movie.imdbId,
                      streamUrl: st.streamUrl || `/api/stream/${st.infoHash}?magnet=${encodeURIComponent(st.magnet)}`,
                      title: `${title} - ${st.quality || '1080p'}`,
                      poster,
                      infoHash: st.infoHash,
                      quality: st.quality,
                      isLocal: false,
                      resumePosition: resumePos
                    });
                  }
                }}
              >
                <span className="material-icons">play_circle</span>
                <span>Assistir Agora (Reproduzir fluxo)</span>
              </button>

              {/* Botão 2: Baixar para o PC */}
              <button
                type="button"
                className={`tv-stream-action-btn btn-download ${streamActionIndex === 1 ? 'focused' : ''}`}
                onClick={() => {
                  const st = streamActionTarget;
                  setStreamActionTarget(null);
                  executeDownloadStream(st);
                }}
              >
                <span className="material-icons">file_download</span>
                <span>Baixar para o PC (Salvar em D:\Filmes)</span>
              </button>

              {/* Botão 3: Cancelar */}
              <button
                type="button"
                className={`tv-stream-action-btn ${streamActionIndex === 2 ? 'focused' : ''}`}
                onClick={() => setStreamActionTarget(null)}
              >
                <span className="material-icons">close</span>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Diálogo Especial: Download de Séries (Temporada Completa / Série Completa) */}
      {seriesDownloadModalOpen && (
        <div className="tv-version-picker-backdrop" onClick={() => setSeriesDownloadModalOpen(false)}>
          <div className="tv-series-download-modal" onClick={e => e.stopPropagation()}>
            <div className="tv-series-download-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>cloud_download</span>
                <div>
                  <h2 className="tv-series-download-title">Download de Episódios da Série</h2>
                  <div className="tv-series-download-subtitle">
                    {title} • {seasons.length > 0 ? `${seasons.length} Temporadas` : 'Temporada 1'} • Salvar em D:\Filmes\Series
                  </div>
                </div>
              </div>
            </div>

            {seriesDownloadStep === 'options' && (
              <div className="tv-series-download-options">
                {/* Opção 0: Baixar Temporada Completa */}
                <div
                  className={`tv-series-option-card ${seriesDownloadModalIndex === 0 ? 'focused' : ''}`}
                  onClick={handleSelectSeasonPacksStep}
                >
                  <div className="tv-series-option-icon-box">
                    <span className="material-icons">folder_zip</span>
                  </div>
                  <div className="tv-series-option-text">
                    <div className="tv-series-option-title">Baixar Temporada {selectedSeason} Completa</div>
                    <div className="tv-series-option-desc">
                      Baixa todos os {currentEpisodes.length} episódios da Temporada {selectedSeason} em pasta organizada (D:\Filmes\Series\{title}\Temporada {String(selectedSeason).padStart(2, '0')}). Permite escolher a qualidade e versão do pacote.
                    </div>
                  </div>
                  <button type="button" className="tv-version-btn-action">
                    <span className="material-icons">arrow_forward</span>
                    <span>Escolher Versão</span>
                  </button>
                </div>

                {/* Opção 1: Baixar Todas as Temporadas da Série */}
                <div
                  className={`tv-series-option-card ${seriesDownloadModalIndex === 1 ? 'focused' : ''}`}
                  onClick={handleExecuteDownloadAllSeasons}
                >
                  <div className="tv-series-option-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    <span className="material-icons">library_add_check</span>
                  </div>
                  <div className="tv-series-option-text">
                    <div className="tv-series-option-title">Baixar Todas as Temporadas da Série</div>
                    <div className="tv-series-option-desc">
                      Enfileira o download completo de todas as {seasons.length} temporadas ({seriesMeta?.videos?.length || currentEpisodes.length} episódios no total), separando cada temporada automaticamente em sua respectiva pasta.
                    </div>
                  </div>
                  <button type="button" className="tv-version-btn-action" style={{ background: '#22c55e', color: '#000' }}>
                    <span className="material-icons">download</span>
                    <span>Baixar Tudo</span>
                  </button>
                </div>

                {/* Opção 2: Fechar */}
                <div
                  className={`tv-series-option-card ${seriesDownloadModalIndex === 2 ? 'focused' : ''}`}
                  onClick={() => setSeriesDownloadModalOpen(false)}
                >
                  <div className="tv-series-option-icon-box" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                    <span className="material-icons">close</span>
                  </div>
                  <div className="tv-series-option-text">
                    <div className="tv-series-option-title">Cancelar</div>
                    <div className="tv-series-option-desc">Retornar aos detalhes da série sem iniciar download.</div>
                  </div>
                </div>
              </div>
            )}

            {seriesDownloadStep === 'packs' && (
              <div className="tv-series-packs-view">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                    Versões e Qualidades Disponíveis para a <strong>Temporada {selectedSeason}</strong>:
                  </span>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '13px' }}
                    onClick={() => {
                      setSeriesDownloadStep('options');
                      setSeriesDownloadModalIndex(0);
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>arrow_back</span>
                    <span>Voltar</span>
                  </button>
                </div>

                {loadingSeasonPacks && (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span className="material-icons" style={{ fontSize: '32px' }}>sync</span>
                    <p style={{ marginTop: '10px' }}>Buscando pacotes completos da Temporada {selectedSeason}...</p>
                  </div>
                )}

                {!loadingSeasonPacks && seasonPacks.length === 0 && (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                    <p>Nenhum pacote consolidado de temporada encontrado no momento.</p>
                    <button
                      type="button"
                      className="tv-btn tv-btn-primary"
                      style={{ marginTop: '12px' }}
                      onClick={handleExecuteDownloadAllSeasons}
                    >
                      Baixar episódios disponíveis individualmente
                    </button>
                  </div>
                )}

                {!loadingSeasonPacks && seasonPacks.length > 0 && (
                  <div className="tv-series-packs-list">
                    {seasonPacks.map((pack, pIdx) => {
                      const isFocused = seriesDownloadModalIndex === pIdx;
                      const is4K = String(pack.quality || '').toLowerCase().includes('4k');
                      const isPt = Boolean(pack.isPt || pack.isDubbed);
                      return (
                        <div
                          key={pack.infoHash || pIdx}
                          className={`tv-version-picker-item ${isFocused ? 'focused' : ''}`}
                          onClick={() => handleExecuteSeasonPackDownload(pack)}
                        >
                          <div className="tv-version-item-left">
                            <span className="material-icons tv-version-icon" style={{ color: isPt ? 'var(--primary)' : 'var(--text-muted)' }}>
                              {isPt ? 'star' : 'folder_zip'}
                            </span>
                            <div className="tv-version-item-info">
                              <div className="tv-version-title">{pack.label || pack.title || `${title} S${String(selectedSeason).padStart(2, '0')}`}</div>
                              <div className="tv-version-meta-row">
                                <span className={`tv-version-badge-quality ${is4K ? 'q-4k' : ''}`}>{pack.quality || '1080p Full HD'}</span>
                                {pack.size && <span className="tv-version-badge-size">• {pack.size}</span>}
                                {isPt && <span style={{ color: '#22c55e', fontWeight: 600 }}>• Dual Áudio / Dublado PT-BR</span>}
                              </div>
                            </div>
                          </div>

                          <button type="button" className="tv-version-btn-action">
                            <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                            <span>Baixar Temporada</span>
                          </button>
                        </div>
                      );
                    })}

                    {/* Botão voltar no final da lista */}
                    <div
                      className={`tv-version-picker-item ${seriesDownloadModalIndex === seasonPacks.length ? 'focused' : ''}`}
                      onClick={() => {
                        setSeriesDownloadStep('options');
                        setSeriesDownloadModalIndex(0);
                      }}
                    >
                      <div className="tv-version-item-left">
                        <span className="material-icons tv-version-icon">arrow_back</span>
                        <div className="tv-version-item-info">
                          <div className="tv-version-title">Voltar às Opções de Série</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="tv-version-picker-footer">
              <span>Navegue com UP/DOWN • Pressione ENTER para selecionar</span>
              <span>Pressione VOLTAR para fechar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MovieDetailsModal;
