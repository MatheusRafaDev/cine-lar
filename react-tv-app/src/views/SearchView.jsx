import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchMovies, getTrendingMovies } from '../services/api';
import { MovieCard } from '../components/MovieCard';

export const KEYBOARD_ROWS = [
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
  searchActionRef
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef(null);

  // Carrega sugestões iniciais populares quando a tela abre
  useEffect(() => {
    getTrendingMovies().then(movies => {
      if (movies && movies.length > 0) {
        setResults(movies.slice(0, 18));
      }
    });
  }, []);

  const performSearch = useCallback(async (q) => {
    if (!q || !q.trim()) {
      const trending = await getTrendingMovies();
      setResults(trending.slice(0, 18));
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

      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        performSearch(next);
      }, 350);

      return next;
    });
  }, [performSearch]);

  // Vincula ref de ações para o controlador espacial no App.jsx
  useEffect(() => {
    if (searchActionRef) {
      searchActionRef.current = {
        pressKey: (r, c) => {
          const row = KEYBOARD_ROWS[r];
          if (row && row[c]) {
            handleKeyPress(row[c]);
          }
        },
        selectResult: (colIdx) => {
          if (results && results[colIdx]) {
            onSelectMovie(results[colIdx]);
          }
        },
        getResult: (colIdx) => {
          return results && results[colIdx] ? results[colIdx] : null;
        }
      };
    }
  }, [searchActionRef, handleKeyPress, results, onSelectMovie]);

  const isKeyboardFocused = activeZone === 'search-keyboard';
  const isResultsFocused = activeZone === 'search-results';

  return (
    <div className="tv-view-container tv-search-view" style={{ paddingTop: '90px' }}>
      <div className="tv-search-header-box">
        <h1 className="tv-page-title">Buscar Filmes e Séries</h1>

        <div className="tv-search-bar-wrap">
          <span className="material-icons" style={{ fontSize: '28px', color: 'var(--text-muted)' }}>search</span>
          <div className="tv-search-input-mock">
            {query ? (
              query
            ) : (
              <span style={{ color: 'var(--text-subtle)' }}>Digite o nome do filme usando o controle remoto...</span>
            )}
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
            <span className="tv-row-count">{results.length} títulos</span>
          </div>

          {results.length === 0 ? (
            <div className="tv-search-empty">
              Nenhum filme ou série encontrado para esta pesquisa.
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
export default SearchView;
