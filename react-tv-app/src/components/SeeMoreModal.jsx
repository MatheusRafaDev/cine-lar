import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MovieCard } from './MovieCard';
import { getMovies, getSeries, getTrendingMovies } from '../services/api';

export function SeeMoreModal({
  section,
  isOpen,
  onClose,
  onLoadMoreToRow,
  onSelectMovie,
  onContextMenuMovie
}) {
  const [viewMode, setViewMode] = useState('choice'); // 'choice' | 'grid'
  const [choiceIndex, setChoiceIndex] = useState(0); // 0: Carregar no Carrossel, 1: Ver em Grade, 2: Voltar
  const [gridMovies, setGridMovies] = useState([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [gridRowIndex, setGridRowIndex] = useState(0);
  const [gridColIndex, setGridColIndex] = useState(0);
  const COL_COUNT = 8;

  // Carrega os filmes para a visualização em grade
  useEffect(() => {
    if (!section || !isOpen) return;
    setViewMode('choice');
    setChoiceIndex(0);
    setGridRowIndex(0);
    setGridColIndex(0);

    const initial = section.movies || [];
    setGridMovies(initial);

    // Pré-busca mais títulos da categoria para quando abrir a grade
    const isSeries = Boolean(section.isSeries || section.id === 'series-popular' || String(section.id).startsWith('series'));
    setLoadingGrid(true);

    if (section.id === 'trending') {
      getTrendingMovies().then(movies => {
        if (movies && movies.length > 0) {
          setGridMovies(movies);
        }
      }).catch(() => {}).finally(() => setLoadingGrid(false));
    } else if (isSeries) {
      getSeries({ genre: section.id, limit: 100 }).then(series => {
        if (series && series.length > 0) {
          setGridMovies(series);
        }
      }).catch(() => {}).finally(() => setLoadingGrid(false));
    } else {
      getMovies({ genre: section.id, limit: 100 }).then(movies => {
        if (movies && movies.length > 0) {
          setGridMovies(movies);
        }
      }).catch(() => {}).finally(() => setLoadingGrid(false));
    }
  }, [section, isOpen]);

  // Navegação por controle remoto na visualização de Escolha e na Grade
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const code = e.keyCode || e.which || 0;
      const key = e.key || '';

      const isBack = code === 10009 || code === 27 || code === 8 || key === 'Back' || key === 'Escape';
      const isEnter = code === 13 || key === 'Enter';
      const isLeft = code === 37 || key === 'ArrowLeft';
      const isRight = code === 39 || key === 'ArrowRight';
      const isUp = code === 38 || key === 'ArrowUp';
      const isDown = code === 40 || key === 'ArrowDown';

      if (isBack) {
        e.preventDefault();
        e.stopPropagation();
        if (viewMode === 'grid') {
          setViewMode('choice');
        } else {
          onClose?.();
        }
        return;
      }

      // Modo 1: Escolha rápida (Carrossel vs Grade)
      if (viewMode === 'choice') {
        if (isUp) {
          e.preventDefault();
          e.stopPropagation();
          setChoiceIndex(i => Math.max(0, i - 1));
          return;
        }
        if (isDown) {
          e.preventDefault();
          e.stopPropagation();
          setChoiceIndex(i => Math.min(2, i + 1));
          return;
        }
        if (isEnter) {
          e.preventDefault();
          e.stopPropagation();
          if (choiceIndex === 0) {
            // Carregar mais no carrossel
            onLoadMoreToRow?.(section);
            onClose?.();
          } else if (choiceIndex === 1) {
            // Abrir em grade completa
            setViewMode('grid');
            setGridRowIndex(0);
            setGridColIndex(0);
          } else {
            // Voltar
            onClose?.();
          }
          return;
        }
      }

      // Modo 2: Grade completa de filmes (8 colunas)
      if (viewMode === 'grid') {
        const totalItems = gridMovies.length;
        const totalRows = Math.ceil(totalItems / COL_COUNT);

        if (isLeft) {
          e.preventDefault();
          e.stopPropagation();
          setGridColIndex(c => Math.max(0, c - 1));
          return;
        }
        if (isRight) {
          e.preventDefault();
          e.stopPropagation();
          setGridColIndex(c => {
            const next = c + 1;
            const currentItemIndex = gridRowIndex * COL_COUNT + next;
            return currentItemIndex < totalItems ? Math.min(COL_COUNT - 1, next) : c;
          });
          return;
        }
        if (isUp) {
          e.preventDefault();
          e.stopPropagation();
          setGridRowIndex(r => Math.max(0, r - 1));
          return;
        }
        if (isDown) {
          e.preventDefault();
          e.stopPropagation();
          setGridRowIndex(r => {
            const next = r + 1;
            const targetItemIndex = next * COL_COUNT + gridColIndex;
            return targetItemIndex < totalItems ? next : (next * COL_COUNT < totalItems ? next : r);
          });
          return;
        }
        if (isEnter) {
          e.preventDefault();
          e.stopPropagation();
          const targetIndex = gridRowIndex * COL_COUNT + gridColIndex;
          if (gridMovies[targetIndex]) {
            onSelectMovie?.(gridMovies[targetIndex]);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, viewMode, choiceIndex, gridRowIndex, gridColIndex, gridMovies, section, onLoadMoreToRow, onClose, onSelectMovie]);

  if (!isOpen || !section) return null;

  const totalGridRows = Math.ceil(gridMovies.length / COL_COUNT);

  return (
    <AnimatePresence>
      <div className="tv-see-more-backdrop" onClick={onClose}>
        {viewMode === 'choice' ? (
          <motion.div
            className="tv-see-more-dialog"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
          >
            {/* Cabeçalho do Diálogo */}
            <div className="tv-see-more-dialog-header">
              <div className="tv-see-more-dialog-icon">
                <span className="material-icons">movie_filter</span>
              </div>
              <div>
                <span className="tv-badge-pill" style={{ background: 'rgba(229, 160, 13, 0.25)', color: '#FBBF24', marginBottom: '6px' }}>
                  Fim da Seção
                </span>
                <h2 className="tv-see-more-dialog-title">{section.title}</h2>
                <p className="tv-see-more-dialog-subtitle">
                  Como você deseja explorar mais títulos desta categoria?
                </p>
              </div>
            </div>

            {/* Opções de Ação Selecionáveis no Controle Remoto */}
            <div className="tv-see-more-dialog-actions">
              {/* Opção 0: Carregar no Carrossel */}
              <button
                type="button"
                className={`tv-see-more-action-btn ${choiceIndex === 0 ? 'focused' : ''}`}
                onClick={() => {
                  onLoadMoreToRow?.(section);
                  onClose?.();
                }}
              >
                <div className="tv-see-more-action-left">
                  <div className="tv-see-more-action-icon-circle">
                    <span className="material-icons">playlist_add</span>
                  </div>
                  <div>
                    <div className="tv-see-more-action-label">Carregar Mais no Carrossel (+24 filmes)</div>
                    <div className="tv-see-more-action-desc">Adiciona mais títulos diretamente nesta linha sem sair da tela inicial</div>
                  </div>
                </div>
                <span className="material-icons tv-see-more-action-arrow">arrow_forward</span>
              </button>

              {/* Opção 1: Ver em Grade Completa */}
              <button
                type="button"
                className={`tv-see-more-action-btn ${choiceIndex === 1 ? 'focused' : ''}`}
                onClick={() => {
                  setViewMode('grid');
                  setGridRowIndex(0);
                  setGridColIndex(0);
                }}
              >
                <div className="tv-see-more-action-left">
                  <div className="tv-see-more-action-icon-circle" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA' }}>
                    <span className="material-icons">grid_view</span>
                  </div>
                  <div>
                    <div className="tv-see-more-action-label">
                      Ver Todos em Grade Completa {gridMovies.length > 0 ? `(${gridMovies.length} títulos)` : ''}
                    </div>
                    <div className="tv-see-more-action-desc">Abre todos os filmes desta categoria em tela cheia com visualização em grade</div>
                  </div>
                </div>
                <span className="material-icons tv-see-more-action-arrow">grid_view</span>
              </button>

              {/* Opção 2: Fechar */}
              <button
                type="button"
                className={`tv-see-more-action-btn btn-secondary ${choiceIndex === 2 ? 'focused' : ''}`}
                onClick={onClose}
              >
                <div className="tv-see-more-action-left">
                  <div className="tv-see-more-action-icon-circle" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#94A3B8' }}>
                    <span className="material-icons">close</span>
                  </div>
                  <div>
                    <div className="tv-see-more-action-label">Voltar</div>
                    <div className="tv-see-more-action-desc">Continuar navegando no aplicativo</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="tv-see-more-footer-hint">
              <span>▲ ▼ UP/DOWN: Escolher • ENTER: Confirmar • VOLTAR: Fechar</span>
            </div>
          </motion.div>
        ) : (
          /* Modo Grade Completa Full-Screen */
          <motion.div
            className="tv-see-more-grid-modal"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          >
            {/* Barra Superior da Grade */}
            <div className="tv-see-more-grid-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  type="button"
                  className="tv-btn tv-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                  onClick={() => setViewMode('choice')}
                >
                  <span className="material-icons">arrow_back</span>
                  <span>Voltar</span>
                </button>
                <div>
                  <h1 className="tv-page-title" style={{ margin: 0, fontSize: '28px' }}>{section.title}</h1>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {loadingGrid ? 'Buscando catálogo completo...' : `${gridMovies.length} títulos disponíveis`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="tv-btn tv-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontWeight: 700 }}
                  onClick={() => {
                    onLoadMoreToRow?.(section, gridMovies);
                    onClose?.();
                  }}
                >
                  <span className="material-icons">playlist_add</span>
                  <span>Adicionar Todos ao Carrossel</span>
                </button>
              </div>
            </div>

            {/* Conteúdo da Grade Full-Screen */}
            <div className="tv-see-more-grid-body">
              {gridMovies.length === 0 && loadingGrid ? (
                <div className="tv-empty-container">
                  <span className="tv-home-spinner" />
                  <p style={{ marginTop: '16px', color: '#FAF9F5', fontWeight: 600 }}>Carregando catálogo completo...</p>
                </div>
              ) : (
                <div className="tv-fullpage-grid">
                  {Array.from({ length: totalGridRows }).map((_, rIdx) => {
                    const rowSlice = gridMovies.slice(rIdx * COL_COUNT, (rIdx + 1) * COL_COUNT);
                    return rowSlice.map((movie, cIdx) => {
                      const isFocused = gridRowIndex === rIdx && gridColIndex === cIdx;
                      return (
                        <MovieCard
                          key={movie.id || `${rIdx}-${cIdx}`}
                          movie={movie}
                          isFocused={isFocused}
                          onSelect={onSelectMovie}
                          onContextMenu={onContextMenuMovie}
                        />
                      );
                    });
                  })}
                </div>
              )}
            </div>

            <div className="tv-see-more-footer-hint" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 32px' }}>
              <span>◄ ► ▲ ▼ Setas do controle: Navegar • ENTER: Detalhes • VOLTAR: Sair da Grade</span>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
