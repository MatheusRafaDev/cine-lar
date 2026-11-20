import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getMovieDetails,
  getSeriesMeta,
  getEpisodeStreams,
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
  modalActionRef
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

  const isSeries = Boolean(details?.isSeries || details?.type === 'series' || movie?.isSeries || movie?.type === 'series');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (!movie) return;
    setFavorite(isFavorite(movie.id, movie.imdbId));

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
  const streamBaseIndex = hasResume ? 5 : 3;

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
        quality: best.quality,
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
          quality: s.quality,
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
          title: `${title} - ${s.quality || '1080p'}`,
          poster,
          infoHash: s.infoHash,
          quality: s.quality,
          isLocal: false,
          resumePosition: resumePos
        });
      }
    }
  }, [isSeries, episodeStreams, selectedEpisode, selectedSeason, details, movie, title, poster, streams, resumePos, onPlayStream]);

  // Ação 2: Download para o PC
  const handleDownload = useCallback(async () => {
    if (isLocal) {
      showToast('Este arquivo já está salvo no seu computador em D:\\Filmes.');
      return;
    }

    if (downloading) {
      showToast('Download em andamento no PC...');
      return;
    }

    if (isSeries) {
      if (episodeStreams.length === 0) {
        showToast('Buscando torrents do episódio para iniciar download...');
        return;
      }
      const best = episodeStreams[0];
      const epNum = selectedEpisode?.episode || selectedEpisode?.number || 1;
      const cleanTitle = `${title} - S${String(selectedSeason).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
      setDownloading(true);
      try {
        const res = await startDownload({
          magnet: best.magnet,
          title: details.title || title,
          filename: cleanTitle,
          poster,
          imdbId: details.imdbId || movie.imdbId,
          isSeries: true,
          seriesName: details.title || title,
          season: selectedSeason,
          episode: epNum,
          quality: best.quality
        });
        if (res && (res.id || res.message || res.success !== false)) {
          setDownloadSuccess(true);
          showToast(`Download de "${cleanTitle}" iniciado em D:\\Filmes!`);
        } else {
          showToast('Erro ao iniciar download no PC.');
        }
      } catch (err) {
        showToast(`Erro ao iniciar download: ${err.message}`);
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (streams.length === 0) {
      showToast('Aguardando fontes torrent para iniciar download...');
      return;
    }

    const best = streams[0];
    setDownloading(true);
    try {
      const res = await startDownload({
        magnet: best.magnet,
        title,
        poster,
        imdbId: details.imdbId || movie.imdbId || details.id,
        quality: best.quality
      });
      if (res && (res.id || res.message || res.success !== false)) {
        setDownloadSuccess(true);
        showToast(`Download de "${title}" iniciado em D:\\Filmes!`);
      } else {
        showToast('Erro ao iniciar download no PC.');
      }
    } catch (err) {
      showToast(`Erro ao iniciar download: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }, [isLocal, downloading, isSeries, episodeStreams, streams, details, selectedEpisode, selectedSeason, title, poster, movie]);

  // Ação 3: Favoritos
  const handleToggleFav = useCallback(() => {
    const next = toggleFavorite(details);
    setFavorite(next);
    showToast(next ? 'Adicionado à sua lista de Favoritos!' : 'Removido dos seus Favoritos.');
  }, [details]);

  // Ação 4: Remover de Continuar Assistindo
  const handleRemoveHistory = useCallback(() => {
    const idToClear = details?.id || movie?.id || details?.filePath || movie?.filePath || title;
    if (idToClear) {
      clearWatchProgress(idToClear);
      showToast('Removido de Continuar Assistindo.');
      onClose?.();
    }
  }, [details, movie, title, onClose]);

  // Vincula controlador de ações espaciais para o controle remoto da TV
  useEffect(() => {
    if (modalActionRef) {
      modalActionRef.current = {
        triggerAction: (idx) => {
          if (hasResume) {
            if (idx === 0) {
              handlePlay(resumePos);
            } else if (idx === 1) {
              handlePlay(0);
            } else if (idx === 2) {
              handleDownload();
            } else if (idx === 3) {
              handleToggleFav();
            } else if (idx === 4) {
              handleRemoveHistory();
            } else if (idx >= 5) {
              handleStreamSelect(idx - 5);
            }
          } else {
            if (idx === 0) {
              handlePlay(0);
            } else if (idx === 1) {
              handleDownload();
            } else if (idx === 2) {
              handleToggleFav();
            } else if (idx >= 3) {
              handleStreamSelect(idx - 3);
            }
          }
        }
      };
    }
  }, [modalActionRef, handlePlay, handleDownload, handleToggleFav, handleRemoveHistory, handleStreamSelect, hasResume, resumePos]);

  if (!movie) return null;

  // Temporadas disponíveis
  const seasons = Array.from(new Set(seriesMeta?.videos?.map(v => v.season).filter(s => s > 0) || [])).sort((a, b) => a - b);

  // Episódios da temporada selecionada
  const currentEpisodes = (seriesMeta?.videos || [])
    .filter(v => v.season === selectedSeason)
    .sort((a, b) => (a.episode || a.number || 0) - (b.episode || b.number || 0));

  const isPlayFocused = isZoneFocused && focusedIndex === 0;
  const isRestartFocused = isZoneFocused && hasResume && focusedIndex === 1;
  const isDownloadFocused = isZoneFocused && (hasResume ? focusedIndex === 2 : focusedIndex === 1);
  const isFavFocused = isZoneFocused && (hasResume ? focusedIndex === 3 : focusedIndex === 2);
  const isRemoveHistoryFocused = isZoneFocused && hasResume && focusedIndex === 4;

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
                      ? `Assistir Agora (${streams[0].quality || '1080p'})`
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

                {/* 3. Botão Baixar para o PC */}
                <button
                  type="button"
                  className={`tv-btn tv-btn-download ${isDownloadFocused ? 'focused' : ''} ${isLocal ? 'already-local' : ''}`}
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
                      ? `Baixar Episódio ${selectedEpisode?.episode || selectedEpisode?.number || 1} para o PC`
                      : 'Baixar para o PC (D:\\Filmes)'}
                  </span>
                </button>

                {/* 4. Botão Minha Lista (Favoritos) */}
                <button
                  type="button"
                  className={`tv-btn tv-btn-secondary ${isFavFocused ? 'focused' : ''}`}
                  onClick={handleToggleFav}
                >
                  <span className="material-icons">{favorite ? 'check' : 'add'}</span>
                  <span>{favorite ? 'Na Minha Lista' : 'Minha Lista'}</span>
                </button>

                {/* 5. Botão Remover do Histórico (quando aplicável) */}
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
                    <div style={{ color: 'var(--text-muted)' }}>Buscando torrents disponíveis para o episódio...</div>
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
                        onClick={() => handleStreamSelect(idx)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span className="material-icons" style={{ color: 'var(--primary)' }}>play_circle</span>
                          <div>
                            <div className="tv-stream-title">{stream.title || stream.name || title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                              Sementes: {stream.seeders || stream.seeds || 0} • Tamanho: {stream.size || 'HD'} {stream.audio ? `• ${stream.audio}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className="tv-stream-badge">{stream.quality || '1080p'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Seção de Filmes: Opções de Transmissão (Torrents) */}
          {!isSeries && !isLocal && (
            <div className="tv-streams-section">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Opções de Transmissão (Torrents Disponíveis):
              </h3>

              {loading && streams.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>Buscando melhores fontes e sementes...</div>
              )}

              {streams.map((stream, idx) => {
                const streamFocusIndex = streamBaseIndex + idx;
                const isStreamFocused = isZoneFocused && focusedIndex === streamFocusIndex;
                return (
                  <div
                    key={stream.infoHash || idx}
                    className={`tv-stream-item ${isStreamFocused ? 'focused' : ''}`}
                    onClick={() => handleStreamSelect(idx)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="material-icons" style={{ color: 'var(--primary)' }}>play_circle</span>
                      <div>
                        <div className="tv-stream-title">{stream.title || stream.name || title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          Sementes: {stream.seeders || stream.seeds || 0} • Tamanho: {stream.size || 'HD'} {stream.audio ? `• ${stream.audio}` : ''}
                        </div>
                      </div>
                    </div>

                    <span className="tv-stream-badge">{stream.quality || '1080p'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default MovieDetailsModal;
