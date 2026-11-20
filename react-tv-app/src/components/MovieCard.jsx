import React, { useEffect, useRef, memo } from 'react';
import { getSavedProgress } from '../services/api';

function MovieCardComponent({ movie, isFocused, onClick, onContextMenu }) {
  const cardRef = useRef(null);
  const pointerTimerRef = useRef(null);

  // Quando o card ganha foco, garante que o scroll horizontal do carrossel o mantenha visível sem atraso
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'auto',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [isFocused]);

  if (!movie) return null;

  const poster = movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1c1c1a/ffffff?text=Sem+Poster';
  const title = movie.title || movie.name || 'Sem título';
  const year = movie.year || (movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '');
  const rating = movie.imdbRating || movie.rating || null;
  const isLocal = Boolean(movie.isLocal || movie.filePath || movie.videoPath);

  const saved = getSavedProgress(movie);
  const progress = (movie.progress !== undefined && movie.progress !== null) ? movie.progress : (saved?.progress || null);
  const remainingMin = (saved?.duration && saved?.position && saved.duration > saved.position)
    ? Math.max(1, Math.round((saved.duration - saved.position) / 60))
    : (movie.duration && movie.position && movie.duration > movie.position
      ? Math.max(1, Math.round((movie.duration - movie.position) / 60))
      : null);

  const handlePointerDown = () => {
    if (!onContextMenu) return;
    pointerTimerRef.current = setTimeout(() => {
      onContextMenu(movie);
    }, 450);
  };

  const handlePointerClear = () => {
    if (pointerTimerRef.current) {
      clearTimeout(pointerTimerRef.current);
      pointerTimerRef.current = null;
    }
  };

  return (
    <div
      ref={cardRef}
      className={`tv-card ${isFocused ? 'focused' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(movie);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerClear}
      onPointerLeave={handlePointerClear}
      onPointerCancel={handlePointerClear}
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

        {rating && (
          <div className="tv-card-rating">
            <span className="material-icons" style={{ fontSize: '11px' }}>star</span>
            <span>{rating}</span>
          </div>
        )}

        {isLocal && (
          <div className="tv-card-badge-local">
            <span className="material-icons" style={{ fontSize: '11px', marginRight: '2px' }}>folder</span>
            <span>Local</span>
          </div>
        )}

        {progress !== null && progress > 0 && (
          <div className="tv-card-progress-bar">
            <div
              className="tv-card-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>

      <div className="tv-card-info">
        <h4 className="tv-card-title">{title}</h4>
        <span className="tv-card-meta">
          {remainingMin ? (
            <span style={{ color: '#FAF9F5', fontWeight: 600 }}>Restam {remainingMin} min</span>
          ) : (
            year || (isLocal ? 'Vídeo Pronto' : 'Filme')
          )}
        </span>
      </div>
    </div>
  );
}

export const MovieCard = memo(MovieCardComponent);
