import React, { useEffect, useRef, useCallback, memo } from 'react';
import { MovieCard } from './MovieCard';

function CarouselRowComponent({
  title,
  movies = [],
  isRowFocused,
  focusedColIndex,
  onSelectMovie,
  onContextMenuMovie
}) {
  const rowRef = useRef(null);

  // Callbacks estaveis: os pais passam funcoes inline (nova identidade a cada render),
  // o que forcava TODOS os cards da linha focada a re-renderizar a cada toque no controle.
  const callbacksRef = useRef({ onSelectMovie, onContextMenuMovie });
  callbacksRef.current = { onSelectMovie, onContextMenuMovie };
  const stableOnSelect = useCallback((mov) => callbacksRef.current.onSelectMovie?.(mov), []);
  const stableOnContextMenu = useCallback((mov) => callbacksRef.current.onContextMenuMovie?.(mov), []);

  // Quando a linha ganha foco, centraliza verticalmente na tela da TV sem reflow pesado de scrollIntoView
  useEffect(() => {
    if (isRowFocused && rowRef.current) {
      const el = rowRef.current;
      const desiredTop = el.offsetTop - (window.innerHeight / 2) + (el.offsetHeight / 2);
      window.scrollTo(0, Math.max(0, desiredTop));
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
              onSelect={stableOnSelect}
              onContextMenu={onContextMenuMovie ? stableOnContextMenu : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

// Memorizacao de alta performance: linhas inativas nao sao recalculadas quando o usuario navega pelo controle
export const CarouselRow = memo(CarouselRowComponent, (prevProps, nextProps) => {
  if (!prevProps.isRowFocused && !nextProps.isRowFocused) {
    return prevProps.movies === nextProps.movies && prevProps.title === nextProps.title;
  }
  if (prevProps.isRowFocused !== nextProps.isRowFocused) {
    return false;
  }
  if (prevProps.focusedColIndex !== nextProps.focusedColIndex) {
    return false;
  }
  return prevProps.movies === nextProps.movies && prevProps.title === nextProps.title;
});
