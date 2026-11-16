/**
 * MatheusFlix - Modal de Confirmação Unificado
 * Diálogos modais de cinema para confirmação de download e cancelamento/exclusão.
 */

import { escapeHtml } from './utils';

let activeConfirmDialog = null;

export function showConfirmModal({
    title = 'Confirmar',
    subtitle = '',
    icon = 'help_outline',
    iconColor = 'var(--brand, #e50914)',
    htmlBody = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmType = 'primary'
}) {
    return new Promise((resolve) => {
        if (activeConfirmDialog) {
            activeConfirmDialog.remove();
            activeConfirmDialog = null;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'mf-confirm-backdrop';
        activeConfirmDialog = backdrop;

        let confirmBtnClass = 'mf-confirm-btn-primary';
        if (confirmType === 'danger') {
            confirmBtnClass = 'mf-confirm-btn-danger';
        } else if (confirmType === 'success') {
            confirmBtnClass = 'mf-confirm-btn-success';
        }

        backdrop.innerHTML = `
            <div class="mf-confirm-modal ${confirmType === 'danger' ? 'mf-confirm-modal-danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="mfConfirmTitle">
                <div class="mf-confirm-header">
                    <div class="mf-confirm-icon-wrap" style="color: ${iconColor};">
                        <span class="material-icons mf-confirm-icon">${icon}</span>
                    </div>
                    <div class="mf-confirm-header-text">
                        <h3 id="mfConfirmTitle" class="mf-confirm-title">${escapeHtml(title)}</h3>
                        ${subtitle ? `<p class="mf-confirm-subtitle">${escapeHtml(subtitle)}</p>` : ''}
                    </div>
                    <button type="button" class="mf-confirm-close-btn" title="Fechar (Esc)">✕</button>
                </div>

                <div class="mf-confirm-body">
                    ${htmlBody}
                </div>

                <div class="mf-confirm-footer">
                    <button type="button" class="mf-confirm-btn-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="mf-confirm-btn-action ${confirmBtnClass}">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        let isClosed = false;
        const cleanup = (result) => {
            if (isClosed) return;
            isClosed = true;
            window.removeEventListener('keydown', handleKey);
            backdrop.classList.add('mf-confirm-closing');
            setTimeout(() => {
                backdrop.remove();
                if (activeConfirmDialog === backdrop) {
                    activeConfirmDialog = null;
                }
                resolve(result);
            }, 180);
        };

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                cleanup(false);
            } else if (e.key === 'Enter') {
                e.stopPropagation();
                cleanup(true);
            }
        };

        window.addEventListener('keydown', handleKey);

        backdrop.querySelector('.mf-confirm-btn-cancel').addEventListener('click', () => cleanup(false));
        backdrop.querySelector('.mf-confirm-close-btn').addEventListener('click', () => cleanup(false));
        backdrop.querySelector('.mf-confirm-btn-action').addEventListener('click', () => cleanup(true));

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                cleanup(false);
            }
        });

        // Foco no botão de ação
        setTimeout(() => {
            backdrop.querySelector('.mf-confirm-btn-action')?.focus();
        }, 50);
    });
}

/**
 * Modal de Confirmação para Início de Download
 */
export async function confirmDownloadModal({ title, quality, size }) {
    const htmlBody = `
        <div class="mf-confirm-info-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <div class="mf-confirm-meta-row">
                <span class="mf-confirm-badge mf-badge-quality">${escapeHtml(quality || '1080p')}</span>
                ${size ? `<span class="mf-confirm-badge mf-badge-size">${escapeHtml(size)}</span>` : ''}
                <span class="mf-confirm-badge mf-badge-dest">Destino: Pasta MatheusFlix</span>
            </div>
            <p class="mf-confirm-desc">
                O arquivo será salvo na <strong>pasta MatheusFlix</strong>.
                Você já pode <strong>assistir enquanto baixa</strong> em tempo real, sem esperar terminar!
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Confirmar Download',
        subtitle: 'Salvar filme na pasta MatheusFlix',
        icon: 'download',
        iconColor: 'var(--brand, #e50914)',
        htmlBody,
        confirmText: 'Iniciar Download',
        cancelText: 'Cancelar',
        confirmType: 'primary'
    });
}

/**
 * Modal de Confirmação para Cancelar ou Apagar Download
 */
export async function confirmDeleteModal({ title, isCompleted = false }) {
    let mainTitle = 'Cancelar Download';
    let subtitle = 'Tem certeza que deseja cancelar?';
    let message = 'O download em andamento será interrompido e os dados parciais serão descartados.';
    let actionText = 'Sim, Cancelar Download';

    if (isCompleted) {
        mainTitle = 'Remover do Histórico';
        subtitle = 'Remover registro de download';
        message = 'O registro deste filme será removido da lista do Gerenciador de Downloads.';
        actionText = 'Sim, Remover';
    }

    const htmlBody = `
        <div class="mf-confirm-info-box mf-confirm-danger-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <p class="mf-confirm-desc" style="color: #cbd5e1; margin-bottom: 0;">${escapeHtml(message)}</p>
        </div>
    `;

    return showConfirmModal({
        title: mainTitle,
        subtitle,
        icon: 'delete_forever',
        iconColor: '#ef4444',
        htmlBody,
        confirmText: actionText,
        cancelText: 'Voltar / Manter',
        confirmType: 'danger'
    });
}

/**
 * Modal de Confirmação para Excluir Arquivo Local do Disco (D:\filmes)
 */
export async function confirmDeleteFileModal({ title }) {
    const htmlBody = `
        <div class="mf-confirm-info-box mf-confirm-danger-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <p class="mf-confirm-desc" style="color: #cbd5e1; margin-bottom: 0;">
                O arquivo deste filme e suas legendas serão <strong>apagados definitivamente da sua pasta</strong>, liberando espaço no disco.
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Excluir Arquivo do Computador',
        subtitle: 'Liberar espaço em disco',
        icon: 'delete_forever',
        iconColor: '#ef4444',
        htmlBody,
        confirmText: 'Sim, Excluir Arquivo',
        cancelText: 'Cancelar',
        confirmType: 'danger'
    });
}

/**
 * Modal de Confirmação para Dropar Filme (Remover de Continuar Assistindo)
 */
export async function confirmDropMovieModal({ title }) {
    const htmlBody = `
        <div class="mf-confirm-info-box mf-confirm-danger-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <p class="mf-confirm-desc" style="color: #cbd5e1; margin-bottom: 0;">
                Deseja dropar este título? O progresso salvo será apagado e ele não aparecerá mais na sua lista de <strong>Continuar Assistindo</strong>.
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Dropar Filme',
        subtitle: 'Remover de Continuar Assistindo',
        icon: 'playlist_remove',
        iconColor: '#f97316',
        htmlBody,
        confirmText: 'Sim, Dropar Filme',
        cancelText: 'Manter na Lista',
        confirmType: 'danger'
    });
}

