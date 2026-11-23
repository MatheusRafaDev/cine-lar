import React, { useEffect, useRef } from 'react';
import { LocalMovieCard } from '../components/LocalMovieCard';

export function LocalFolderView({
  localLibrary = {},
  filters = [],
  activeFilter = 'all',
  onSelectFilter = () => {},
  gridRows = [],
  activeZone = 'rows',
  localFilterIndex = 0,
  rowIndex = 0,
  colIndex = 0,
  onSelectMovie = () => {},
  onContextMenuMovie = () => {},
  onOpenDriveConfig = () => {},
  serverStatus = 'online'
}) {
  const isFiltersFocused = activeZone === 'local-filters';
  const isRowsFocused = activeZone === 'rows';

  const filterRefs = useRef([]);

  // Garante auto-scroll horizontal suave na barra de filtros quando navegada pelo controle remoto
  useEffect(() => {
    if (isFiltersFocused && filterRefs.current[localFilterIndex]) {
      filterRefs.current[localFilterIndex].scrollIntoView({
        behavior: 'auto',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [isFiltersFocused, localFilterIndex]);

  const count = localLibrary.count || (localLibrary.movies ? localLibrary.movies.length : 0);
  const totalSize = localLibrary.totalSize || '';
  const franchisesCount = localLibrary.franchises ? localLibrary.franchises.length : 0;
  const savePath = localLibrary.savePath || 'D:\\Filmes';

  const isCollectionsMode = activeFilter === 'collections';
  const isDriveMode = activeFilter === 'gdrive';
  const isLocalOnlyMode = activeFilter === 'local-only';
  const isAllMode = activeFilter === 'all';
  const filteredMovieCount = gridRows.reduce((acc, r) => acc + (r.movies ? r.movies.length : 0), 0);

  const viewTitle = isDriveMode
    ? 'Nuvem (Google Drive)'
    : isLocalOnlyMode
    ? 'Pasta Local (PC)'
    : isCollectionsMode
    ? 'Coleções & Franquias'
    : 'Todos os Arquivos';

  const viewLocationPath = isDriveMode
    ? 'G:\\Meu Drive\\cinelar ➔ Google Drive'
    : isLocalOnlyMode
    ? 'D:\\Filmes (Local PC)'
    : isCollectionsMode
    ? 'D:\\Filmes\\Franquias'
    : 'D:\\Filmes (Local) + G:\\Meu Drive (Nuvem)';

  const viewStatsLabel = isDriveMode
    ? `${filteredMovieCount} filmes na nuvem`
    : isLocalOnlyMode
    ? `${filteredMovieCount} filmes no PC`
    : isCollectionsMode
    ? `${franchisesCount} franquias • ${filteredMovieCount} filmes`
    : `${filteredMovieCount || count} filmes no total`;

  return (
    <div className="tv-view-container tv-local-view" style={{ paddingTop: '76px' }}>
      {/* 1. Cabeçalho Editorial com Estatísticas do Disco ou Nuvem */}
      <div className="tv-page-header tv-local-header">
        <div className="tv-page-header-row">
          <h1 className="tv-page-title">{viewTitle}</h1>
          <span className="tv-badge-pill tv-badge-path" style={isDriveMode ? { borderColor: '#4285F4', color: '#8AB4F8' } : isLocalOnlyMode ? { borderColor: '#10B981', color: '#34D399' } : {}}>
            <span className="material-icons" style={{ fontSize: '14px' }}>{isDriveMode ? 'cloud' : 'folder'}</span>
            <span>{viewLocationPath}</span>
          </span>
          <span className="tv-badge-pill tv-badge-stats">
            {viewStatsLabel}
          </span>
          {serverStatus === 'online' ? (
            <span className="tv-badge-pill" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.4)' }}>
              <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>desktop_windows</span>
              PC Ligado: Local + Drive + Torrent Streaming
            </span>
          ) : (
            <span className="tv-badge-pill" style={{ background: 'rgba(66, 133, 244, 0.2)', color: '#8AB4F8', borderColor: 'rgba(66, 133, 244, 0.4)' }}>
              <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>cloud</span>
              PC Desligado: Acesso Direto via Google Drive
            </span>
          )}
        </div>
      </div>

      {/* 2. Alternador de Exibição: Pasta Local | Nuvem (Google Drive) | Franquias */}
      <div className="tv-local-toggle-container">
        <div className="tv-local-toggle-bar">
          {filters.map((f, idx) => {
            const isFocused = isFiltersFocused && localFilterIndex === idx;
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                ref={el => filterRefs.current[idx] = el}
                type="button"
                className={`tv-local-toggle-btn ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={() => onSelectFilter(f.id, idx)}
              >
                {f.icon && <span className="material-icons" style={{ fontSize: '18px' }}>{f.icon}</span>}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Área de Conteúdo: Grid Full-Page Vertical (Sem Carrossel) */}
      {gridRows.length === 0 ? (
        isDriveMode ? (
          <div className="tv-empty-container" style={{ padding: '60px 20px', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <span className="material-icons" style={{ fontSize: '64px', color: '#4285F4' }}>cloud_sync</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '16px' }}>Sincronização com Google Drive</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '15px', marginTop: '8px' }}>
              A sua pasta <strong>G:\Meu Drive\cinelar</strong> é sincronizada com o Google Drive para você assistir diretamente na TV mesmo com o computador desligado.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="tv-local-toggle-btn active focused"
                onClick={onOpenDriveConfig}
                style={{ background: '#4285F4', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>settings</span>
                <span>Configurar Pasta do Drive</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="tv-empty-container">
            <span className="material-icons" style={{ fontSize: '64px', color: 'var(--text-subtle)' }}>folder_off</span>
            <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Nenhum filme encontrado nesta categoria</h2>
            <p style={{ color: 'var(--text-muted)' }}>Adicione arquivos à pasta {savePath} ou selecione outro filtro.</p>
          </div>
        )
      ) : isCollectionsMode ? (
        /* Modo Coleções Agrupadas: Seções com Título de Franquia + Grid de cada franquia */
        <div className="tv-collections-container">
          {gridRows.map((row, rIdx) => {
            const isCurrentRowFocused = isRowsFocused && rowIndex === rIdx;
            return (
              <div key={row.id || rIdx} className={`tv-franchise-section ${!row.title ? 'tv-franchise-continuation' : ''}`}>
                {row.title && (
                  <div className="tv-franchise-section-header">
                    <div className="tv-franchise-title-row">
                      <span className="material-icons tv-franchise-icon">{row.icon || 'collections_bookmark'}</span>
                      <h2 className="tv-franchise-title">{row.title}</h2>
                      {row.subtitle && <span className="tv-franchise-badge">{row.subtitle}</span>}
                    </div>
                  </div>
                )}
                <div className="tv-fullpage-grid">
                  {row.movies.map((movie, cIdx) => (
                    <LocalMovieCard
                      key={movie.filePath || movie.videoPath || `${movie.id || 'local'}-${rIdx}-${cIdx}`}
                      movie={movie}
                      isFocused={isCurrentRowFocused && colIndex === cIdx}
                      onSelect={onSelectMovie}
                      onContextMenu={onContextMenuMovie}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Modo Galeria Contínua: Grid de página inteira (8 colunas) */
        <div className="tv-single-gallery-container">
          {gridRows[0]?.title && (
            <div className="tv-franchise-section-header" style={{ marginBottom: '20px' }}>
              <div className="tv-franchise-title-row">
                <span className="material-icons tv-franchise-icon">{gridRows[0].icon || 'collections_bookmark'}</span>
                <h2 className="tv-franchise-title">{gridRows[0].title}</h2>
                {gridRows[0].subtitle && <span className="tv-franchise-badge">{gridRows[0].subtitle}</span>}
              </div>
            </div>
          )}
          <div className="tv-fullpage-grid">
            {gridRows.map((row, rIdx) => (
              row.movies.map((movie, cIdx) => {
                const isItemFocused = isRowsFocused && rowIndex === rIdx && colIndex === cIdx;
                return (
                  <LocalMovieCard
                    key={movie.filePath || movie.videoPath || `${movie.id || 'local'}-${rIdx}-${cIdx}`}
                    movie={movie}
                    isFocused={isItemFocused}
                    onSelect={onSelectMovie}
                    onContextMenu={onContextMenuMovie}
                  />
                );
              })
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
