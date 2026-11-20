import React from 'react';

export function DownloadsView({
  downloads = [],
  activeZone,
  focusedIndex,
  onPlayDownload,
  onCancelDownload
}) {
  const isListFocused = activeZone === 'rows';

  return (
    <div className="tv-view-container tv-downloads-view" style={{ paddingTop: '76px' }}>
      <div className="tv-page-header">
        <h1 className="tv-page-title">Downloads</h1>
      </div>

      {downloads.length === 0 ? (
        <div className="tv-empty-container">
          <span className="material-icons" style={{ fontSize: '64px', color: 'var(--text-subtle)' }}>cloud_off</span>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Nenhum download em andamento</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Quando você escolher baixar um filme ou série sob demanda, o progresso em tempo real será exibido aqui.
          </p>
        </div>
      ) : (
        <div className="tv-downloads-list">
          {downloads.map((item, idx) => {
            const isItemFocused = isListFocused && focusedIndex === idx;
            const progress = Math.min(100, Math.max(0, item.progress || 0));
            const isDone = progress >= 100 || item.status === 'completed';

            return (
              <div
                key={item.infoHash || item.id || idx}
                className={`tv-download-card ${isItemFocused ? 'focused' : ''}`}
                onClick={() => onPlayDownload(item)}
              >
                <div className="tv-download-main">
                  <div className="tv-download-info">
                    <h3 className="tv-download-title">{item.title || item.name || 'Filme em Download'}</h3>
                    <div className="tv-download-meta">
                      <span className="tv-badge-pill" style={{ fontSize: '11px' }}>
                        {isDone ? 'Concluído' : item.downloadSpeed || 'Baixando...'}
                      </span>
                      {item.totalSize && <span>Tamanho: {item.totalSize}</span>}
                    </div>
                  </div>

                  <div className="tv-download-progress-box">
                    <div className="tv-download-bar">
                      <div className="tv-download-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="tv-download-percent">{Math.round(progress)}%</span>
                  </div>
                </div>

                <div className="tv-download-actions">
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayDownload(item);
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>play_arrow</span>
                    <span>{isDone ? 'Assistir' : 'Assistir Agora'}</span>
                  </button>

                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    style={{ height: '40px', padding: '0 16px', fontSize: '13px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelDownload(item);
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
