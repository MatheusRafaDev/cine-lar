import React, { useEffect, useRef } from 'react';
import { MovieCard } from './MovieCard';

export function CarouselRow({
  title,
  movies = [],
  isRowFocused,
  focusedColIndex,
  onSelectMovie
}) {
  const rowRef = useRef(null);

  // Quando a linha ganha foco, centraliza verticalmente na tela da TV
  useEffect(() => {
    if (isRowFocused && rowRef.current) {
      rowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [isRowFocused]);

  if (!movies || movies.length === 0) return null;

  return (
    <section ref={rowRef} className="tv-row-section">
      <div className="tv-row-title-box">
        <h2 className="tv-row-title">{title}</h2>
        <span className="tv-row-count">{movies.length} títulos</span>
      </div>

      <div className="tv-carousel-track">
        {movies.map((movie, idx) => {
          const isCardFocused = isRowFocused && focusedColIndex === idx;
          return (
            <MovieCard
              key={movie.id || movie.imdbId || `${title}-${idx}`}
              movie={movie}
              isFocused={isCardFocused}
              onClick={() => onSelectMovie(movie)}
            />
          );
        })}
      </div>
    </section>
  );
}
