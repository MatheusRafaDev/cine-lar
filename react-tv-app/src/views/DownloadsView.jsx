import React, { useState, useEffect, useRef } from 'react';
import { ServerStatusPanel } from '../components/StatusStatePanel';

export function DownloadsView({
  downloads = [],
  storage = null,
  stats = null,
  activeZone = 'rows',
  focusedIndex = 0,
  actionIndex = 0,
  serverStatus = 'checking',
  onRetryConnection,
  onPlayDownload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onSwitchDestination,
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

      {/* Banner de Aviso de Espaço Reduzido no Google Drive */}
      {storage?.drive && storage.drive.freeGB !== null && storage.drive.freeGB < 2.0 && (
        <div className="tv-downloads-warning-banner">
          <span className="material-icons tv-downloads-warning-icon">info</span>
          <div className="tv-downloads-warning-content">
            <span className="tv-downloads-warning-title">Atenção ao Espaço no Google Drive ({storage.drive.freeGB} GB Livres)</span>
            <span className="tv-downloads-warning-sub">
              Para baixar filmes e séries em alta definição (que exigem de 2 a 5 GB), use a <strong>Pasta Local (D:\Filmes)</strong> com {storage.local?.freeGB || storage.freeSpaceGB || 260}+ GB livres. Downloads enviados ao Drive podem pausar se o arquivo for maior que o espaço disponível.
            </span>
          </div>
        </div>
      )}

      {/* Grid de Métricas do Servidor e Disco */}
      {serverStatus === 'online' && <div className="tv-downloads-stats-grid">
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
              {storage?.drive?.freeGB !== null && storage?.drive?.freeGB !== undefined ? (
                <>PC: {storage.freeSpaceGB} GB livres • Drive: {storage.drive.freeGB} GB</>
              ) : storage?.totalSpaceGB ? (
                `${storage.usedSpaceGB} GB usados de ${storage.totalSpaceGB} GB (${diskPercent}% usado)`
              ) : (
                'Destino D:\\Filmes'
              )}
            </span>
          </div>
        </div>
      </div>}

      {/* Lista de Downloads ou Estado Vazio */}
      {downloads.length === 0 ? (
        serverStatus !== 'online' ? (
          <ServerStatusPanel
            status={serverStatus}
            title="Downloads indisponíveis"
            message="Os downloads ficam salvos no computador. Conecte-se ao servidor para ver a fila e o histórico."
            onRetry={onRetryConnection}
            isFocused={isListFocused && focusedIndex === 0}
          />
        ) : (
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
        )
      ) : (
        <div className="tv-downloads-list">
          {downloads.map((item, idx) => {
            const isItemFocused = isListFocused && focusedIndex === idx;
            const progress = Math.min(100, Math.max(0, parseFloat(item.progress) || 0));
            const isDone = item.status === 'completed' || item.stage === 'completed' || progress >= 100;
            const isPaused = Boolean(item.isPaused || item.status === 'paused' || item.stage === 'paused');
            const isError = item.status === 'error' || item.stage === 'error' || Boolean(item.errorMessage);
            const stage = item.stage || (isError ? 'error' : isDone ? 'completed' : isPaused ? 'paused' : 'downloading');
            const itemId = item.infoHash || item.id || idx;

            // Cores, ícones e rótulos baseados no ciclo de vida
            let statusLabel = item.stageLabel || 'Baixando';
            let statusBadgeClass = 'tv-download-badge-active';
            let statusIcon = 'arrow_downward';
            let barFillClass = 'active';

            if (isError) {
              statusLabel = item.stageLabel || 'Atenção';
              statusBadgeClass = 'tv-download-badge-error';
              statusIcon = 'error_outline';
              barFillClass = 'error';
            } else if (isDone) {
              statusLabel = 'Concluído';
              statusBadgeClass = 'tv-download-badge-done';
              statusIcon = 'check_circle';
              barFillClass = 'done';
            } else if (isPaused) {
              statusLabel = 'Pausado';
              statusBadgeClass = 'tv-download-badge-paused';
              statusIcon = 'pause_circle';
              barFillClass = 'paused';
            } else if (stage === 'searching_peers') {
              statusLabel = item.stageLabel || 'Buscando Fontes';
              statusBadgeClass = 'tv-download-badge-searching';
              statusIcon = 'travel_explore';
              barFillClass = 'searching';
            } else if (stage === 'connecting') {
              statusLabel = item.stageLabel || 'Conectando';
              statusBadgeClass = 'tv-download-badge-connecting';
              statusIcon = 'sync';
              barFillClass = 'connecting';
            }

            return (
              <div
                key={itemId}
                ref={(el) => (cardRefs.current[idx] = el)}
                className={`tv-download-card ${isItemFocused ? 'focused' : ''} ${isDone ? 'completed' : ''} ${isError ? 'error' : ''}`}
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
                      {(() => {
                        const targetPath = String(item.destinationPath || item.savePath || '').toLowerCase();
                        const isLocalDisk = targetPath.startsWith('d:\\') || targetPath.startsWith('d:/') || targetPath.startsWith('c:\\') || targetPath.startsWith('c:/');
                        const isDrive = !isLocalDisk && (item.destination === 'drive' || targetPath.startsWith('g:\\') || targetPath.startsWith('g:/') || targetPath.includes('meu drive') || targetPath.includes('cinelar'));
                        return (
                          <span
                            className="tv-badge-pill"
                            style={{
                              background: isDrive ? 'rgba(66, 133, 244, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                              color: isDrive ? '#8AB4F8' : '#34D399',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: '12px' }}>{isDrive ? 'cloud' : 'folder'}</span>
                            <span>{isDrive ? 'Google Drive' : 'Local PC'}</span>
                          </span>
                        );
                      })()}
                      {item.category && (
                        <span className="tv-badge-pill" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                          {item.category === 'series' ? 'Série' : 'Filme'}
                        </span>
                      )}
                    </div>

                    {/* Explicação Clara do Status em Tempo Real */}
                    <div className={`tv-download-status-explanation ${stage}`}>
                      <span className="material-icons" style={{ fontSize: '15px' }}>
                        {stage === 'searching_peers' ? 'travel_explore' :
                         stage === 'connecting' ? 'sync' :
                         stage === 'error' ? 'error_outline' :
                         stage === 'paused' ? 'pause_circle_filled' :
                         stage === 'completed' ? 'check_circle' : 'cloud_download'}
                      </span>
                      <span>
                        {(() => {
                          const targetPath = String(item.destinationPath || item.savePath || '').toLowerCase();
                          const isLocalDisk = targetPath.startsWith('d:\\') || targetPath.startsWith('d:/') || targetPath.startsWith('c:\\') || targetPath.startsWith('c:/');
                          const isDrive = !isLocalDisk && (item.destination === 'drive' || targetPath.startsWith('g:\\') || targetPath.startsWith('g:/') || targetPath.includes('meu drive') || targetPath.includes('cinelar'));
                          if (isError) {
                            if (isDrive && (item.errorMessage?.includes('insuficiente') || item.errorMessage?.includes('Drive') || item.errorMessage?.includes('Google') || item.errorMessage?.includes('espaço') || item.errorMessage?.includes('space'))) {
                              const driveFree = storage?.drive?.freeGB !== null && storage?.drive?.freeGB !== undefined ? `${storage.drive.freeGB} GB` : '0.5 GB';
                              const pcFree = storage?.freeSpaceGB || storage?.local?.freeGB || 266;
                              return `Espaço insuficiente no Google Drive (apenas ${driveFree} livres). Clique em "Baixar no PC" para usar os ${pcFree} GB livres do computador.`;
                            }
                            return item.errorMessage || item.stageMessage || 'Falha no download.';
                          }
                          return item.stageMessage || (isDone ? 'Download concluído e gravado no disco.' : isPaused ? 'Download pausado. Clique em Retomar quando quiser continuar.' : 'Baixando...');
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso com Percentual */}
                  <div className="tv-download-progress-container">
                    <div className="tv-download-bar-track">
                      <div
                        className={`tv-download-bar-fill ${barFillClass}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="tv-download-percent-badge">{Math.round(progress)}%</span>
                  </div>

                  {/* Linha de Telemetria Técnica em Tempo Real */}
                  <div className="tv-download-telemetry-row">
                    <div className="tv-download-telemetry-item">
                      <span className="material-icons tv-telemetry-icon">save</span>
                      <span>{item.downloaded || '0 B'} de {item.total || 'Calculando...'}</span>
                    </div>

                    {!isDone && !isPaused && !isError && (
                      <div className="tv-download-telemetry-item" style={{ color: '#38bdf8' }}>
                        <span className="material-icons tv-telemetry-icon">arrow_downward</span>
                        <span>{item.downloadSpeed || '0 B/s'}</span>
                      </div>
                    )}

                    {!isDone && !isError && (
                      <div className="tv-download-telemetry-item">
                        <span className="material-icons tv-telemetry-icon">people</span>
                        <span>{item.numPeers || 0} fonte(s) conectada(s)</span>
                      </div>
                    )}

                    <div className="tv-download-telemetry-item">
                      <span className="material-icons tv-telemetry-icon">schedule</span>
                      <span>{isDone ? 'Concluído' : (isPaused ? 'Pausado' : isError ? 'Interrompido' : `Restam ${item.timeRemaining || 'Calculando...'}`)}</span>
                    </div>

                    <div className="tv-download-telemetry-item tv-download-path-tag" title={item.destinationPath || item.savePath}>
                      <span className="material-icons tv-telemetry-icon">
                        {item.destination === 'drive' ? 'cloud' : 'folder_open'}
                      </span>
                      <span>{item.destinationPath || (item.destination === 'drive' ? 'Google Drive' : 'D:\\Filmes')}</span>
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

                  {/* Botão 2: Se for erro no Drive por falta de espaço, oferece Baixar no PC diretamente */}
                  {!isDone && isDrive && isError ? (
                    <button
                      type="button"
                      className={`tv-btn tv-btn-primary tv-download-btn ${isItemFocused && actionIndex === 1 ? 'focused' : ''}`}
                      style={{ background: '#10b981', borderColor: '#059669', color: '#fff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwitchDestination?.(item, 'local');
                      }}
                      title="Mudar destino e baixar no PC (D:\Filmes)"
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>folder</span>
                      <span>Baixar no PC (D:)</span>
                    </button>
                  ) : !isDone ? (
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
                  ) : null}

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
