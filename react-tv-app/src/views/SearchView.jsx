import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchMovies } from '../services/api';
import { MovieCard } from '../components/MovieCard';

const KEYBOARD_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', '1', '2', '3'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N', '4', '5', '6'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U', '7', '8', '9'],
  ['V', 'W', 'X', 'Y', 'Z', 'ESPAÇO', 'APAGAR', 'LIMPAR', '0']
];

export function SearchView({
  activeZone,
  searchRowIndex,
  searchColIndex,
  resultsColIndex,
  onSelectMovie,
  onQueryChange,
  currentQuery = ''
}) {
  const [query, setQuery] = useState(currentQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef(null);

  const performSearch = useCallback(async (q) => {
    if (!q || !q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await searchMovies(q);
      setResults(res);
    } catch (_) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyPress = useCallback((k) => {
    setQuery(prev => {
      let next = prev;
      if (k === 'ESPAÇO') {
        next = prev + ' ';
      } else if (k === 'APAGAR') {
        next = prev.slice(0, -1);
      } else if (k === 'LIMPAR') {
        next = '';
      } else {
        next = prev + k;
      }
      if (onQueryChange) onQueryChange(next);

      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(next);
      }, 350);

      return next;
    });
  }, [onQueryChange, performSearch]);

  const isKeyboardFocused = activeZone === 'search-keyboard';
  const isResultsFocused = activeZone === 'search-results';

  return (
    <div className="tv-view-container tv-search-view" style={{ paddingTop: '90px' }}>
      <div className="tv-search-header-box">
        <h1 className="tv-page-title">Buscar Filmes</h1>

        <div className="tv-search-bar-wrap">
          <span className="material-icons" style={{ fontSize: '28px', color: 'var(--text-muted)' }}>search</span>
          <div className="tv-search-input-mock">
            {query || <span style={{ color: 'var(--text-subtle)' }}>Digite o nome do filme usando o controle...</span>}
          </div>
          {loading && <div className="tv-search-spinner" />}
        </div>
      </div>

      <div className="tv-search-body">
        {/* Teclado Virtual 10-Foot UI */}
        <div className="tv-keyboard-container">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="tv-keyboard-row">
              {row.map((k, cIdx) => {
                const isKeyFocused = isKeyboardFocused && searchRowIndex === rIdx && searchColIndex === cIdx;
                const isAction = k === 'ESPAÇO' || k === 'APAGAR' || k === 'LIMPAR';
                return (
                  <button
                    key={k}
                    type="button"
                    className={`tv-key-btn ${isAction ? 'tv-key-action' : ''} ${isKeyFocused ? 'focused' : ''}`}
                    onClick={() => handleKeyPress(k)}
                  >
                    {k === 'APAGAR' ? (
                      <span className="material-icons" style={{ fontSize: '18px' }}>backspace</span>
                    ) : (
                      k
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Resultados da Busca */}
        <div className="tv-search-results-section">
          <div className="tv-row-title-box" style={{ marginBottom: '16px' }}>
            <h2 className="tv-row-title">
              {query ? `Resultados para "${query}"` : 'Sugestões Populares'}
            </h2>
            <span className="tv-row-count">{results.length} filmes</span>
          </div>

          {results.length === 0 ? (
            <div className="tv-search-empty">
              {query ? 'Nenhum filme encontrado para a pesquisa.' : 'Comece a digitar pelo controle para ver resultados em tempo real.'}
            </div>
          ) : (
            <div className="tv-search-results-grid">
              {results.map((movie, idx) => {
                const isCardFocused = isResultsFocused && resultsColIndex === idx;
                return (
                  <MovieCard
                    key={movie.id || movie.imdbId || idx}
                    movie={movie}
                    isFocused={isCardFocused}
                    onClick={() => onSelectMovie(movie)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
