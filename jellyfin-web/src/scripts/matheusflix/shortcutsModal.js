/**
 * MatheusFlix - Modal de Atalhos de Teclado e Controle Remoto TV
 * Design System Cinelar TV.
 */

import { escapeHtml } from './utils';

let activeShortcutsModal = null;

export function openShortcutsModal() {
    if (activeShortcutsModal) {
        closeShortcutsModal();
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'mf-shortcuts-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mfShortcutsTitle');

    const shortcutsList = [
        { key: 'Setas / D-Pad', desc: 'Navegar entre títulos, menus e controles' },
        { key: 'Enter / OK', desc: 'Selecionar filme, confirmar ou reproduzir' },
        { key: 'Esc / Backspace', desc: 'Voltar à tela anterior ou fechar player' },
        { key: 'Espaço', desc: 'Pausar ou retomar a reprodução de vídeo' },
        { key: '← / →', desc: 'Retroceder ou avançar 10 segundos no player' },
        { key: '↑ / ↓', desc: 'Aumentar ou diminuir volume no player' },
        { key: 'M', desc: 'Ativar ou desativar o mudo (silenciar)' },
        { key: 'F', desc: 'Alternar modo de tela cheia (Fullscreen)' },
        { key: 'S', desc: 'Alternar legendas e faixas de áudio' },
        { key: 'C', desc: 'Ciclar velocidade de reprodução (0.75x a 1.5x)' },
        { key: 'P', desc: 'Modo Miniplayer (Picture-in-Picture)' },
        { key: '/', desc: 'Acesso rápido à barra de busca de torrents' },
        { key: '?', desc: 'Abrir este guia de controle e atalhos' }
    ];

    modal.innerHTML = `
        <div class="mf-shortcuts-card card">
            <div class="mf-shortcuts-header">
                <div>
                    <h2 id="mfShortcutsTitle" class="t mf-shortcuts-title">Atalhos e Controle Remoto</h2>
                    <p class="m mf-shortcuts-subtitle">Guia de navegação rápida para Smart TV e Teclado</p>
                </div>
                <button type="button" class="mf-shortcuts-close-btn focusable" title="Fechar (Esc)" aria-label="Fechar">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <div class="mf-shortcuts-grid">
                ${shortcutsList.map(s => `
                    <div class="mf-shortcut-item">
                        <span class="mf-shortcut-badge">${escapeHtml(s.key)}</span>
                        <span class="mf-shortcut-desc">${escapeHtml(s.desc)}</span>
                    </div>
                `).join('')}
            </div>

            <div class="mf-shortcuts-footer">
                <button type="button" class="btn f mf-shortcuts-btn-ok focusable">
                    Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    activeShortcutsModal = modal;

    const btnOk = modal.querySelector('.mf-shortcuts-btn-ok');
    const btnClose = modal.querySelector('.mf-shortcuts-close-btn');

    setTimeout(() => {
        btnOk?.focus();
    }, 50);

    const onKey = (e) => {
        if (['Escape', 'Backspace'].includes(e.key)) {
            e.preventDefault();
            closeShortcutsModal();
        }
    };

    window.addEventListener('keydown', onKey);
    modal._cleanup = () => {
        window.removeEventListener('keydown', onKey);
    };

    btnOk?.addEventListener('click', closeShortcutsModal);
    btnClose?.addEventListener('click', closeShortcutsModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeShortcutsModal();
        }
    });
}

export function closeShortcutsModal() {
    if (!activeShortcutsModal) return;
    if (activeShortcutsModal._cleanup) {
        activeShortcutsModal._cleanup();
    }
    activeShortcutsModal.remove();
    activeShortcutsModal = null;
}

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if ((e.key === '?' || e.key === 'h' || e.key === 'H') &&
            !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
            !activeShortcutsModal) {
            e.preventDefault();
            openShortcutsModal();
        }
    });
}
