import React from 'react';
import { CarouselRow } from '../components/CarouselRow';

export function MoviesView({
  genreSections = [],
  activeZone,
  rowIndex,
  colIndex,
  onSelectMovie
}) {
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-movies-view" style={{ paddingTop: '90px' }}>
      <div className="tv-page-header">
        <h1 className="tv-page-title">Catálogo Completo de Filmes</h1>
        <p className="tv-page-subtitle">Navegue por gêneros e explore centenas de títulos sob demanda</p>
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
              onSelectMovie={onSelectMovie}
            />
          );
        })}
      </div>
    </div>
  );
}
