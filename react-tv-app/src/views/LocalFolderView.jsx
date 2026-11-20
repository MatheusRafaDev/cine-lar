import React from 'react';
import { CarouselRow } from '../components/CarouselRow';

export function LocalFolderView({
  localSections = [],
  activeZone,
  rowIndex,
  colIndex,
  onSelectMovie
}) {
  const isRowsFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-local-view" style={{ paddingTop: '90px' }}>
      <div className="tv-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h1 className="tv-page-title">Minha Pasta Local</h1>
          <span className="tv-badge-pill" style={{ background: '#22c55e', color: '#000', fontWeight: 800 }}>
            D:\Filmes
          </span>
        </div>
        <p className="tv-page-subtitle">
          Filmes armazenados no seu computador. Reprodução instantânea direta sem consumo de internet.
        </p>
      </div>

      {localSections.length === 0 ? (
        <div className="tv-empty-container">
          <span className="material-icons" style={{ fontSize: '64px', color: 'var(--text-subtle)' }}>folder_off</span>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Nenhum filme local encontrado em D:\Filmes</h2>
          <p style={{ color: 'var(--text-muted)' }}>Adicione arquivos .mkv ou .mp4 à pasta ou baixe pela plataforma.</p>
        </div>
      ) : (
        <div className="tv-sections-container">
          {localSections.map((section, idx) => {
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
      )}
    </div>
  );
}
