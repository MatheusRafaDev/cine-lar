import React, { memo } from 'react';
import { motion } from 'framer-motion';

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

      <motion.div
        key={movie.id || movie.title || 'hero'}
        className="tv-hero-content"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
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
      </motion.div>
    </section>
  );
}

export const HeroBanner = memo(HeroBannerComponent);
