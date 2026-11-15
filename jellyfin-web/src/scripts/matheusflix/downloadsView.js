/**
 * MatheusFlix - Tela Dedicada de Downloads.
 * Monitoramento completo de downloads ativos e histórico de concluídos.
 */

import { cancelDownload, fetchDownloads } from './api';
import { escapeHtml } from './utils';
import toast from 'components/toast/toast';

export function renderDownloadsView(container) {
    container.innerHTML = `
        <div class="mf-downloads-page" style="padding: 24px 32px; max-width: 1400px; margin: 0 auto;">
            <div class="mf-downloads-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
                <div>
                    <h2 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                        <span class="material-icons" style="color: var(--mf-accent, #ff7a1a); font-size: 28px;">download</span>
                        Gerenciador de Downloads
                    </h2>
                    <p class="mf-dl-summary" style="margin: 0; color: #8c93a4; font-size: 14px;">Carregando status dos downloads...</p>
                </div>
                <button type="button" class="mf-btn-refresh-dl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600;">
                    <span class="material-icons" style="font-size: 18px;">refresh</span>
                    <span>Atualizar</span>
                </button>
            </div>

            <!-- Seção de Downloads Ativos -->
            <div class="mf-section-active-dl" style="margin-bottom: 32px;">
                <h3 style="font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons" style="color: #38bdf8; font-size: 20px;">sync</span>
                    Baixando Agora
                </h3>
                <div class="mf-active-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </div>

            <!-- Seção de Concluídos -->
            <div class="mf-section-completed-dl">
                <h3 style="font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons" style="color: #22c55e; font-size: 20px;">check_circle</span>
                    Concluídos
                </h3>
                <div class="mf-completed-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </div>
        </div>
    `;

    const summaryEl = container.querySelector('.mf-dl-summary');
    const activeList = container.querySelector('.mf-active-list');
    const completedList = container.querySelector('.mf-completed-list');
    const btnRefresh = container.querySelector('.mf-btn-refresh-dl');

    async function loadData() {
        try {
            const data = await fetchDownloads();
            const list = data.downloads || [];
            renderLists(list, summaryEl, activeList, completedList);
        } catch (err) {
            summaryEl.textContent = 'Erro ao carregar downloads. Verifique se o torrent-service está ativo.';
            activeList.innerHTML = `<p style="color: #ef4444;">${escapeHtml(err.message)}</p>`;
        }
    }

    btnRefresh.addEventListener('click', loadData);
    loadData();

    // Polling contínuo enquanto visível na tela
    const interval = setInterval(() => {
        if (!container.isConnected) {
            clearInterval(interval);
            return;
        }
        if (container.offsetParent !== null) {
            loadData();
        }
    }, 3000);
}

function isCompleted(d) {
    return d.status === 'completed' || parseFloat(d.progress) >= 100;
}

function renderLists(downloads, summaryEl, activeList, completedList) {
    const active = downloads.filter(d => !isCompleted(d));
    const completed = downloads.filter(d => isCompleted(d));

    summaryEl.textContent = `${active.length} ativo(s) • ${completed.length} concluído(s)`;

    if (active.length === 0) {
        activeList.innerHTML = `
            <div style="padding: 24px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.08); color: #8c93a4;">
                Nenhum download ativo no momento. Navegue até a aba <strong>Torrents</strong> para encontrar filmes!
            </div>
        `;
    } else {
        activeList.innerHTML = active.map(d => `
            <div class="mf-dl-card" data-id="${escapeHtml(d.id)}" style="background: rgba(18,22,32,0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #fff;">${escapeHtml(d.title || d.name || 'Download')}</h4>
                        <div style="font-size: 13px; color: #8c93a4; display: flex; gap: 12px;">
                            <span>💾 ${escapeHtml(d.downloaded || '0 MB')} / ${escapeHtml(d.total || '0 MB')}</span>
                            <span>⚡ ${escapeHtml(d.downloadSpeed || '0 B/s')}</span>
                            <span>👥 ${d.numPeers || 0} peers</span>
                            <span>⏱️ ${escapeHtml(d.timeRemaining || 'Calculando...')}</span>
                        </div>
                    </div>
                    <button type="button" class="mf-btn-cancel-dl" title="Cancelar download" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; border-radius: 8px; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;">
                        <span class="material-icons" style="font-size: 16px;">close</span>
                        <span>Cancelar</span>
                    </button>
                </div>
                <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 4px; overflow: hidden; margin-top: 12px;">
                    <div style="background: linear-gradient(90deg, #ff7a1a, #f59e0b); height: 100%; width: ${Math.min(100, parseFloat(d.progress) || 0)}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="text-align: right; font-size: 12px; color: #a0a6b5; margin-top: 4px;">${escapeHtml(d.progress || 0)}%</div>
            </div>
        `).join('');

        activeList.querySelectorAll('.mf-btn-cancel-dl').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                btn.disabled = true;
                try {
                    await cancelDownload(id);
                    toast('Download cancelado.');
                    btn.closest('.mf-dl-card').remove();
                } catch (err) {
                    btn.disabled = false;
                    toast(`Erro ao cancelar: ${err.message}`);
                }
            });
        });
    }

    if (completed.length === 0) {
        completedList.innerHTML = `
            <div style="padding: 24px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.08); color: #8c93a4;">
                Nenhum download concluído ainda. Os filmes finalizados aparecem também na <strong>Pasta Local</strong>.
            </div>
        `;
    } else {
        completedList.innerHTML = completed.map(d => `
            <div class="mf-dl-card" data-id="${escapeHtml(d.id)}" style="background: rgba(18,22,32,0.65); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(d.title || d.name || 'Filme Concluído')}</h4>
                    <div style="font-size: 13px; color: #22c55e; display: flex; gap: 12px;">
                        <span>✓ Concluído</span>
                        <span style="color: #8c93a4;">Tamanho: ${escapeHtml(d.total || d.downloaded || '')}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="mf-btn-play-completed" style="background: #22c55e; border: none; color: #000; font-weight: 700; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span class="material-icons" style="font-size: 18px;">play_arrow</span>
                        <span>Assistir</span>
                    </button>
                    <button type="button" class="mf-btn-remove-dl" title="Remover do histórico" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #8c93a4; border-radius: 8px; padding: 8px 12px; cursor: pointer;">
                        <span class="material-icons" style="font-size: 18px;">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        completedList.querySelectorAll('.mf-btn-remove-dl').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                btn.disabled = true;
                try {
                    await cancelDownload(id);
                    btn.closest('.mf-dl-card').remove();
                } catch {
                    btn.disabled = false;
                }
            });
        });

        completedList.querySelectorAll('.mf-btn-play-completed').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.MatheusFlix?.navigateToTab) {
                    window.MatheusFlix.navigateToTab(2); // Vai para pasta local
                }
            });
        });
    }
}
