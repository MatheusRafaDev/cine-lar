import React from 'react';
import { MovieCard } from '../components/MovieCard';

export function FavoritesView({
  favorites = [],
  gridRows = [],
  activeZone = 'rows',
  rowIndex = 0,
  colIndex = 0,
  onSelectMovie = () => {},
  onContextMenuMovie = () => {}
}) {
  const isRowsFocused = activeZone === 'rows';
  const count = favorites.length;

  return (
    <div className="tv-view-container tv-favorites-view" style={{ paddingTop: '76px', paddingLeft: '48px', paddingRight: '48px', paddingBottom: '80px' }}>
      {/* 1. Cabeçalho da Aba Favoritos */}
      <div className="tv-page-header" style={{ marginBottom: '16px' }}>
        <div className="tv-page-header-row">
          <h1 className="tv-page-title">Favoritos</h1>
          <span className="tv-badge-pill tv-badge-fav">
            <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>bookmark</span>
            <span>{count} {count === 1 ? 'título' : 'títulos'}</span>
          </span>
        </div>
      </div>

      {/* 2. Conteúdo: Grade Full-Page Vertical ou Estado Vazio */}
      {count === 0 ? (
        <div className="tv-empty-container">
          <span className="material-icons" style={{ fontSize: '64px', color: 'var(--text-subtle)' }}>bookmark_border</span>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Sua lista de favoritos está vazia</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Navegue pelas abas Início, Filmes, Séries ou Buscar e selecione "Minha Lista" nos detalhes para salvar títulos aqui.
          </p>
        </div>
      ) : (
        <div className="tv-fullpage-grid">
          {gridRows.map((row, rIdx) => (
            row.movies.map((movie, cIdx) => {
              const isItemFocused = isRowsFocused && rowIndex === rIdx && colIndex === cIdx;
              return (
                <MovieCard
                  key={movie.id || `${rIdx}-${cIdx}`}
                  movie={movie}
                  isFocused={isItemFocused}
                  onSelect={onSelectMovie}
                  onContextMenu={onContextMenuMovie}
                />
              );
            })
          ))}
        </div>
      )}
    </div>
  );
}
