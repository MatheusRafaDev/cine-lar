import React, { useEffect, useRef, useState, memo } from 'react';
import { getSavedProgress } from '../services/api';

function LocalMovieCardComponent({ movie, isFocused, onSelect, onClick, onContextMenu }) {
  const cardRef = useRef(null);
  const pointerTimerRef = useRef(null);
  const pointerLongPressedRef = useRef(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Auto-scroll vertical leve sem reflow de scrollIntoView
  useEffect(() => {
    if (isFocused && cardRef.current) {
      const el = cardRef.current;
      const rect = el.getBoundingClientRect();
      if (rect.top < 90 || rect.bottom > window.innerHeight - 40) {
        const desiredTop = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        window.scrollTo(0, Math.max(0, desiredTop));
      }
    }
  }, [isFocused]);

  useEffect(() => {
    setImgFailed(false);
  }, [movie?.poster, movie?.thumbnail, movie?.id]);

  if (!movie) return null;

  const handleClick = (e) => {
    if (pointerLongPressedRef.current) {
      pointerLongPressedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onSelect) {
      onSelect(movie);
    } else if (onClick) {
      onClick(e);
    }
  };

  const poster = movie.poster || movie.thumbnail || '';
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

  const handlePointerDown = () => {
    pointerLongPressedRef.current = false;
    if (!onContextMenu) return;
    pointerTimerRef.current = setTimeout(() => {
      pointerLongPressedRef.current = true;
      pointerTimerRef.current = null;
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
      className={`tv-card tv-local-card ${isFocused ? 'focused' : ''}`}
      onClick={handleClick}
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
            alt=""
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

        {/* Ícone de Play centralizado que surge apenas quando em foco */}
        {isFocused && (
          <div className="tv-card-play-overlay visible">
            <div className="tv-card-play-btn">
              <span className="material-icons" style={{ fontSize: '28px', color: '#FFFFFF' }}>play_arrow</span>
            </div>
          </div>
        )}
      </div>

      <div className="tv-card-info">
        <h4 className="tv-card-title" title={title}>{title}</h4>
        <div className="tv-local-meta-row">
          {remainingMin ? (
            <span className="tv-card-meta tv-card-remaining" style={{ color: '#FAF9F5', fontWeight: 600 }}>
              <span className="material-icons" style={{ fontSize: '12px' }}>schedule</span>
              <span>Restam {remainingMin} min</span>
            </span>
          ) : year ? (
            <span className="tv-card-meta">{year}</span>
          ) : (
            <span className="tv-card-meta">Local</span>
          )}
          {size && <span className="tv-meta-separator">•</span>}
          {size && <span className="tv-card-badge-size">{size}</span>}
        </div>
      </div>
    </div>
  );
}

export const LocalMovieCard = memo(LocalMovieCardComponent, (prevProps, nextProps) => {
  if (prevProps.isFocused !== nextProps.isFocused) return false;
  if (prevProps.movie !== nextProps.movie) {
    if (prevProps.movie?.id !== nextProps.movie?.id) return false;
    if (prevProps.movie?.progress !== nextProps.movie?.progress) return false;
    if (prevProps.movie?.poster !== nextProps.movie?.poster) return false;
    if (prevProps.movie?.sizeFormatted !== nextProps.movie?.sizeFormatted) return false;
  }
  if (prevProps.onSelect !== nextProps.onSelect) return false;
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onContextMenu !== nextProps.onContextMenu) return false;
  return true;
});
