import React, { useEffect, useRef } from 'react';

export function MovieCard({ movie, isFocused, onClick }) {
  const cardRef = useRef(null);

  // Quando o card ganha foco, garante que o scroll horizontal do carrossel o mantenha visível
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
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
  const progress = movie.progress || null;

  return (
    <div
      ref={cardRef}
      className={`tv-card ${isFocused ? 'focused' : ''}`}
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
        <span className="tv-card-meta">{year || (isLocal ? 'Vídeo Pronto' : 'Filme')}</span>
      </div>
    </div>
  );
}
