import React, { useEffect, useRef, useState, memo } from 'react';
import { getSavedProgress, resolveMoviePoster } from '../services/api';

function MovieCardComponent({ movie, isFocused, onSelect, onClick, onContextMenu }) {
  const cardRef = useRef(null);
  const pointerTimerRef = useRef(null);
  const pointerLongPressedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [autoPoster, setAutoPoster] = useState('');
  const triedAutoPosterRef = useRef(false);

  // Quando o card ganha foco, rola apenas o trilho horizontal via offsetLeft (Zero Reflow Engine)
  useEffect(() => {
    if (isFocused && cardRef.current) {
      const el = cardRef.current;
      const track = el.parentElement;
      if (track && track.classList.contains('tv-carousel-track')) {
        const cardWidth = el.offsetWidth || 214;
        const targetLeft = el.offsetLeft - (track.clientWidth / 2) + (cardWidth / 2);
        track.scrollLeft = Math.max(0, targetLeft);
      } else {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }, [isFocused]);

  useEffect(() => {
    setImgFailed(false);
    setAutoPoster('');
    triedAutoPosterRef.current = false;
  }, [movie?.poster, movie?.thumbnail, movie?.id]);

  useEffect(() => {
    const rawPoster = movie?.poster || movie?.thumbnail || '';
    if ((!rawPoster || imgFailed) && !triedAutoPosterRef.current && movie) {
      triedAutoPosterRef.current = true;
      let active = true;
      resolveMoviePoster(movie).then(found => {
        if (active && found && found !== rawPoster) {
          setAutoPoster(found);
          setImgFailed(false);
        }
      });
      return () => { active = false; };
    }
  }, [movie, imgFailed]);

  if (!movie) return null;

  const handleClick = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
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

  const poster = autoPoster || movie.poster || movie.thumbnail || '';
  const title = movie.title || movie.name || 'Sem título';
  const year = movie.year || (movie.releaseDate ? String(movie.releaseDate).slice(0, 4) : '');
  const rating = movie.imdbRating || movie.rating || null;
  const isLocal = Boolean(movie.isLocal || movie.filePath || movie.videoPath);
  const cardPath = String(movie.filePath || movie.videoPath || '').toLowerCase();
  const isLocalDisk = cardPath.startsWith('d:\\') || cardPath.startsWith('d:/') || cardPath.startsWith('c:\\') || cardPath.startsWith('c:/');
  const isDrive = !isLocalDisk && Boolean(
    movie.isCloud ||
    movie.isDrive ||
    movie.storageLocation === 'drive' ||
    cardPath.startsWith('g:\\') ||
    cardPath.startsWith('g:/') ||
    cardPath.includes('meu drive')
  );

  const saved = getSavedProgress(movie);
  const progress = (movie.progress !== undefined && movie.progress !== null) ? movie.progress : (saved?.progress || null);
  const remainingMin = (saved?.duration && saved?.position && saved.duration > saved.position)
    ? Math.max(1, Math.round((saved.duration - saved.position) / 60))
    : (movie.duration && movie.position && movie.duration > movie.position
      ? Math.max(1, Math.round((movie.duration - movie.position) / 60))
      : null);

  const handlePointerDown = (e) => {
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    // Se for clique com o mouse (mouse pointer), não ativa timer de long-press
    // No mouse, o clique com o botão direito (onContextMenu) já abre o menu rápido nativamente.
    if (e.pointerType === 'mouse') return;

    pointerLongPressedRef.current = false;
    if (!onContextMenu) return;
    pointerTimerRef.current = setTimeout(() => {
      pointerLongPressedRef.current = true;
      pointerTimerRef.current = null;
      onContextMenu(movie);
    }, 450);
  };

  const handlePointerMove = (e) => {
    if (
      Math.abs(e.clientX - dragStartPosRef.current.x) > 6 ||
      Math.abs(e.clientY - dragStartPosRef.current.y) > 6
    ) {
      isDraggingRef.current = true;
      if (pointerTimerRef.current) {
        clearTimeout(pointerTimerRef.current);
        pointerTimerRef.current = null;
      }
    }
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
      onClick={handleClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(movie);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
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

        {rating && (
          <div className="tv-card-rating">
            <span className="material-icons" style={{ fontSize: '11px' }}>star</span>
            <span>{typeof rating === 'number' ? rating.toFixed(1) : rating}</span>
          </div>
        )}

        {(movie.isSeries || movie.type === 'series') && (
          <div className="tv-card-badge-series">
            <span>SÉRIE</span>
          </div>
        )}

        {isLocal && (
          <div className={`tv-card-badge-local ${isDrive ? 'cloud' : ''}`}>
            <span className="material-icons" style={{ fontSize: '11px', marginRight: '2px' }}>
              {isDrive ? 'cloud' : 'folder'}
            </span>
            <span>{isDrive ? 'Drive' : 'PC'}</span>
          </div>
        )}

        {isFocused && (
          <div className="tv-card-play-overlay visible">
            <div className="tv-card-play-btn">
              <span className="material-icons" style={{ fontSize: '26px', color: '#FFFFFF' }}>play_arrow</span>
            </div>
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
            <span className="tv-card-remaining">
              <span className="material-icons" style={{ fontSize: '12px' }}>schedule</span>
              <span>Restam {remainingMin} min</span>
            </span>
          ) : (
            year || (isLocal ? 'Vídeo Pronto' : 'Filme')
          )}
        </span>
      </div>
    </div>
  );
}

export const MovieCard = memo(MovieCardComponent, (prevProps, nextProps) => {
  if (prevProps.isFocused !== nextProps.isFocused) return false;
  if (prevProps.movie !== nextProps.movie) {
    if (prevProps.movie?.id !== nextProps.movie?.id) return false;
    if (prevProps.movie?.progress !== nextProps.movie?.progress) return false;
    if (prevProps.movie?.poster !== nextProps.movie?.poster) return false;
    if (prevProps.movie?.title !== nextProps.movie?.title) return false;
  }
  if (prevProps.onSelect !== nextProps.onSelect) return false;
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onContextMenu !== nextProps.onContextMenu) return false;
  return true;
});
