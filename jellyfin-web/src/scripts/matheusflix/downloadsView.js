/**
 * MatheusFlix - Tela Dedicada de Downloads.
 * Suporte a streaming progressivo: assista enquanto o filme baixa para D:\filmes!
 */

import { cancelDownload, fetchDownloads, rescanLocalMovies } from './api';
import { openCinemaPlayer } from './cinemaPlayer';
import { confirmDeleteModal } from './confirmModal';
import { escapeHtml } from './utils';
import toast from 'components/toast/toast';

export function renderDownloadsView(container) {
    container.innerHTML = `
        <div class="mf-downloads-page" style="padding: 28px 36px; max-width: 1400px; margin: 0 auto;">
            <div class="mf-downloads-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 20px;">
                <div>
                    <h2 style="margin: 0 0 6px 0; font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 12px; color: #ffffff;">
                        <span class="material-icons" style="color: #38bdf8; font-size: 30px;">download</span>
                        Gerenciador de Downloads & Streaming
                    </h2>
                    <p class="mf-dl-summary" style="margin: 0; color: #94a3b8; font-size: 14px;">Carregando status dos downloads...</p>
                </div>
                <button type="button" class="mf-btn-refresh-dl" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #ffffff; padding: 10px 18px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; transition: all 0.2s ease;">
                    <span class="material-icons" style="font-size: 18px;">refresh</span>
                    <span>Atualizar</span>
                </button>
            </div>

            <!-- Seção de Downloads Ativos (com Play enquanto baixa) -->
            <div class="mf-section-active-dl" style="margin-bottom: 36px;">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; color: #ffffff;">
                    <span class="material-icons" style="color: #38bdf8; font-size: 22px;">sync</span>
                    Baixando Agora (Assista em Tempo Real)
                </h3>
                <div class="mf-active-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
            </div>

            <!-- Seção de Concluídos -->
            <div class="mf-section-completed-dl">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; color: #ffffff;">
                    <span class="material-icons" style="color: #22c55e; font-size: 22px;">check_circle</span>
                    Downloads Concluídos
                </h3>
                <div class="mf-completed-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
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

    // Polling contínuo enquanto a aba estiver visível
    const interval = setInterval(() => {
        if (!container.isConnected) {
            clearInterval(interval);
            return;
        }
        if (container.offsetParent !== null) {
            loadData();
        }
    }, 2500);
}

function isCompleted(d) {
    return d.status === 'completed' || parseFloat(d.progress) >= 100;
}

function renderLists(downloads, summaryEl, activeList, completedList) {
    const active = downloads.filter(d => !isCompleted(d));
    const completed = downloads.filter(d => isCompleted(d));

    summaryEl.textContent = `${active.length} download(s) em andamento • ${completed.length} filme(s) concluído(s)`;

    if (active.length === 0) {
        activeList.innerHTML = `
            <div style="padding: 32px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 14px; border: 1px dashed rgba(255,255,255,0.1); color: #94a3b8;">
                <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #cbd5e1;">Nenhum download ativo no momento.</p>
                <p style="margin: 0; font-size: 13px;">Navegue até a aba <strong>Torrents</strong> para escolher um filme e começar a assistir ou baixar!</p>
            </div>
        `;
    } else {
        activeList.innerHTML = active.map(d => `
            <div class="mf-dl-card" data-id="${escapeHtml(d.id)}" style="background: rgba(19, 23, 34, 0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 12px;">
                    <div>
                        <h4 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: #ffffff;">${escapeHtml(d.title || d.name || 'Download')}</h4>
                        <div style="font-size: 13px; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 14px; align-items: center;">
                            <span style="color: #cbd5e1;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 3px;">save</span>${escapeHtml(d.downloaded || '0 MB')} / ${escapeHtml(d.total || '0 MB')}</span>
                            <span style="color: #38bdf8; font-weight: 600;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 3px;">speed</span>${escapeHtml(d.downloadSpeed || '0 B/s')}</span>
                            <span style="color: #4ade80;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 3px;">group</span>${d.numPeers || 0} peers</span>
                            <span><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 3px;">schedule</span>${escapeHtml(d.timeRemaining || 'Calculando...')}</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" class="mf-btn-watch-dl focusable" title="Assistir imediatamente enquanto o filme baixa" style="background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; border: none; border-radius: 10px; padding: 8px 18px; font-weight: 800; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 4px 14px rgba(34,197,94,0.4); transition: transform 0.2s ease;">
                            <span class="material-icons" style="font-size: 18px;">play_arrow</span>
                            <span>Assistir enquanto baixa</span>
                        </button>

                        <button type="button" class="mf-btn-cancel-dl focusable" title="Cancelar download" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); color: #f87171; border-radius: 10px; padding: 8px 14px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; transition: all 0.2s ease;">
                            <span class="material-icons" style="font-size: 16px;">close</span>
                            <span>Cancelar</span>
                        </button>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 99px; overflow: hidden; margin-top: 14px;">
                    <div style="background: var(--brand, #e50914); height: 100%; width: ${Math.min(100, parseFloat(d.progress) || 0)}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-2, #b3b3b3); margin-top: 6px;">
                    <span>Salvando na sua pasta</span>
                    <span style="font-weight: 700; color: #ffffff;">${escapeHtml(d.progress || 0)}%</span>
                </div>
            </div>
        `).join('');

        activeList.querySelectorAll('.mf-btn-watch-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                const d = active.find(item => item.id === id);
                if (d) {
                    openCinemaPlayer({
                        streamUrl: d.streamUrl || `/api/stream/${d.id}`,
                        title: d.title || d.name,
                        subInfo: `${d.quality || '1080p'} • Baixando (${d.progress}%)`,
                        quality: d.quality || '1080p',
                        isLocal: false,
                        infoHash: d.id,
                        duration: d.duration || 0
                    });
                }
            });
        });

        activeList.querySelectorAll('.mf-btn-cancel-dl').forEach(btn => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.mf-dl-card');
                const id = card.dataset.id;
                const d = active.find(item => item.id === id);
                const title = d?.title || d?.name || 'este filme';

                const confirmed = await confirmDeleteModal({
                    title,
                    isCompleted: false
                });
                if (!confirmed) return;

                btn.disabled = true;
                try {
                    await cancelDownload(id);
                    toast(`Download de "${title}" cancelado e removido da pasta.`);
                    card.remove();
                    rescanLocalMovies().catch((err) => {
                        console.debug('[DownloadsView] rescan local movies:', err);
                    });
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
            <div class="mf-dl-card" data-id="${escapeHtml(d.id)}" style="background: rgba(18,22,32,0.65); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #ffffff;">${escapeHtml(d.title || d.name || 'Filme Concluído')}</h4>
                    <div style="font-size: 13px; color: #4ade80; display: flex; gap: 14px; align-items: center;">
                        <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 700;">
                            <span class="material-icons" style="font-size: 15px;">check_circle</span> Concluído
                        </span>
                        <span style="color: #94a3b8;">Tamanho: ${escapeHtml(d.total || d.downloaded || '')}</span>
                        <span style="color: #64748b;">Salvo na sua pasta</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="mf-btn-play-completed focusable" style="background: #22c55e; border: none; color: #080a0f; font-weight: 800; font-size: 13px; padding: 8px 18px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(34,197,94,0.4); transition: transform 0.2s ease;">
                        <span class="material-icons" style="font-size: 18px;">play_arrow</span>
                        <span>Assistir</span>
                    </button>
                    <button type="button" class="mf-btn-remove-dl focusable" title="Remover do histórico" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #8c93a4; border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: all 0.2s ease;">
                        <span class="material-icons" style="font-size: 18px;">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        completedList.querySelectorAll('.mf-btn-remove-dl').forEach(btn => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.mf-dl-card');
                const id = card.dataset.id;
                const d = completed.find(item => item.id === id);
                const title = d?.title || d?.name || 'este filme';

                const confirmed = await confirmDeleteModal({
                    title,
                    isCompleted: true
                });
                if (!confirmed) return;

                btn.disabled = true;
                try {
                    await cancelDownload(id);
                    toast(`Registro de "${title}" removido do histórico.`);
                    card.remove();
                    rescanLocalMovies().catch((err) => {
                        console.debug('[DownloadsView] rescan local movies:', err);
                    });
                } catch (err) {
                    btn.disabled = false;
                    toast(`Erro ao remover: ${err.message}`);
                }
            });
        });

        completedList.querySelectorAll('.mf-btn-play-completed').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                const d = completed.find(item => item.id === id);
                if (d) {
                    openCinemaPlayer({
                        streamUrl: d.streamUrl || `/api/stream/${d.id}`,
                        title: d.title || d.name,
                        subInfo: `${d.quality || '1080p'} • Arquivo Salvo`,
                        quality: d.quality || '1080p',
                        isLocal: false,
                        infoHash: d.id,
                        duration: d.duration || 0
                    });
                }
            });
        });
    }
}
