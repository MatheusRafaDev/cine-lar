import React from 'react';
import { HeroBanner } from '../components/HeroBanner';
import { CarouselRow } from '../components/CarouselRow';

export function HomeView({
  heroMovie,
  sections = [],
  activeZone,
  heroIndex,
  rowIndex,
  colIndex,
  onSelectMovie,
  onContextMenuMovie,
  onPlayHero,
  onInfoHero,
  isLoading = false,
  serverStatus = 'checking'
}) {
  const isHeroFocused = activeZone === 'hero';
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-home-view">
      {heroMovie && (
        <HeroBanner
          movie={heroMovie}
          isZoneFocused={isHeroFocused}
          focusedIndex={heroIndex}
          onPlay={onPlayHero}
          onInfo={onInfoHero}
          onContextMenu={onContextMenuMovie}
        />
      )}

      <div className="tv-sections-container">
        {isLoading && !heroMovie && sections.length === 0 && (
          <div className="tv-home-feedback" role="status">
            <span className="tv-home-spinner" />
            <strong>Preparando sua sessão</strong>
            <span>Carregando catálogo e biblioteca local…</span>
          </div>
        )}
        {!isLoading && !heroMovie && sections.length === 0 && serverStatus === 'offline' && (
          <div className="tv-home-feedback offline" role="alert">
            <span className="material-icons">wifi_off</span>
            <strong>Servidor não encontrado</strong>
            <span>Verifique se o serviço Cinelar está ligado e se a TV está na mesma rede.</span>
          </div>
        )}
        {sections.map((section, idx) => {
          const isCurrentRowFocused = isRowsFocused && rowIndex === idx;
          const isContinue = section.id === 'continue-watching';
          return (
            <CarouselRow
              key={section.id || idx}
              title={section.title}
              movies={section.movies}
              isRowFocused={isCurrentRowFocused}
              focusedColIndex={colIndex}
              onSelectMovie={(mov) => onSelectMovie?.(mov, isContinue)}
              onContextMenuMovie={(mov) => onContextMenuMovie?.(mov, isContinue)}
            />
          );
        })}
      </div>
    </div>
  );
}
