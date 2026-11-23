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
  isInWatchHistory,
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
  onToggleFavorite,
  onDeleteLocal,
  onDownloadStarted
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
  const [downloadDestination, setDownloadDestination] = useState(movie?.preferredDestination || 'local'); // 'local' | 'drive'
  const [streamActionTarget, setStreamActionTarget] = useState(null);
  const [streamActionIndex, setStreamActionIndex] = useState(0);

  // Estados para Download de Temporada Completa ou Todos os Episódios da Série
  const [seriesDownloadModalOpen, setSeriesDownloadModalOpen] = useState(false);
  const [seriesDownloadStep, setSeriesDownloadStep] = useState('options'); // 'options' | 'packs'
  const [seriesDownloadModalIndex, setSeriesDownloadModalIndex] = useState(0);
  const [seriesDownloadDestination, setSeriesDownloadDestination] = useState(movie?.preferredDestination || 'local'); // 'local' | 'drive'
  const [seasonPacks, setSeasonPacks] = useState([]);
  const [loadingSeasonPacks, setLoadingSeasonPacks] = useState(false);

  useEffect(() => {
    if (movie?.preferredDestination) {
      setDownloadDestination(movie.preferredDestination);
      setSeriesDownloadDestination(movie.preferredDestination);
    }
  }, [movie?.preferredDestination]);

  const isSeries = Boolean(details?.isSeries || details?.type === 'series' || movie?.isSeries || movie?.type === 'series');
  const isDrive = Boolean(
    details?.isCloud || details?.isDrive || details?.storageLocation === 'drive' ||
    movie?.isCloud || movie?.isDrive || movie?.storageLocation === 'drive' ||
    String(details?.filePath || movie?.filePath || '').toLowerCase().includes('cinelar') ||
    String(details?.filePath || movie?.filePath || '').toLowerCase().startsWith('g:\\') ||
    String(details?.filePath || movie?.filePath || '').toLowerCase().includes('meu drive')
  );

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
  const resolvedLocalPath = details?.filePath || details?.videoPath || details?.localFile?.videoPath || movie?.filePath || movie?.videoPath || '';
  const isLocal = Boolean(resolvedLocalPath);

  // Progresso salvo previamente no histórico
  const savedProgress = useMemo(() => {
    return getSavedProgress(details || movie);
  }, [details, movie]);

  const hasResume = Boolean(savedProgress && savedProgress.position > 10 && (!savedProgress.duration || (savedProgress.position / savedProgress.duration) < 0.92));
  const resumePos = hasResume ? savedProgress.position : (details?.position || movie?.position || 0);
  const isInHistory = Boolean(hasResume || savedProgress || isInWatchHistory(details || movie));

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

    if (isLocal && resolvedLocalPath) {
      const sUrl = details?.localFile?.streamUrl || details?.streamUrl || movie?.streamUrl || `/api/local/stream?file=${encodeURIComponent(resolvedLocalPath)}`;
      onPlayStream({
        id: details.id || movie.id || resolvedLocalPath,
        movieId: details.id || movie.id || resolvedLocalPath,
        imdbId: details.imdbId || movie.imdbId,
        streamUrl: sUrl,
        title,
        poster,
        quality: details?.localFile?.quality || details.quality || movie.quality || '1080p Full HD',
        isLocal: true,
        filePath: resolvedLocalPath,
        duration: details?.localFile?.duration || details.duration || movie.duration || 0,
        resumePosition: posToResume,
        hasSubtitle: Boolean(details?.hasSubtitle || movie?.hasSubtitle || details?.localFile?.hasSubtitle),
        srtPath: details?.srtPath || movie?.srtPath || details?.localFile?.srtPath || '',
        subtitleUrl: details?.subtitleUrl || movie?.subtitleUrl || ''
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

  // Executa o download da versão específica selecionada com destino explícito ('local' ou 'drive')
  const executeDownloadStream = useCallback(async (streamToDownload, destination = 'local') => {
    if (!streamToDownload || !streamToDownload.magnet) {
      showToast('Opção inválida para download.');
      return;
    }
    setDownloading(true);
    const isDrive = destination === 'drive' || destination === 'gdrive';
    const destLabel = isDrive ? 'Google Drive (G:\\Meu Drive\\cinelar)' : 'Pasta Local (D:\\Filmes)';
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
          quality: streamToDownload.quality || '1080p',
          destination: isDrive ? 'drive' : 'local'
        });
        if (res && (res.id || res.message || res.success !== false)) {
          setDownloadSuccess(true);
          onDownloadStarted?.();
          showToast(`Download de "${cleanTitle}" (${streamToDownload.quality || '1080p'}) iniciado em ${destLabel}!`);
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
          quality: streamToDownload.quality || '1080p',
          destination: isDrive ? 'drive' : 'local'
        });
        if (res && (res.id || res.message || res.success !== false)) {
          setDownloadSuccess(true);
          onDownloadStarted?.();
          showToast(`Download de "${title}" (${streamToDownload.quality || '1080p'}) iniciado em ${destLabel}!`);
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
  }, [isSeries, selectedEpisode, selectedSeason, title, details, poster, movie, onDownloadStarted]);

  // Ação 2: Download para o PC ou Drive (com escolha de versão)
  const handleDownload = useCallback(() => {
    if (isLocal) {
      showToast('Este arquivo já está salvo no seu computador.');
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
      // Abre o diálogo de ação permitindo ao usuário escolher onde baixar (Local ou Drive)
      setStreamActionTarget(avail[0]);
      setStreamActionIndex(1);
      return;
    }

    setDownloadPickerIndex(0);
    setDownloadPickerOpen(true);
  }, [isLocal, downloading, isSeries, episodeStreams, streams]);

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
    const target = { ...movie, ...details };
    clearWatchProgress(target);
    showToast(`"${title}" removido de Continuar Assistindo.`);
    onClose?.();
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

  const handleExecuteSeasonPackDownload = useCallback(async (pack, destination = 'local') => {
    if (!pack || !pack.magnet) {
      showToast('Opção de download inválida.');
      return;
    }
    setDownloading(true);
    const isDrive = destination === 'drive' || destination === 'gdrive';
    const destLabel = isDrive ? 'Google Drive (G:\\Meu Drive\\cinelar\\Series)' : 'Pasta Local (D:\\Filmes\\Series)';
    try {
      const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
      const res = await downloadSeason({
        imdbId: imdb,
        seriesName: details?.title || title,
        season: selectedSeason,
        magnet: pack.magnet,
        quality: pack.quality || '1080p',
        destination: isDrive ? 'drive' : 'local'
      });
      if (res && res.success !== false) {
        setDownloadSuccess(true);
        onDownloadStarted?.();
        showToast(`Download da Temporada ${selectedSeason} de "${title}" (${pack.quality || '1080p'}) iniciado em ${destLabel}!`);
      } else {
        showToast(res?.error || 'Erro ao iniciar download da temporada.');
      }
    } catch (err) {
      showToast(`Erro ao baixar temporada: ${err.message}`);
    } finally {
      setDownloading(false);
      setSeriesDownloadModalOpen(false);
    }
  }, [details, movie, selectedSeason, title, onDownloadStarted]);

  const handleExecuteDownloadAllSeasons = useCallback(async (destination = 'local') => {
    setDownloading(true);
    const isDrive = destination === 'drive' || destination === 'gdrive';
    const destLabel = isDrive ? 'Google Drive (G:\\Meu Drive\\cinelar\\Series)' : 'Pasta Local (D:\\Filmes\\Series)';
    try {
      const imdb = details?.imdbId || movie?.imdbId || details?.id || movie?.id;
      const seasonsList = Array.from(new Set(seriesMeta?.videos?.map(v => v.season).filter(s => s > 0) || [])).sort((a, b) => a - b);
      const res = await downloadAllSeries({
        imdbId: imdb,
        seriesName: details?.title || title,
        seasons: seasonsList.length > 0 ? seasonsList : [selectedSeason],
        destination: isDrive ? 'drive' : 'local'
      });
      if (res && res.success !== false) {
        setDownloadSuccess(true);
        onDownloadStarted?.();
        showToast(`Download de todas as temporadas de "${title}" iniciado em ${destLabel}!`);
      } else {
        showToast(res?.error || 'Erro ao iniciar download da série completa.');
      }
    } catch (err) {
      showToast(`Erro ao baixar série: ${err.message}`);
    } finally {
      setDownloading(false);
      setSeriesDownloadModalOpen(false);
    }
  }, [details, movie, title, seriesMeta, selectedSeason, onDownloadStarted]);

  // Botões de ação principais do modal
  const actionButtons = useMemo(() => {
    const list = [];

    // 1. Assistir ou Continuar
    list.push({
      id: 'play',
      primary: true,
      icon: 'play_arrow',
      label: hasResume
        ? `Continuar (${formatTime(resumePos)})`
        : isDrive
        ? 'Assistir do Google Drive'
        : isLocal
        ? 'Assistir do Computador'
        : isSeries
        ? `Assistir Episódio ${selectedEpisode?.episode || selectedEpisode?.number || 1}`
        : loading
        ? 'Buscando Fontes...'
        : streams.length > 0
        ? `Assistir Agora (${streams[0].quality || '1080p'})`
        : 'Assistir',
      action: () => handlePlay(hasResume ? resumePos : 0)
    });

    // 2. Do Início (quando houver progresso prévio)
    if (hasResume) {
      list.push({
        id: 'restart',
        icon: 'replay',
        label: 'Do Início',
        action: () => handlePlay(0)
      });
    }

    // 3. Baixar para o PC / Excluir Arquivo Local se já estiver salvo no disco
    if (isLocal && onDeleteLocal) {
      list.push({
        id: 'delete_local',
        icon: 'delete_forever',
        label: isDrive ? 'Excluir do Drive' : 'Excluir do PC',
        warning: true,
        action: () => onDeleteLocal({ ...movie, ...details })
      });
    } else {
      list.push({
        id: 'download',
        icon: isLocal
          ? 'check_circle'
          : downloadSuccess
          ? 'cloud_done'
          : downloading
          ? 'sync'
          : 'file_download',
        label: isDrive
          ? 'Salvo no Google Drive'
          : isLocal
          ? 'Salvo no Computador'
          : downloadSuccess
          ? 'Download Iniciado!'
          : downloading
          ? 'Baixando...'
          : isSeries
          ? `Baixar Episódio ${selectedEpisode?.episode || selectedEpisode?.number || 1}`
          : 'Baixar Filme',
        isDownload: true,
        action: handleDownload
      });
    }

    // 4. Baixar Todos os Episódios (Apenas Séries online)
    if (isSeries && !isLocal) {
      list.push({
        id: 'download_all',
        icon: 'cloud_download',
        label: 'Baixar Todos os Episódios',
        isDownloadAll: true,
        action: () => handleOpenSeriesDownloadDialog(false)
      });
    }

    // 5. Minha Lista (Favoritos)
    list.push({
      id: 'fav',
      icon: favorite ? 'check' : 'add',
      label: favorite ? 'Na Minha Lista' : 'Minha Lista',
      action: handleToggleFav
    });

    // 6. Tirar de Continuar Assistindo (quando estiver no histórico)
    if (isInHistory) {
      list.push({
        id: 'remove_history',
        icon: 'history_toggle_off',
        label: 'Tirar de Continuar',
        warning: true,
        action: handleRemoveHistory
      });
    }

    return list;
  }, [
    hasResume,
    resumePos,
    isLocal,
    isSeries,
    selectedEpisode,
    loading,
    streams,
    downloadSuccess,
    downloading,
    favorite,
    isInHistory,
    handlePlay,
    handleDownload,
    handleOpenSeriesDownloadDialog,
    handleToggleFav,
    handleRemoveHistory,
    onDeleteLocal,
    movie,
    details
  ]);

  const streamBaseIndex = actionButtons.length;

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
            setStreamActionIndex(prev => delta > 0 ? Math.min(3, prev + 1) : Math.max(0, prev - 1));
          }
        },
        handleSubDir: (delta) => {
          if (downloadPickerOpen) {
            setDownloadDestination(prev => (prev === 'local' ? 'drive' : 'local'));
            return;
          }
          if (seriesDownloadModalOpen) {
            setSeriesDownloadDestination(prev => (prev === 'local' ? 'drive' : 'local'));
            return;
          }
        },
        handleSubEnter: () => {
          if (seriesDownloadModalOpen) {
            if (seriesDownloadStep === 'options') {
              if (seriesDownloadModalIndex === 0) {
                handleSelectSeasonPacksStep();
              } else if (seriesDownloadModalIndex === 1) {
                handleExecuteDownloadAllSeasons(seriesDownloadDestination);
              } else {
                setSeriesDownloadModalOpen(false);
              }
            } else if (seriesDownloadStep === 'packs') {
              if (seriesDownloadModalIndex < seasonPacks.length) {
                const pack = seasonPacks[seriesDownloadModalIndex];
                if (pack) handleExecuteSeasonPackDownload(pack, seriesDownloadDestination);
              } else {
                setSeriesDownloadStep('options');
                setSeriesDownloadModalIndex(0);
              }
            }
          } else if (downloadPickerOpen) {
            const selected = currentAvailableStreams[downloadPickerIndex];
            if (selected) executeDownloadStream(selected, downloadDestination);
          } else if (streamActionTarget) {
            const st = streamActionTarget;
            setStreamActionTarget(null);
            if (streamActionIndex === 0) {
              executeDownloadStream(st, 'local');
            } else if (streamActionIndex === 1) {
              executeDownloadStream(st, 'drive');
            } else if (streamActionIndex === 2) {
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
            }
          }
        },
        triggerAction: (idx, isPlayKey) => {
          if (downloadPickerOpen || streamActionTarget || seriesDownloadModalOpen) return;

          if (idx < actionButtons.length) {
            actionButtons[idx].action();
          } else {
            const streamIdx = idx - actionButtons.length;
            const target = isSeries ? episodeStreams[streamIdx] : streams[streamIdx];
            if (isPlayKey) {
              handleStreamSelect(streamIdx);
            } else if (target) {
              setStreamActionTarget(target);
              setStreamActionIndex(0);
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
    isSeries,
    selectedEpisode,
    selectedSeason,
    details,
    movie,
    title,
    poster,
    resumePos,
    onPlayStream,
    actionButtons,
    handleStreamSelect,
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
                {actionButtons.map((btn, idx) => {
                  const isFocused = isZoneFocused && focusedIndex === idx;
                  let btnClass = 'tv-btn';
                  if (btn.primary) btnClass += ' tv-btn-primary';
                  else if (btn.isDownload) btnClass += ` tv-btn-download ${isLocal ? 'already-local' : ''}`;
                  else if (btn.isDownloadAll) btnClass += ' tv-btn-download-all';
                  else if (btn.warning) btnClass += ' tv-btn-warning';
                  else btnClass += ' tv-btn-secondary';

                  if (isFocused) btnClass += ' focused';

                  return (
                    <button
                      key={btn.id}
                      type="button"
                      className={btnClass}
                      onClick={btn.action}
                      title={btn.id === 'remove_history' ? 'Remover de Continuar Assistindo' : btn.label}
                    >
                      <span
                        className="material-icons"
                        style={btn.warning ? { color: '#EF4444', fontSize: '18px' } : undefined}
                      >
                        {btn.icon}
                      </span>
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
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
                {title} {isSeries && selectedEpisode ? `• T${selectedSeason}E${selectedEpisode.episode || selectedEpisode.number}` : ''} • Destino: {downloadDestination === 'drive' ? 'Google Drive (G:\\Meu Drive\\cinelar)' : 'Pasta Local (D:\\Filmes)'}
              </p>
              {/* Seletor de Destino: Pasta Local vs Google Drive */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className={`tv-btn ${downloadDestination === 'local' ? 'tv-btn-primary' : 'tv-btn-secondary'}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: downloadDestination === 'local' ? '#10B981' : undefined,
                    color: downloadDestination === 'local' ? '#FFF' : undefined,
                    fontWeight: 700
                  }}
                  onClick={() => setDownloadDestination('local')}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>folder</span>
                  <span>📁 Pasta Local (D:\Filmes)</span>
                </button>
                <button
                  type="button"
                  className={`tv-btn ${downloadDestination === 'drive' ? 'tv-btn-primary' : 'tv-btn-secondary'}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: downloadDestination === 'drive' ? '#4285F4' : undefined,
                    color: downloadDestination === 'drive' ? '#FFF' : undefined,
                    fontWeight: 700
                  }}
                  onClick={() => setDownloadDestination('drive')}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>cloud</span>
                  <span>☁️ Google Drive (G:\Meu Drive\cinelar)</span>
                </button>
              </div>
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
                    onClick={() => executeDownloadStream(st, downloadDestination)}
                  >
                    <div className="tv-version-item-left">
                      <span className="material-icons tv-version-icon" style={{ color: downloadDestination === 'drive' ? '#4285F4' : '#10B981' }}>
                        {downloadDestination === 'drive' ? 'cloud_download' : 'file_download'}
                      </span>
                      <div className="tv-version-item-info">
                        <div className="tv-version-title">{st.title || st.name || title}</div>
                        <div className="tv-version-meta-row">
                          <span className={`tv-version-badge-quality ${is4K ? 'q-4k' : isCam ? 'q-cam' : ''}`}>{st.quality || '1080p Full HD'}</span>
                          {st.size && <span className="tv-version-badge-size">• {st.size}</span>}
                          {st.audio && <span style={{ color: 'var(--text-subtle)' }}>• {st.audio}</span>}
                        </div>
                      </div>
                    </div>

                    <button type="button" className="tv-version-btn-action" style={{ background: downloadDestination === 'drive' ? '#4285F4' : undefined }}>
                      <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                      <span>Baixar ({downloadDestination === 'drive' ? 'Google Drive' : 'Pasta Local'})</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="tv-version-picker-footer">
              <span>◄ ► LEFT/RIGHT: Alternar Destino (Local / Drive) • ▲ ▼ UP/DOWN: Navegar • ENTER: Baixar</span>
              <span>VOLTAR: Fechar</span>
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
              <h2 className="tv-stream-action-title">Onde você deseja salvar este download?</h2>
              <p className="tv-stream-action-subtitle">{streamActionTarget.title || streamActionTarget.name || title}</p>
              <div style={{ fontSize: '13px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Tamanho: {streamActionTarget.size || 'HD'} {streamActionTarget.audio ? `• ${streamActionTarget.audio}` : ''}
              </div>
            </div>

            <div className="tv-stream-action-buttons">
              {/* Botão 0: Baixar na Pasta Local */}
              <button
                type="button"
                className={`tv-stream-action-btn btn-download ${streamActionIndex === 0 ? 'focused' : ''}`}
                style={{
                  background: streamActionIndex === 0 ? '#10B981' : 'rgba(16, 185, 129, 0.15)',
                  color: streamActionIndex === 0 ? '#FFF' : '#34D399',
                  border: streamActionIndex === 0 ? '2px solid #FFF' : '1px solid rgba(16, 185, 129, 0.3)'
                }}
                onClick={() => {
                  const st = streamActionTarget;
                  setStreamActionTarget(null);
                  executeDownloadStream(st, 'local');
                }}
              >
                <span className="material-icons">folder</span>
                <span>📁 Salvar na Pasta Local (D:\Filmes)</span>
              </button>

              {/* Botão 1: Baixar no Google Drive */}
              <button
                type="button"
                className={`tv-stream-action-btn ${streamActionIndex === 1 ? 'focused' : ''}`}
                style={{
                  background: streamActionIndex === 1 ? '#4285F4' : 'rgba(66, 133, 244, 0.15)',
                  color: streamActionIndex === 1 ? '#FFF' : '#8AB4F8',
                  border: streamActionIndex === 1 ? '2px solid #FFF' : '1px solid rgba(66, 133, 244, 0.3)'
                }}
                onClick={() => {
                  const st = streamActionTarget;
                  setStreamActionTarget(null);
                  executeDownloadStream(st, 'drive');
                }}
              >
                <span className="material-icons">cloud</span>
                <span>☁️ Salvar no Google Drive (G:\Meu Drive\cinelar)</span>
              </button>

              {/* Botão 2: Assistir Agora */}
              <button
                type="button"
                className={`tv-stream-action-btn btn-play ${streamActionIndex === 2 ? 'focused' : ''}`}
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
                <span>▶️ Assistir Agora (Torrent Streaming)</span>
              </button>

              {/* Botão 3: Cancelar */}
              <button
                type="button"
                className={`tv-stream-action-btn ${streamActionIndex === 3 ? 'focused' : ''}`}
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
                    {title} • {seasons.length > 0 ? `${seasons.length} Temporadas` : 'Temporada 1'} • Salvar em {seriesDownloadDestination === 'drive' ? 'G:\\Meu Drive\\cinelar\\Series' : 'D:\\Filmes\\Series'}
                  </div>
                </div>
              </div>

              {/* Seletor de Destino Série */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className={`tv-btn ${seriesDownloadDestination === 'local' ? 'tv-btn-primary' : 'tv-btn-secondary'}`}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: seriesDownloadDestination === 'local' ? '#10B981' : undefined,
                    color: seriesDownloadDestination === 'local' ? '#FFF' : undefined,
                    fontWeight: 700
                  }}
                  onClick={() => setSeriesDownloadDestination('local')}
                >
                  <span className="material-icons" style={{ fontSize: '15px' }}>folder</span>
                  <span>📁 Pasta Local (D:\Filmes\Series)</span>
                </button>
                <button
                  type="button"
                  className={`tv-btn ${seriesDownloadDestination === 'drive' ? 'tv-btn-primary' : 'tv-btn-secondary'}`}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: seriesDownloadDestination === 'drive' ? '#4285F4' : undefined,
                    color: seriesDownloadDestination === 'drive' ? '#FFF' : undefined,
                    fontWeight: 700
                  }}
                  onClick={() => setSeriesDownloadDestination('drive')}
                >
                  <span className="material-icons" style={{ fontSize: '15px' }}>cloud</span>
                  <span>☁️ Google Drive (G:\Meu Drive\cinelar\Series)</span>
                </button>
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
                      Baixa todos os {currentEpisodes.length} episódios da Temporada {selectedSeason} em pasta organizada ({seriesDownloadDestination === 'drive' ? 'G:\\Meu Drive\\cinelar\\Series' : 'D:\\Filmes\\Series'}\{title}\Temporada {String(selectedSeason).padStart(2, '0')}). Permite escolher a qualidade e versão do pacote.
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
                  onClick={() => handleExecuteDownloadAllSeasons(seriesDownloadDestination)}
                >
                  <div className="tv-series-option-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    <span className="material-icons">library_add_check</span>
                  </div>
                  <div className="tv-series-option-text">
                    <div className="tv-series-option-title">Baixar Todas as Temporadas da Série</div>
                    <div className="tv-series-option-desc">
                      Enfileira o download completo de todas as {seasons.length} temporadas ({seriesMeta?.videos?.length || currentEpisodes.length} episódios no total), salvando em {seriesDownloadDestination === 'drive' ? 'G:\\Meu Drive\\cinelar\\Series' : 'D:\\Filmes\\Series'}.
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
                      onClick={() => handleExecuteDownloadAllSeasons(seriesDownloadDestination)}
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
                          onClick={() => handleExecuteSeasonPackDownload(pack, seriesDownloadDestination)}
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
              <span>◄ ► LEFT/RIGHT: Alternar Destino (Local / Drive) • ▲ ▼ UP/DOWN: Navegar • ENTER: Confirmar</span>
              <span>VOLTAR: Fechar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MovieDetailsModal;
