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
  const trackRef = useRef(null);

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

  // Suporte à roda do mouse no site: converte rolagem vertical (wheel) em horizontal do carrossel
  const handleWheel = useCallback((e) => {
    if (!trackRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      trackRef.current.scrollLeft += e.deltaY * 1.3;
    } else if (Math.abs(e.deltaX) > 0) {
      trackRef.current.scrollLeft += e.deltaX;
    }
  }, []);

  // Drag-to-Scroll suave com o mouse
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 || !trackRef.current) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeftRef.current = trackRef.current.scrollLeft;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current || !trackRef.current) return;
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.4;
    trackRef.current.scrollLeft = scrollLeftRef.current - walk;
  }, []);

  const handleMouseUpOrLeave = useCallback(() => {
    isMouseDownRef.current = false;
  }, []);

  // Navegação direta com botões de chevron para mouse/web
  const handleScrollLeft = useCallback(() => {
    if (!trackRef.current) return;
    const amount = trackRef.current.clientWidth || 800;
    trackRef.current.scrollBy({ left: -amount, behavior: 'smooth' });
  }, []);

  const handleScrollRight = useCallback(() => {
    if (!trackRef.current) return;
    const amount = trackRef.current.clientWidth || 800;
    trackRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  if (!movies || movies.length === 0) return null;

  return (
    <section ref={rowRef} className="tv-row-section">
      <div className="tv-row-title-box">
        <h2 className="tv-row-title">{title}</h2>
        <span className="tv-row-count">{movies.length} títulos</span>
      </div>

      <div className="tv-carousel-wrapper">
        <button
          type="button"
          className="tv-carousel-nav-btn left"
          onClick={handleScrollLeft}
          aria-label="Rolar para esquerda"
          tabIndex={-1}
        >
          <span className="material-icons">chevron_left</span>
        </button>

        <div
          ref={trackRef}
          className="tv-carousel-track"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
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

        <button
          type="button"
          className="tv-carousel-nav-btn right"
          onClick={handleScrollRight}
          aria-label="Rolar para direita"
          tabIndex={-1}
        >
          <span className="material-icons">chevron_right</span>
        </button>
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
