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
                    <button type="button" class="mf-confirm-close-btn focusable" title="Fechar (Esc)"><span class="material-icons" style="font-size: 18px;">close</span></button>
                </div>

                <div class="mf-confirm-body">
                    ${htmlBody}
                </div>

                <div class="mf-confirm-footer">
                    <button type="button" class="mf-confirm-btn-cancel focusable">${escapeHtml(cancelText)}</button>
                    <button type="button" class="mf-confirm-btn-action ${confirmBtnClass} focusable">${escapeHtml(confirmText)}</button>
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
            const keyCode = e.keyCode || e.which || 0;
            const key = e.key || '';
            const isBack = ['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(key) || keyCode === 10009 || keyCode === 461 || keyCode === 27;

            if (isBack) {
                e.stopPropagation();
                cleanup(false);
            } else if (key === 'ArrowLeft') {
                e.stopPropagation();
                backdrop.querySelector('.mf-confirm-btn-cancel')?.focus();
            } else if (key === 'ArrowRight') {
                e.stopPropagation();
                backdrop.querySelector('.mf-confirm-btn-action')?.focus();
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
 * Modal de Confirmação para Download da Temporada Completa
 */
export async function confirmSeasonDownloadModal({ seriesTitle, season, episodeCount, destinationPath, seasonPacks = [] }) {
    const sStr = String(season || 1).padStart(2, '0');
    const dest = destinationPath || `MatheusFlix\\Series\\${seriesTitle}\\Temporada ${sStr}`;

    const packsHtml = seasonPacks.length > 0 ? `
        <div style="margin-top: 14px;">
            <label style="display:block;font-size:12px;font-weight:700;color:#A8A59C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Fontes Disponíveis de Temporada Completa:</label>
            <div class="mf-season-pack-options" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;">
                ${seasonPacks.slice(0, 4).map((p, idx) => `
                    <label class="mf-season-pack-radio focusable" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(250,249,245,0.06);border:1px solid rgba(250,249,245,0.1);border-radius:8px;cursor:pointer;font-size:13px;color:#FAF9F5;">
                        <input type="radio" name="seasonPackMagnet" value="${escapeHtml(p.magnet)}" ${idx === 0 ? 'checked' : ''} style="accent-color:var(--brand,#e50914);" />
                        <span style="font-weight:700;color:var(--brand,#e50914);">${escapeHtml(p.quality)}</span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.label || p.title)}</span>
                        ${p.size ? `<span style="font-size:11px;color:#A8A59C;">${escapeHtml(p.size)}</span>` : ''}
                    </label>
                `).join('')}
            </div>
        </div>
    ` : '';

    const htmlBody = `
        <div class="mf-confirm-info-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(seriesTitle)} - Temporada ${season}</h4>
            <div class="mf-confirm-meta-row">
                <span class="mf-confirm-badge mf-badge-quality">${episodeCount} episódios</span>
                <span class="mf-confirm-badge mf-badge-size">Temporada Completa</span>
            </div>
            <p class="mf-confirm-desc">
                Todos os ${episodeCount} episódios serão salvos organizados em uma pasta exclusiva da série no seu computador.
            </p>
            <div style="background:rgba(0,0,0,0.4);padding:8px 12px;border-radius:6px;border:1px solid rgba(250,249,245,0.08);margin-top:10px;font-size:12px;color:#A8A59C;">
                <span class="material-icons" style="font-size:14px;vertical-align:middle;margin-right:4px;color:#FAF9F5;">folder</span>
                Pasta: <strong style="color:#FAF9F5;">${escapeHtml(dest)}</strong>
            </div>
            ${packsHtml}
        </div>
    `;

    return new Promise((resolve) => {
        showConfirmModal({
            title: `Baixar Temporada ${season} Completa`,
            subtitle: `${seriesTitle} • ${episodeCount} episódios`,
            icon: 'cloud_download',
            iconColor: 'var(--brand, #e50914)',
            htmlBody,
            confirmText: 'Baixar Temporada',
            cancelText: 'Cancelar',
            confirmType: 'primary'
        }).then((confirmed) => {
            if (!confirmed) {
                resolve(null);
                return;
            }
            const selectedRadio = document.querySelector('input[name="seasonPackMagnet"]:checked');
            const selectedMagnet = selectedRadio ? selectedRadio.value : '';
            resolve({
                confirmed: true,
                magnet: selectedMagnet
            });
        });
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
            </div>
            <p class="mf-confirm-desc">
                O arquivo será salvo na sua pasta local para reprodução direta.
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Baixar título',
        subtitle: '',
        icon: 'download',
        iconColor: 'var(--brand, #e50914)',
        htmlBody,
        confirmText: 'Baixar',
        cancelText: 'Cancelar',
        confirmType: 'primary'
    });
}

/**
 * Modal de Confirmação para Cancelar ou Apagar Download
 */
export async function confirmDeleteModal({ title, isCompleted = false }) {
    let mainTitle = 'Cancelar download';
    let subtitle = '';
    let message = 'O download deste filme será cancelado e os dados parciais serão removidos.';
    let actionText = 'Cancelar download';

    if (isCompleted) {
        mainTitle = 'Remover do histórico';
        subtitle = '';
        message = 'O registro deste download será removido da lista.';
        actionText = 'Remover';
    }

    const htmlBody = `
        <div class="mf-confirm-info-box mf-confirm-danger-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <p class="mf-confirm-desc" style="color: #FAF9F5; margin-bottom: 0;">${escapeHtml(message)}</p>
        </div>
    `;

    return showConfirmModal({
        title: mainTitle,
        subtitle,
        icon: 'delete_outline',
        iconColor: 'var(--brand, #e50914)',
        htmlBody,
        confirmText: actionText,
        cancelText: 'Voltar',
        confirmType: 'danger'
    });
}

/**
 * Modal de Confirmação para Excluir Arquivo Local do Disco
 */
export async function confirmDeleteFileModal({ title }) {
    const htmlBody = `
        <div class="mf-confirm-info-box mf-confirm-danger-box">
            <h4 class="mf-confirm-movie-name">${escapeHtml(title)}</h4>
            <p class="mf-confirm-desc" style="color: #A8A59C; margin-bottom: 0;">
                O arquivo será excluído permanentemente da sua pasta local, liberando espaço no disco.
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Excluir do disco',
        subtitle: '',
        icon: 'delete_outline',
        iconColor: 'var(--brand, #e50914)',
        htmlBody,
        confirmText: 'Excluir',
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
            <p class="mf-confirm-desc" style="color: #A8A59C; margin-bottom: 0;">
                O progresso deste filme será removido de Continuar Assistindo.
            </p>
        </div>
    `;

    return showConfirmModal({
        title: 'Remover da lista',
        subtitle: '',
        icon: 'playlist_remove',
        iconColor: 'var(--brand, #e50914)',
        htmlBody,
        confirmText: 'Remover',
        cancelText: 'Cancelar',
        confirmType: 'danger'
    });
}

/**
 * Modal de Entrada de Texto Estilo Cinelar TV para Renomear / Alterar
 */
export function promptTextModal({
    title = 'Alterar',
    subtitle = '',
    icon = 'edit',
    iconColor = '#FAF9F5',
    label = 'Novo valor:',
    defaultValue = '',
    placeholder = '',
    confirmText = 'Salvar',
    cancelText = 'Cancelar'
}) {
    return new Promise((resolve) => {
        if (activeConfirmDialog) {
            activeConfirmDialog.remove();
            activeConfirmDialog = null;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'mf-confirm-backdrop';
        activeConfirmDialog = backdrop;

        backdrop.innerHTML = `
            <div class="mf-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="mfPromptTitle">
                <div class="mf-confirm-header">
                    <div class="mf-confirm-icon-wrap" style="color: ${iconColor};">
                        <span class="material-icons mf-confirm-icon">${icon}</span>
                    </div>
                    <div class="mf-confirm-header-text">
                        <h3 id="mfPromptTitle" class="mf-confirm-title">${escapeHtml(title)}</h3>
                        ${subtitle ? `<p class="mf-confirm-subtitle">${escapeHtml(subtitle)}</p>` : ''}
                    </div>
                    <button type="button" class="mf-confirm-close-btn focusable" title="Fechar (Esc)"><span class="material-icons" style="font-size: 18px;">close</span></button>
                </div>

                <div class="mf-confirm-body">
                    ${label ? `<label class="mf-confirm-label" style="display:block;font-size:14px;color:#A8A59C;margin-bottom:8px;">${escapeHtml(label)}</label>` : ''}
                    <input type="text" class="mf-confirm-input focusable" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" />
                </div>

                <div class="mf-confirm-footer">
                    <button type="button" class="mf-confirm-btn-cancel focusable">${escapeHtml(cancelText)}</button>
                    <button type="button" class="mf-confirm-btn-action mf-confirm-btn-primary focusable">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        const input = backdrop.querySelector('.mf-confirm-input');
        const btnCancel = backdrop.querySelector('.mf-confirm-btn-cancel');
        const btnConfirm = backdrop.querySelector('.mf-confirm-btn-action');
        const btnClose = backdrop.querySelector('.mf-confirm-close-btn');

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
            }, 180);
            resolve(result);
        };

        const handleKey = (e) => {
            const keyCode = e.keyCode || e.which || 0;
            const key = e.key || '';
            const isBack = ['Escape', 'BrowserBack', 'Back'].includes(key) || keyCode === 10009 || keyCode === 461 || keyCode === 27;

            if (isBack) {
                e.preventDefault();
                cleanup(null);
            } else if (key === 'Enter') {
                e.preventDefault();
                const val = input.value.trim();
                cleanup(val || defaultValue);
            }
        };

        btnCancel.addEventListener('click', () => cleanup(null));
        btnClose.addEventListener('click', () => cleanup(null));
        btnConfirm.addEventListener('click', () => {
            const val = input.value.trim();
            cleanup(val || defaultValue);
        });

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                cleanup(null);
            }
        });

        window.addEventListener('keydown', handleKey);

        setTimeout(() => {
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    });
}

/**
 * Menu de Ações (3 Pontinhos) no Padrão Cinelar TV
 * Exibe um menu de opções limpo, modal e navegável por controle remoto ou mouse.
 */
export function showActionMenuModal({
    title = 'Opções',
    subtitle = '',
    icon = 'more_vert',
    items = []
}) {
    return new Promise((resolve) => {
        if (activeConfirmDialog) {
            activeConfirmDialog.remove();
            activeConfirmDialog = null;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'mf-confirm-backdrop';
        activeConfirmDialog = backdrop;

        const itemsHtml = items.map((item) => `
            <button type="button" class="mf-action-menu-item focusable ${item.danger ? 'mf-action-menu-danger' : ''}" data-action-id="${escapeHtml(item.id)}" tabindex="0">
                <span class="material-icons mf-action-menu-icon">${escapeHtml(item.icon || 'chevron_right')}</span>
                <div class="mf-action-menu-texts">
                    <span class="mf-action-menu-label">${escapeHtml(item.label)}</span>
                    ${item.subtitle ? `<span class="mf-action-menu-sub">${escapeHtml(item.subtitle)}</span>` : ''}
                </div>
            </button>
        `).join('');

        backdrop.innerHTML = `
            <div class="mf-confirm-modal mf-action-menu-modal" role="dialog" aria-modal="true" aria-labelledby="mfActionMenuTitle">
                <div class="mf-confirm-header" style="margin-bottom: 14px;">
                    <div class="mf-confirm-icon-wrap" style="color: #FAF9F5; background: rgba(250, 249, 245, 0.08);">
                        <span class="material-icons mf-confirm-icon">${escapeHtml(icon)}</span>
                    </div>
                    <div class="mf-confirm-header-text">
                        <h3 id="mfActionMenuTitle" class="mf-confirm-title" style="font-size: 18px; margin: 0;">${escapeHtml(title)}</h3>
                        ${subtitle ? `<p class="mf-confirm-subtitle" style="margin: 4px 0 0 0; color: #A8A59C; font-size: 13px;">${escapeHtml(subtitle)}</p>` : ''}
                    </div>
                    <button type="button" class="mf-confirm-close-btn focusable" title="Fechar (Esc)"><span class="material-icons" style="font-size: 18px;">close</span></button>
                </div>

                <div class="mf-action-menu-list">
                    ${itemsHtml}
                </div>

                <div class="mf-confirm-footer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(250, 249, 245, 0.08);">
                    <button type="button" class="mf-confirm-btn-cancel focusable" style="width: 100%;">Fechar</button>
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

        const menuButtons = Array.from(backdrop.querySelectorAll('.mf-action-menu-item'));
        let focusedIdx = 0;

        const handleKey = (e) => {
            const keyCode = e.keyCode || e.which || 0;
            const key = e.key || '';
            const isBack = ['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(key) || keyCode === 10009 || keyCode === 461 || keyCode === 27;

            if (isBack) {
                e.stopPropagation();
                cleanup(null);
            } else if (key === 'ArrowDown') {
                e.stopPropagation();
                e.preventDefault();
                focusedIdx = (focusedIdx + 1) % menuButtons.length;
                menuButtons[focusedIdx]?.focus();
            } else if (key === 'ArrowUp') {
                e.stopPropagation();
                e.preventDefault();
                focusedIdx = (focusedIdx - 1 + menuButtons.length) % menuButtons.length;
                menuButtons[focusedIdx]?.focus();
            }
        };

        window.addEventListener('keydown', handleKey);

        backdrop.querySelector('.mf-confirm-close-btn')?.addEventListener('click', () => cleanup(null));
        backdrop.querySelector('.mf-confirm-btn-cancel')?.addEventListener('click', () => cleanup(null));

        menuButtons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionId = btn.getAttribute('data-action-id');
                cleanup(actionId);
            });
        });

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                cleanup(null);
            }
        });

        setTimeout(() => {
            menuButtons[0]?.focus();
        }, 60);
    });
}

