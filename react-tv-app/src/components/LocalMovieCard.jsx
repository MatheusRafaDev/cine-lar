import React, { useEffect, useRef, useState, memo } from 'react';
import { getSavedProgress, resolveMoviePoster } from '../services/api';

function LocalMovieCardComponent({ movie, isFocused, onSelect, onClick, onContextMenu }) {
  const cardRef = useRef(null);
  const pointerTimerRef = useRef(null);
  const pointerLongPressedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [autoPoster, setAutoPoster] = useState('');
  const triedAutoPosterRef = useRef(false);

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

  const handlePointerDown = (e) => {
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    // Se for clique com o mouse (mouse pointer), não ativa o long-press de 450ms
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

        {(() => {
          const moviePath = String(movie.filePath || movie.videoPath || '').toLowerCase();
          const isLocalDisk = moviePath.startsWith('d:\\') || moviePath.startsWith('d:/') || moviePath.startsWith('c:\\') || moviePath.startsWith('c:/');
          const isDriveItem = !isLocalDisk && (moviePath.startsWith('g:\\') || moviePath.startsWith('g:/') || moviePath.includes('meu drive') || movie.isCloud || movie.isDrive || (movie.streamUrl && (movie.streamUrl.includes('drive.google.com') || movie.streamUrl.includes('drive.usercontent.google.com'))));

          if (isDriveItem) {
            return (
              <div className="tv-card-badge-local" style={{ background: '#4285F4', color: '#FFFFFF', fontWeight: 700, boxShadow: '0 2px 6px rgba(66,133,244,0.4)' }}>
                <span className="material-icons" style={{ fontSize: '11px', marginRight: '3px' }}>cloud</span>
                <span>Google Drive</span>
              </div>
            );
          }
          if (franchise) {
            return (
              <div className="tv-card-badge-franchise" title={`Franquia ${franchise}`}>
                <span className="material-icons" style={{ fontSize: '12px' }}>collections_bookmark</span>
                <span>{franchise}</span>
              </div>
            );
          }
          return (
            <div className="tv-card-badge-local" style={{ background: '#10B981', color: '#FFFFFF', fontWeight: 700, boxShadow: '0 2px 6px rgba(16,185,129,0.3)' }}>
              <span className="material-icons" style={{ fontSize: '11px', marginRight: '3px' }}>folder</span>
              <span>Local PC</span>
            </div>
          );
        })()}



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
