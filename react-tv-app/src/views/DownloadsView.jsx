import React, { useState, useEffect, useRef } from 'react';

export function DownloadsView({
  downloads = [],
  storage = null,
  stats = null,
  activeZone = 'rows',
  focusedIndex = 0,
  actionIndex = 0,
  onPlayDownload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onContextMenu
}) {
  const isListFocused = activeZone === 'rows';
  const cardRefs = useRef([]);

  // Auto-scroll para manter o item focado visível na TV
  useEffect(() => {
    if (isListFocused && cardRefs.current[focusedIndex]) {
      cardRefs.current[focusedIndex].scrollIntoView({
        behavior: 'auto',
        block: 'nearest'
      });
    }
  }, [isListFocused, focusedIndex]);

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    onCancelDownload?.(item, true);
  };

  const handlePauseResumeClick = (e, item) => {
    e.stopPropagation();
    if (item.isPaused || item.status === 'paused') {
      onResumeDownload?.(item);
    } else {
      onPauseDownload?.(item);
    }
  };

  const handleCardContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(item);
  };

  // Percentual de uso de disco
  const diskPercent = storage && storage.totalSpaceGB && storage.usedSpaceGB
    ? Math.min(100, Math.max(0, Math.round((storage.usedSpaceGB / storage.totalSpaceGB) * 100)))
    : null;

  return (
    <div className="tv-view-container tv-downloads-view" style={{ paddingTop: '72px' }}>
      {/* Cabeçalho da Página */}
      <div className="tv-downloads-header">
        <div>
          <h1 className="tv-page-title" style={{ marginBottom: '4px' }}>Downloads & Armazenamento</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Gerencie os filmes e séries baixados para assistir no PC sem conexão com a internet.
          </p>
        </div>
        <div className="tv-downloads-path-badge">
          <span className="material-icons" style={{ fontSize: '18px', color: 'var(--focus-border)' }}>folder</span>
          <span>{storage?.savePath || 'D:\\Filmes'}</span>
        </div>
      </div>

      {/* Grid de Métricas do Servidor e Disco */}
      <div className="tv-downloads-stats-grid">
        {/* Card 1: Velocidade Agregada */}
        <div className="tv-downloads-stat-card">
          <div className="tv-downloads-stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <span className="material-icons" style={{ fontSize: '28px' }}>speed</span>
          </div>
          <div className="tv-downloads-stat-content">
            <span className="tv-downloads-stat-label">Taxa de Transferência</span>
            <div className="tv-downloads-stat-value">
              {stats?.totalDownloadSpeed || '0 B/s'}
            </div>
            <span className="tv-downloads-stat-sub">
              {stats?.activeCount || 0} ativo(s) em download (↑ {stats?.totalUploadSpeed || '0 B/s'})
            </span>
          </div>
        </div>

        {/* Card 2: Fila de Downloads */}
        <div className="tv-downloads-stat-card">
          <div className="tv-downloads-stat-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            <span className="material-icons" style={{ fontSize: '28px' }}>download_for_offline</span>
          </div>
          <div className="tv-downloads-stat-content">
            <span className="tv-downloads-stat-label">Status da Biblioteca</span>
            <div className="tv-downloads-stat-value">
              {stats?.completedCount || 0} Concluído(s)
            </div>
            <span className="tv-downloads-stat-sub">
              {stats?.activeCount || 0} Baixando | {stats?.pausedCount || 0} Pausado(s)
            </span>
          </div>
        </div>

        {/* Card 3: Armazenamento em Disco D:\Filmes */}
        <div className="tv-downloads-stat-card">
          <div className="tv-downloads-stat-icon-wrapper" style={{ background: 'rgba(245, 197, 24, 0.15)', color: 'var(--focus-border)' }}>
            <span className="material-icons" style={{ fontSize: '28px' }}>hard_drive</span>
          </div>
          <div className="tv-downloads-stat-content" style={{ flex: 1 }}>
            <span className="tv-downloads-stat-label">Armazenamento em Disco</span>
            <div className="tv-downloads-stat-value">
              {storage?.freeSpaceGB !== null && storage?.freeSpaceGB !== undefined
                ? `${storage.freeSpaceGB} GB Livres`
                : 'Disco Local'}
            </div>
            {diskPercent !== null && (
              <div className="tv-downloads-mini-progress">
                <div
                  className="tv-downloads-mini-progress-fill"
                  style={{
                    width: `${diskPercent}%`,
                    background: diskPercent > 90 ? '#ef4444' : 'var(--focus-border)'
                  }}
                />
              </div>
            )}
            <span className="tv-downloads-stat-sub">
              {storage?.totalSpaceGB
                ? `${storage.usedSpaceGB} GB usados de ${storage.totalSpaceGB} GB (${diskPercent}% usado)`
                : 'Destino D:\\Filmes'}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Downloads ou Estado Vazio */}
      {downloads.length === 0 ? (
        <div className="tv-empty-container tv-downloads-empty-box">
          <div className="tv-downloads-empty-icon">
            <span className="material-icons" style={{ fontSize: '56px', color: 'var(--text-subtle)' }}>cloud_download</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '12px 0 6px 0' }}>Nenhum download ativo no momento</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '640px', lineHeight: 1.5, margin: '0 auto 20px auto' }}>
            Você pode baixar qualquer filme ou série para assistir no computador sem internet. No controle remoto da TV, segure o botão OK sobre qualquer título para abrir as opções e escolher "Baixar para o Computador".
          </p>
          <div className="tv-badge-pill" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px' }}>check_circle</span>
            <span>Pasta de destino configurada: {storage?.savePath || 'D:\\Filmes'}</span>
          </div>
        </div>
      ) : (
        <div className="tv-downloads-list">
          {downloads.map((item, idx) => {
            const isItemFocused = isListFocused && focusedIndex === idx;
            const progress = Math.min(100, Math.max(0, parseFloat(item.progress) || 0));
            const isDone = item.status === 'completed' || progress >= 100;
            const isPaused = Boolean(item.isPaused || item.status === 'paused');
            const itemId = item.infoHash || item.id || idx;

            // Cores e status
            let statusLabel = 'Baixando';
            let statusBadgeClass = 'tv-download-badge-active';
            let statusIcon = 'arrow_downward';

            if (isDone) {
              statusLabel = 'Concluído';
              statusBadgeClass = 'tv-download-badge-done';
              statusIcon = 'check_circle';
            } else if (isPaused) {
              statusLabel = 'Pausado';
              statusBadgeClass = 'tv-download-badge-paused';
              statusIcon = 'pause_circle';
            }

            return (
              <div
                key={itemId}
                ref={(el) => (cardRefs.current[idx] = el)}
                className={`tv-download-card ${isItemFocused ? 'focused' : ''} ${isDone ? 'completed' : ''}`}
                onClick={() => onPlayDownload?.(item)}
                onContextMenu={(e) => handleCardContextMenu(e, item)}
              >
                {/* Poster Thumbnail com Badge */}
                <div className="tv-download-poster-wrapper">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title || 'Filme'}
                      className="tv-download-poster-img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="tv-download-poster-fallback"
                    style={{ display: item.poster ? 'none' : 'flex' }}
                  >
                    <span className="material-icons" style={{ fontSize: '32px', color: 'rgba(255, 255, 255, 0.3)' }}>movie</span>
                  </div>

                  {/* Badge de status no topo do poster */}
                  <div className={`tv-download-poster-badge ${statusBadgeClass}`}>
                    <span className="material-icons" style={{ fontSize: '12px' }}>{statusIcon}</span>
                    <span>{statusLabel}</span>
                  </div>
                </div>

                {/* Conteúdo Central e Telemetria */}
                <div className="tv-download-main">
                  {/* Linha Superior: Título e Tags */}
                  <div className="tv-download-info-header">
                    <div className="tv-download-title-row">
                      <h3 className="tv-download-title">{item.title || item.name || 'Filme em Download'}</h3>
                      {item.isSeries && (item.season || item.episode) && (
                        <span className="tv-badge-pill" style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontSize: '11px', fontWeight: 700 }}>
                          S{String(item.season || 1).padStart(2, '0')}E{String(item.episode || 1).padStart(2, '0')}
                        </span>
                      )}
                      <span className="tv-badge-pill tv-download-quality-pill">
                        {item.quality || '1080p Full HD'}
                      </span>
                      {item.category && (
                        <span className="tv-badge-pill" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                          {item.category === 'series' ? 'Série' : 'Filme'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso com Percentual */}
                  <div className="tv-download-progress-container">
                    <div className="tv-download-bar-track">
                      <div
                        className={`tv-download-bar-fill ${isDone ? 'done' : (isPaused ? 'paused' : 'active')}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="tv-download-percent-badge">{Math.round(progress)}%</span>
                  </div>

                  {/* Linha de Telemetria Técnica em Tempo Real */}
                  <div className="tv-download-telemetry-row">
                    <div className="tv-download-telemetry-item">
                      <span className="material-icons tv-telemetry-icon">save</span>
                      <span>{item.downloaded || '0 B'} de {item.total || '0 B'}</span>
                    </div>

                    {!isDone && !isPaused && (
                      <div className="tv-download-telemetry-item" style={{ color: '#38bdf8' }}>
                        <span className="material-icons tv-telemetry-icon">arrow_downward</span>
                        <span>{item.downloadSpeed || '0 B/s'}</span>
                      </div>
                    )}

                    {!isDone && (
                      <div className="tv-download-telemetry-item">
                        <span className="material-icons tv-telemetry-icon">people</span>
                        <span>{item.numPeers || 0} peers</span>
                      </div>
                    )}

                    <div className="tv-download-telemetry-item">
                      <span className="material-icons tv-telemetry-icon">schedule</span>
                      <span>{isDone ? 'Download Concluído' : (isPaused ? 'Download Pausado' : `Restam ${item.timeRemaining || 'Calculando...'}`)}</span>
                    </div>

                    <div className="tv-download-telemetry-item tv-download-path-tag" title={item.destinationPath}>
                      <span className="material-icons tv-telemetry-icon">folder_open</span>
                      <span>{item.destinationPath || 'D:\\Filmes'}</span>
                    </div>
                  </div>
                </div>

                {/* Painel Lateral de Ações Diretas */}
                <div className="tv-download-actions">
                  {/* Botão 1: Assistir / Assistir Enquanto Baixa */}
                  <button
                    type="button"
                    className={`tv-btn tv-download-btn ${isItemFocused && actionIndex === 0 ? 'focused' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayDownload?.(item);
                    }}
                    title={isDone ? 'Assistir Filme Completo' : 'Assistir Enquanto Baixa'}
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>play_arrow</span>
                    <span>{isDone ? 'Assistir' : 'Assistir Agora'}</span>
                  </button>

                  {/* Botão 2: Pausar / Retomar (apenas se não estiver concluído) */}
                  {!isDone && (
                    <button
                      type="button"
                      className={`tv-btn tv-btn-secondary tv-download-btn ${isItemFocused && actionIndex === 1 ? 'focused' : ''}`}
                      onClick={(e) => handlePauseResumeClick(e, item)}
                      title={isPaused ? 'Retomar Download' : 'Pausar Download'}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>
                        {isPaused ? 'play_arrow' : 'pause'}
                      </span>
                      <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>
                  )}

                  {/* Botão 3: Excluir / Cancelar (Ação Instantânea) */}
                  <button
                    type="button"
                    className={`tv-btn tv-btn-secondary tv-download-btn tv-download-delete-btn ${isItemFocused && (isDone ? actionIndex === 1 : actionIndex === 2) ? 'focused' : ''}`}
                    onClick={(e) => handleDeleteClick(e, item)}
                    title="Cancelar e excluir arquivos do disco"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>
                      delete_outline
                    </span>
                    <span>{isDone ? 'Excluir' : 'Cancelar'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dica de Navegação do Controle Remoto */}
      <div className="tv-downloads-footer-hint">
        <div className="tv-downloads-hint-pill">
          <span className="material-icons" style={{ fontSize: '16px', color: 'var(--focus-border)' }}>gamepad</span>
          <span>D-Pad Cima/Baixo: Navegar lista</span>
        </div>
        <div className="tv-downloads-hint-pill">
          <span className="material-icons" style={{ fontSize: '16px', color: 'var(--focus-border)' }}>swap_horiz</span>
          <span>D-Pad Esquerda/Direita: Selecionar Ação</span>
        </div>
        <div className="tv-downloads-hint-pill">
          <span className="material-icons" style={{ fontSize: '16px', color: 'var(--focus-border)' }}>touch_app</span>
          <span>OK: Executar Ação</span>
        </div>
        <div className="tv-downloads-hint-pill">
          <span className="material-icons" style={{ fontSize: '16px', color: 'var(--focus-border)' }}>more_horiz</span>
          <span>Segurar OK: Menu de Opções Completo</span>
        </div>
      </div>
    </div>
  );
}
