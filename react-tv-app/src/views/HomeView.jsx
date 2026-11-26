import React from 'react';
import { HeroBanner } from '../components/HeroBanner';
import { CarouselRow } from '../components/CarouselRow';
import { EmptyCatalogPanel, ServerStatusPanel } from '../components/StatusStatePanel';

export function HomeView({
  heroMovie,
  sections = [],
  activeZone,
  heroIndex,
  rowIndex,
  colIndex,
  onSelectMovie,
  onContextMenuMovie,
  onSeeMore,
  onPlayHero,
  onInfoHero,
  isLoading = false,
  serverStatus = 'checking',
  onRetryConnection
}) {
  const isHeroFocused = activeZone === 'hero';
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-home-view" style={!heroMovie ? { paddingTop: '76px' } : undefined}>
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
        {!isLoading && !heroMovie && sections.length === 0 && serverStatus !== 'online' && (
          <ServerStatusPanel
            status={serverStatus}
            title="Servidor não encontrado"
            onRetry={onRetryConnection}
            isFocused={isRowsFocused && rowIndex === 0}
          />
        )}
        {!isLoading && !heroMovie && sections.length === 0 && serverStatus === 'online' && (
          <EmptyCatalogPanel
            title="Sua biblioteca está vazia"
            message="O servidor está conectado. Navegue por Filmes e Séries para explorar o catálogo."
          />
        )}
        {sections.map((section, idx) => {
          const isCurrentRowFocused = isRowsFocused && rowIndex === idx;
          const isContinue = section.id === 'continue-watching';
          const isSeries = Boolean(section.isSeries || section.id === 'series-popular' || String(section.id).startsWith('series'));
          return (
            <CarouselRow
              key={section.id || idx}
              sectionId={section.id}
              title={section.title}
              movies={section.movies}
              isRowFocused={isCurrentRowFocused}
              focusedColIndex={colIndex}
              onSelectMovie={(mov) => onSelectMovie?.(mov, isContinue)}
              onContextMenuMovie={(mov) => onContextMenuMovie?.(mov, isContinue)}
              onSeeMore={onSeeMore}
              hasSeeMore={!isContinue}
              isSeries={isSeries}
            />
          );
        })}
      </div>
    </div>
  );
}
