import React, { useState, useEffect, useMemo } from 'react';
import { getMovieDetails, getSeriesMeta, getEpisodeStreams, isFavorite, toggleFavorite } from '../services/api';

export function MovieDetailsModal({
  movie,
  isZoneFocused,
  focusedIndex,
  onClose,
  onPlayStream
}) {
  const [details, setDetails] = useState(movie);
  const [loading, setLoading] = useState(false);
  const [favorite, setFavorite] = useState(false);

  // Estados específicos para Séries
  const [seriesMeta, setSeriesMeta] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [episodeStreams, setEpisodeStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);

  const isSeries = Boolean(details?.isSeries || details?.type === 'series' || movie?.isSeries || movie?.type === 'series');

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
            // Define temporada inicial
            const videos = meta.videos || [];
            const validSeasons = Array.from(new Set(videos.map(v => v.season).filter(s => s > 0))).sort((a, b) => a - b);
            const initialSeason = validSeasons.length > 0 ? validSeasons[0] : 1;
            setSelectedSeason(initialSeason);

            // Seleciona o primeiro episódio da temporada
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

  if (!movie) return null;

  const title = details.title || movie.title;
  const poster = details.poster || movie.poster;
  const backdrop = details.backdrop || movie.backdrop || poster;
  const synopsis = details.synopsis || details.description || movie.synopsis || 'Sem sinopse disponível.';
  const streams = details.streams || [];
  const isLocal = Boolean(details.isLocal || details.filePath || details.videoPath);

  const handleToggleFav = () => {
    const next = toggleFavorite(details);
    setFavorite(next);
  };

  // Temporadas disponíveis
  const seasons = useMemo(() => {
    if (!seriesMeta?.videos) return [];
    const sSet = new Set(seriesMeta.videos.map(v => v.season).filter(s => s > 0));
    return Array.from(sSet).sort((a, b) => a - b);
  }, [seriesMeta]);

  // Episódios da temporada selecionada
  const currentEpisodes = useMemo(() => {
    if (!seriesMeta?.videos) return [];
    return seriesMeta.videos
      .filter(v => v.season === selectedSeason)
      .sort((a, b) => (a.episode || a.number || 0) - (b.episode || b.number || 0));
  }, [seriesMeta, selectedSeason]);

  const isPlayFocused = isZoneFocused && focusedIndex === 0;
  const isFavFocused = isZoneFocused && focusedIndex === 1;

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-modal-container" onClick={e => e.stopPropagation()}>
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
                  <span className="tv-badge-pill" style={{ background: '#22c55e', color: '#000' }}>Arquivo Local</span>
                )}
              </div>

              <div className="tv-hero-actions">
                {!isSeries && (
                  <button
                    type="button"
                    className={`tv-btn tv-btn-primary ${isPlayFocused ? 'focused' : ''}`}
                    onClick={() => {
                      if (isLocal) {
                        onPlayStream({
                          streamUrl: details.streamUrl || `/api/stream/local?file=${encodeURIComponent(details.filePath || details.videoPath)}`,
                          title,
                          poster,
                          isLocal: true
                        });
                      } else if (streams.length > 0) {
                        onPlayStream({
                          streamUrl: streams[0].streamUrl || `/api/stream/${streams[0].infoHash}?magnet=${encodeURIComponent(streams[0].magnet)}`,
                          title,
                          poster,
                          infoHash: streams[0].infoHash,
                          quality: streams[0].quality
                        });
                      }
                    }}
                  >
                    <span className="material-icons">play_arrow</span>
                    <span>{isLocal ? 'Assistir Agora (Local)' : 'Assistir Melhor Opção'}</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`tv-btn tv-btn-secondary ${isFavFocused ? 'focused' : ''}`}
                  onClick={handleToggleFav}
                >
                  <span className="material-icons">{favorite ? 'check' : 'add'}</span>
                  <span>{favorite ? 'Na Minha Lista' : 'Minha Lista'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
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
                <div className="tv-streams-section" style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                    Opções para o Episódio {selectedEpisode.episode || selectedEpisode.number} ({selectedEpisode.name}):
                  </h3>

                  {loadingStreams && (
                    <div style={{ color: 'var(--text-muted)' }}>Buscando torrents disponíveis para o episódio...</div>
                  )}

                  {!loadingStreams && episodeStreams.length === 0 && (
                    <div style={{ color: 'var(--text-subtle)' }}>Nenhum stream encontrado para este episódio no momento.</div>
                  )}

                  {episodeStreams.map((stream, idx) => (
                    <div
                      key={stream.infoHash || idx}
                      className="tv-stream-item"
                      onClick={() => onPlayStream({
                        streamUrl: stream.streamUrl,
                        title: `${title} - T${selectedSeason}E${selectedEpisode.episode || selectedEpisode.number}: ${selectedEpisode.name || ''}`,
                        poster: selectedEpisode.thumbnail || poster,
                        infoHash: stream.infoHash,
                        quality: stream.quality
                      })}
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
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seção de Filmes: Torrents */}
          {!isSeries && !isLocal && (
            <div className="tv-streams-section">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Opções de Transmissão (Torrents Disponíveis):
              </h3>

              {loading && streams.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>Buscando melhores fontes e sementes...</div>
              )}

              {streams.map((stream, idx) => {
                const streamFocusIndex = 2 + idx;
                const isStreamFocused = isZoneFocused && focusedIndex === streamFocusIndex;
                return (
                  <div
                    key={stream.infoHash || idx}
                    className={`tv-stream-item ${isStreamFocused ? 'focused' : ''}`}
                    onClick={() => onPlayStream({
                      streamUrl: stream.streamUrl || `/api/stream/${stream.infoHash}?magnet=${encodeURIComponent(stream.magnet)}`,
                      title: `${title} - ${stream.quality || '1080p'}`,
                      poster,
                      infoHash: stream.infoHash,
                      quality: stream.quality
                    })}
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
