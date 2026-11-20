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
    <div className="tv-view-container tv-series-view" style={{ paddingTop: '76px' }}>
      <div className="tv-page-header">
        <h1 className="tv-page-title">Séries</h1>
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
