import React, { useEffect, useRef, memo } from 'react';
import { getSavedProgress } from '../services/api';

function LocalMovieCardComponent({ movie, isFocused, onClick }) {
  const cardRef = useRef(null);

  // Auto-scroll vertical instantaneo para manter o card sempre visivel na TV sem atraso
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [isFocused]);

  if (!movie) return null;

  const poster = movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1c1c1a/ffffff?text=Sem+Poster';
  const title = movie.title || movie.name || movie.cleanName || 'Sem título';
  const year = movie.year || '';
  const size = movie.sizeFormatted || '';
  const quality = movie.quality || '1080p';
  const franchise = movie.franchise || null;

  const saved = getSavedProgress(movie);
  const progress = (movie.progress !== undefined && movie.progress !== null) ? movie.progress : (saved?.progress || null);
  const remainingMin = (saved?.duration && saved?.position && saved.duration > saved.position)
    ? Math.max(1, Math.round((saved.duration - saved.position) / 60))
    : null;

  return (
    <div
      ref={cardRef}
      className={`tv-card tv-local-card ${isFocused ? 'focused' : ''}`}
      onClick={onClick}
    >
      <div className="tv-card-poster-wrap">
        <img
          src={poster}
          alt={title}
          className="tv-card-poster"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://via.placeholder.com/300x450/1c1c1a/ffffff?text=Sem+Poster';
          }}
        />

        {franchise && (
          <div className="tv-card-badge-franchise" title={`Franquia ${franchise}`}>
            <span className="material-icons" style={{ fontSize: '12px' }}>collections_bookmark</span>
            <span>{franchise}</span>
          </div>
        )}

        {!franchise && (
          <div className="tv-card-badge-local">
            <span className="material-icons" style={{ fontSize: '11px', marginRight: '2px' }}>folder</span>
            <span>Local</span>
          </div>
        )}

        <div className="tv-card-badge-quality">
          {quality}
        </div>

        {/* Barra de Progresso quando há reprodução iniciada */}
        {progress !== null && progress > 0 && (
          <div className="tv-card-progress-bar">
            <div
              className="tv-card-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {/* Ícone de Play centralizado que surge quando em foco */}
        <div className={`tv-local-play-overlay ${isFocused ? 'visible' : ''}`}>
          <span className="material-icons" style={{ fontSize: '42px', color: '#FFFFFF' }}>play_circle_filled</span>
        </div>
      </div>

      <div className="tv-card-info">
        <h4 className="tv-card-title" title={title}>{title}</h4>
        <div className="tv-local-meta-row">
          {remainingMin ? (
            <span className="tv-card-meta" style={{ color: '#FAF9F5', fontWeight: 600 }}>Restam {remainingMin} min</span>
          ) : (
            year && <span className="tv-card-meta">{year}</span>
          )}
          {size && <span className="tv-meta-separator">•</span>}
          {size && <span className="tv-card-badge-size">{size}</span>}
        </div>
      </div>
    </div>
  );
}

export const LocalMovieCard = memo(LocalMovieCardComponent);
