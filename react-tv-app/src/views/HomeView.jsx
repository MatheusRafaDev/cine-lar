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
  onInfoHero
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
