import React, { memo } from 'react';

/**
 * QuickActionsModal - Menu de Ações Rápidas acionado ao segurar o OK no controle da TV.
 * Oferece ações contextuais: Assistir, Detalhes, Favoritar, Baixar, Remover do Histórico e Apagar do Disco.
 */
export const QuickActionsModal = memo(function QuickActionsModal({
  movie,
  context = {},
  isFav = false,
  isOpen = false,
  focusedIndex = 0,
  confirmDeleteMode = false,
  onSelectAction,
  onClose,
  onConfirmDelete,
  onCancelDelete
}) {
  if (!isOpen || !movie) return null;

  const { isInContinueWatching = false, isLocal = false, isDownload = false } = context;
  const title = movie.title || movie.name || movie.cleanName || 'Filme';
  const poster = movie.poster || movie.thumbnail || '/placeholder-poster.jpg';
  const year = movie.year || (movie.releaseDate ? movie.releaseDate.substring(0, 4) : '');
  const rating = movie.rating || movie.voteAverage || '';
  const duration = movie.duration ? `${Math.round(movie.duration / 60)} min` : '';

  // Modo de confirmação de exclusão física do arquivo
  if (confirmDeleteMode) {
    const confirmActions = [
      { id: 'confirm_delete', title: 'Sim, Apagar do Disco', icon: 'delete_forever', danger: true },
      { id: 'cancel_delete', title: 'Cancelar', icon: 'close', danger: false }
    ];

    return (
      <div className="tv-quick-actions-backdrop" onClick={onCancelDelete}>
        <div className="tv-quick-actions-modal danger-mode" onClick={(e) => e.stopPropagation()}>
          <div className="tv-quick-actions-header danger-header">
            <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary)' }}>warning</span>
            <div>
              <h2 className="tv-quick-actions-title">Excluir Arquivo do Computador?</h2>
              <p className="tv-quick-actions-subtitle">
                O arquivo de vídeo de "{title}" será removido permanentemente de D:\Filmes.
              </p>
            </div>
          </div>

          <div className="tv-quick-actions-list">
            {confirmActions.map((act, idx) => {
              const isFocused = focusedIndex === idx;
              return (
                <button
                  key={act.id}
                  type="button"
                  className={`tv-quick-action-item ${act.danger ? 'danger' : ''} ${isFocused ? 'focused' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (act.id === 'confirm_delete') onConfirmDelete();
                    else onCancelDelete();
                  }}
                >
                  <span className="material-icons tv-quick-action-icon">{act.icon}</span>
                  <div className="tv-quick-action-text">
                    <span className="tv-quick-action-label">{act.title}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="tv-quick-actions-footer">
            <span>UP/DOWN: Navegar • OK: Confirmar • VOLTAR: Cancelar</span>
          </div>
        </div>
      </div>
    );
  }

  // Lista dinâmica de ações com base no contexto do card
  const actions = [];
  const isDlPaused = Boolean(movie.isPaused || movie.status === 'paused');
  const isDlCompleted = Boolean(movie.status === 'completed' || (movie.progress && movie.progress >= 100));

  if (isDownload) {
    // 1. Assistir (ou reprodução sequencial enquanto baixa)
    actions.push({
      id: 'play',
      title: isDlCompleted ? 'Assistir Agora' : 'Assistir Enquanto Baixa',
      subtitle: isDlCompleted ? 'Reproduzir vídeo completo baixado no PC' : 'Streaming sequencial imediato enquanto baixa',
      icon: 'play_arrow',
      highlight: true
    });

    // 2. Pausar / Retomar Download
    if (!isDlCompleted) {
      actions.push({
        id: 'pause_resume',
        title: isDlPaused ? 'Retomar Download' : 'Pausar Download',
        subtitle: isDlPaused ? 'Retomar transferência dos arquivos no computador' : 'Pausar download temporariamente para liberar internet',
        icon: isDlPaused ? 'play_arrow' : 'pause'
      });
    }

    // 3. Ver Detalhes
    actions.push({
      id: 'details',
      title: 'Ver Detalhes do Título',
      subtitle: 'Sinopse, elenco e informações completas',
      icon: 'info'
    });

    // 4. Cancelar / Excluir Download
    actions.push({
      id: 'delete_download',
      title: 'Cancelar e Excluir Download',
      subtitle: 'Interromper e apagar arquivos de D:\\Filmes',
      icon: 'delete_forever',
      danger: true
    });
  } else {
    // 1. Assistir Agora
    actions.push({
      id: 'play',
      title: 'Assistir Agora',
      subtitle: isInContinueWatching ? 'Retomar de onde parou' : 'Iniciar reprodução imediata',
      icon: 'play_arrow',
      highlight: true
    });

    // 2. Tirar de Continuar Assistindo (posicionado logo após Assistir para acesso imediato com 1 clique para baixo)
    if (isInContinueWatching) {
      actions.push({
        id: 'remove_history',
        title: 'Tirar de Continuar Assistindo',
        subtitle: 'Limpar progresso salvo e retirar da tela inicial',
        icon: 'history_toggle_off',
        warning: true
      });
    }

    // 3. Ver Detalhes
    actions.push({
      id: 'details',
      title: 'Ver Detalhes',
      subtitle: 'Sinopse, elenco e outras informações',
      icon: 'info'
    });

    // 4. Adicionar / Remover da Lista (Favoritos)
    actions.push({
      id: 'favorite',
      title: isFav ? 'Remover de Minha Lista' : 'Adicionar a Minha Lista',
      subtitle: isFav ? 'Remover dos seus títulos favoritos' : 'Salvar em Minha Lista para assistir depois',
      icon: isFav ? 'bookmark_remove' : 'bookmark_add',
      iconColor: isFav ? '#F5C518' : 'inherit'
    });

    // 5. Baixar para o Computador (apenas para títulos online)
    if (!isLocal && !movie.isLocal) {
      actions.push({
        id: 'download',
        title: 'Baixar para o Computador',
        subtitle: 'Salvar em D:\\Filmes para assistir offline',
        icon: 'file_download'
      });
    }

    // 6. Apagar do Disco (se for arquivo local de D:\Filmes)
    if (isLocal || movie.isLocal || movie.filePath) {
      actions.push({
        id: 'delete_local',
        title: 'Apagar do Disco (D:\\Filmes)',
        subtitle: 'Excluir arquivo de vídeo permanentemente do PC',
        icon: 'delete_forever',
        danger: true
      });
    }
  }

  return (
    <div className="tv-quick-actions-backdrop" onClick={onClose}>
      <div className="tv-quick-actions-modal" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Card */}
        <div className="tv-quick-actions-header">
          <img src={poster} alt={title} className="tv-quick-actions-poster" />
          <div className="tv-quick-actions-meta">
            <div className="tv-quick-actions-badges">
              {isInContinueWatching && (
                <span className="tv-badge-pill" style={{ background: 'rgba(229, 9, 20, 0.25)', color: 'var(--primary)' }}>
                  Continuar Assistindo
                </span>
              )}
              {isLocal && (
                <span className="tv-badge-pill" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E' }}>
                  Pasta Local
                </span>
              )}
              {!isLocal && !isInContinueWatching && (
                <span className="tv-badge-pill" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA' }}>
                  Catálogo Online
                </span>
              )}
            </div>

            <h2 className="tv-quick-actions-title">{title}</h2>

            <div className="tv-quick-actions-details-row">
              {year && <span>{year}</span>}
              {rating && <span>• Nota: {rating}</span>}
              {duration && <span>• {duration}</span>}
            </div>
          </div>
        </div>

        {/* Lista de Ações */}
        <div className="tv-quick-actions-list">
          {actions.map((act, idx) => {
            const isFocused = focusedIndex === idx;
            return (
              <button
                key={act.id}
                type="button"
                className={`tv-quick-action-item ${act.highlight ? 'highlight' : ''} ${act.warning ? 'warning' : ''} ${act.danger ? 'danger' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectAction(act.id);
                }}
              >
                <span
                  className="material-icons tv-quick-action-icon"
                  style={act.iconColor ? { color: act.iconColor } : undefined}
                >
                  {act.icon}
                </span>

                <div className="tv-quick-action-text">
                  <span className="tv-quick-action-label">{act.title}</span>
                  {act.subtitle && <span className="tv-quick-action-sublabel">{act.subtitle}</span>}
                </div>

                <span className="material-icons tv-quick-action-arrow">chevron_right</span>
              </button>
            );
          })}
        </div>

        {/* Rodapé com atalhos de navegação */}
        <div className="tv-quick-actions-footer">
          <span>Navegue com UP/DOWN • Pressione OK para selecionar • VOLTAR para fechar</span>
        </div>
      </div>
    </div>
  );
});
