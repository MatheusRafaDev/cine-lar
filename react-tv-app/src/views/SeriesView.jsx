import React from 'react';
import { CarouselRow } from '../components/CarouselRow';
import { EmptyCatalogPanel, ServerStatusPanel } from '../components/StatusStatePanel';

export function SeriesView({
  genreSections = [],
  activeZone,
  rowIndex,
  colIndex,
  onSelectSeries,
  onContextMenuMovie,
  onSeeMore,
  serverStatus = 'checking',
  isLoading = false,
  onRetryConnection
}) {
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-series-view" style={{ paddingTop: '76px' }}>
      <div className="tv-page-header">
        <h1 className="tv-page-title">Séries</h1>
      </div>

      <div className="tv-sections-container">
        {genreSections.length === 0 && isLoading && (
          <div className="tv-home-feedback" role="status" aria-live="polite">
            <span className="tv-home-spinner" />
            <strong>Carregando séries</strong>
            <span>Buscando títulos disponíveis no servidor…</span>
          </div>
        )}
        {genreSections.length === 0 && !isLoading && serverStatus !== 'online' && (
          <ServerStatusPanel
            status={serverStatus}
            title="Não foi possível carregar as séries"
            onRetry={onRetryConnection}
            isFocused={isRowsFocused && rowIndex === 0}
          />
        )}
        {genreSections.length === 0 && !isLoading && serverStatus === 'online' && (
          <EmptyCatalogPanel
            title="Nenhuma série disponível"
            message="O servidor está conectado, mas não encontrou séries no catálogo. Tente atualizar o catálogo no computador."
          />
        )}
        {genreSections.map((section, idx) => {
          const isCurrentRowFocused = isRowsFocused && rowIndex === idx;
          return (
            <CarouselRow
              key={section.id || idx}
              sectionId={section.id}
              title={section.title}
              movies={section.movies}
              isRowFocused={isCurrentRowFocused}
              focusedColIndex={colIndex}
              onSelectMovie={onSelectSeries}
              onContextMenuMovie={onContextMenuMovie}
              onSeeMore={onSeeMore}
              hasSeeMore={true}
              isSeries={true}
            />
          );
        })}
      </div>
    </div>
  );
}
export default SeriesView;
