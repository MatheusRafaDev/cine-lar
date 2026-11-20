import React, { useState, useEffect } from 'react';
import { getMovieDetails, isFavorite, toggleFavorite } from '../services/api';

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

  useEffect(() => {
    if (!movie) return;
    setFavorite(isFavorite(movie.id, movie.imdbId));

    let isMounted = true;
    setLoading(true);

    getMovieDetails(movie)
      .then(res => {
        if (isMounted && res) {
          setDetails(prev => ({ ...prev, ...res }));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [movie]);

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

  // Índices focáveis no modal:
  // 0: Botão Assistir
  // 1: Botão Minha Lista
  // 2+: Streams da lista
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
                {details.duration && (
                  <span className="tv-badge-pill">{details.duration}</span>
                )}
                {isLocal && (
                  <span className="tv-badge-pill" style={{ background: '#22c55e', color: '#000' }}>Arquivo Local</span>
                )}
              </div>

              <div className="tv-hero-actions">
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

          {!isLocal && (
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
                          Peers: {stream.peers || 0} • Sementes: {stream.seeds || stream.seeds || 0} • Tamanho: {stream.size || 'HD'}
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
