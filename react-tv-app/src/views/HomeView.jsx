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
        />
      )}

      <div className="tv-sections-container">
        {sections.map((section, idx) => {
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
