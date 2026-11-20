import React, { memo } from 'react';

function HeroBannerComponent({ movie, isZoneFocused, focusedIndex, onPlay, onInfo, onContextMenu }) {
  if (!movie) return null;

  const backdropUrl = movie.backdrop || movie.poster || '';
  const isPlayFocused = isZoneFocused && focusedIndex === 0;
  const isInfoFocused = isZoneFocused && focusedIndex === 1;

  return (
    <section
      className="tv-hero-banner"
      style={{ backgroundImage: `url(${backdropUrl})` }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(movie);
        }
      }}
    >
      <div className="tv-hero-gradient" />

      <div className="tv-hero-content">
        <div className="tv-hero-badges">
          {movie.imdbRating && (
            <span className="tv-badge-pill tv-badge-imdb">
              IMDb {movie.imdbRating}
            </span>
          )}
          {movie.year && (
            <span className="tv-badge-pill">
              {movie.year}
            </span>
          )}
          {movie.genres && movie.genres.length > 0 && (
            <span className="tv-badge-pill">
              {Array.isArray(movie.genres) ? movie.genres.slice(0, 2).join(' • ') : movie.genres}
            </span>
          )}
        </div>

        <h1 className="tv-hero-title">{movie.title}</h1>

        {movie.synopsis && (
          <p className="tv-hero-synopsis">{movie.synopsis}</p>
        )}

        <div className="tv-hero-actions">
          <button
            type="button"
            className={`tv-btn tv-btn-primary ${isPlayFocused ? 'focused' : ''}`}
            onClick={onPlay}
          >
            <span className="material-icons">play_arrow</span>
            <span>Assistir Agora</span>
          </button>

          <button
            type="button"
            className={`tv-btn tv-btn-secondary ${isInfoFocused ? 'focused' : ''}`}
            onClick={onInfo}
          >
            <span className="material-icons">info</span>
            <span>Mais Informações</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export const HeroBanner = memo(HeroBannerComponent);
