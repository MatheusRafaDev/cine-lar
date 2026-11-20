import React from 'react';
import { MovieCard } from '../components/MovieCard';

export function FavoritesView({
  favorites = [],
  gridRows = [],
  activeZone = 'rows',
  rowIndex = 0,
  colIndex = 0,
  onSelectMovie = () => {}
}) {
  const isRowsFocused = activeZone === 'rows';
  const count = favorites.length;

  return (
    <div className="tv-view-container tv-favorites-view" style={{ paddingTop: '90px', paddingLeft: '48px', paddingRight: '48px', paddingBottom: '80px' }}>
      {/* 1. Cabeçalho da Aba Favoritos */}
      <div className="tv-page-header" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h1 className="tv-page-title">Meus Favoritos</h1>
          <span className="tv-badge-pill" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 700 }}>
            <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>bookmark</span>
            <span>{count} {count === 1 ? 'título salvo' : 'títulos salvos'}</span>
          </span>
        </div>
        <p className="tv-page-subtitle">
          Sua lista pessoal com todos os filmes e séries marcados para assistir.
        </p>
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
                  onClick={() => onSelectMovie(movie)}
                />
              );
            })
          ))}
        </div>
      )}
    </div>
  );
}
