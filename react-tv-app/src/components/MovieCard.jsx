import React, { useEffect, useRef, useState, memo } from 'react';
import { getSavedProgress } from '../services/api';

function MovieCardComponent({ movie, isFocused, onClick, onContextMenu }) {
  const cardRef = useRef(null);
  const pointerTimerRef = useRef(null);
  const [imgFailed, setImgFailed] = useState(false);

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

  useEffect(() => {
    setImgFailed(false);
  }, [movie?.poster, movie?.thumbnail, movie?.id]);

  if (!movie) return null;

  const poster = movie.poster || movie.thumbnail || '';
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
        {poster && !imgFailed ? (
          <img
            src={poster}
            alt={title}
            className="tv-card-poster"
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="tv-card-poster-fallback">
            <span className="material-icons" style={{ fontSize: '42px', color: 'rgba(255, 255, 255, 0.25)' }}>
              movie
            </span>
            <span className="tv-card-fallback-title">{title}</span>
          </div>
        )}

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
