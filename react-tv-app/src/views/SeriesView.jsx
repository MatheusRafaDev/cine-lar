import React from 'react';
import { CarouselRow } from '../components/CarouselRow';

export function SeriesView({
  genreSections = [],
  activeZone,
  rowIndex,
  colIndex,
  onSelectSeries
}) {
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-series-view" style={{ paddingTop: '90px' }}>
      <div className="tv-page-header">
        <h1 className="tv-page-title">Catálogo Completo de Séries</h1>
        <p className="tv-page-subtitle">Explore temporadas completas, episódios e lançamentos sob demanda</p>
      </div>

      <div className="tv-sections-container">
        {genreSections.map((section, idx) => {
          const isCurrentRowFocused = isRowsFocused && rowIndex === idx;
          return (
            <CarouselRow
              key={section.id || idx}
              title={section.title}
              movies={section.movies}
              isRowFocused={isCurrentRowFocused}
              focusedColIndex={colIndex}
              onSelectMovie={onSelectSeries}
            />
          );
        })}
      </div>
    </div>
  );
}
export default SeriesView;
