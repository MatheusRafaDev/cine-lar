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
        <div class="mf-downloads-page sp" style="padding: 36px 48px; max-width: 1400px; margin: 0 auto;">
            <!-- Resumo em 3 Cards Estilo Cinelar -->
            <div class="mf-dl-summary-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:32px;">
                <div class="card" style="padding:28px;background:#1E1D1B;border:1px solid rgba(250,249,245,0.1);border-radius:20px;">
                    <div class="m" style="color:#A8A59C;font-size:15px;">Velocidade total</div>
                    <div class="t mf-dl-total-speed" style="font-size:36px;font-weight:700;color:#FAF9F5;margin-top:6px;">0 B/s</div>
                </div>
                <div class="card" style="padding:28px;background:#1E1D1B;border:1px solid rgba(250,249,245,0.1);border-radius:20px;">
                    <div class="m" style="color:#A8A59C;font-size:15px;">Espaço livre em disco</div>
                    <div class="t mf-dl-disk-space" style="font-size:36px;font-weight:700;color:#FAF9F5;margin-top:6px;">Ativo</div>
                </div>
                <div class="card" style="padding:28px;background:#1E1D1B;border:1px solid rgba(250,249,245,0.1);border-radius:20px;">
                    <div class="m" style="color:#A8A59C;font-size:15px;">Downloads ativos</div>
                    <div class="t mf-dl-active-count" style="font-size:36px;font-weight:700;color:#FAF9F5;margin-top:6px;">0</div>
                </div>
            </div>

            <!-- Seção de Downloads Ativos -->
            <div class="mf-section-active-dl" style="margin-bottom: 36px;">
                <div class="t" style="font-size: 24px; font-weight: 700; margin-bottom: 18px; color: #FAF9F5;">
                    Downloads Ativos
                </div>
                <div class="mf-active-list" style="display: flex; flex-direction: column; gap: 16px;"></div>
            </div>

            <!-- Seção de Concluídos -->
            <div class="mf-section-completed-dl">
                <div class="t" style="font-size: 24px; font-weight: 700; margin-bottom: 18px; color: #FAF9F5;">
                    Concluídos
                </div>
                <div class="mf-completed-list" style="display: flex; flex-direction: column; gap: 16px;"></div>
            </div>
        </div>
    `;

    const speedEl = container.querySelector('.mf-dl-total-speed');
    const diskEl = container.querySelector('.mf-dl-disk-space');
    const countEl = container.querySelector('.mf-dl-active-count');
    const activeList = container.querySelector('.mf-active-list');
    const completedList = container.querySelector('.mf-completed-list');

    async function loadData() {
        try {
            const data = await fetchDownloads();
            const list = data.downloads || [];
            renderLists(list, speedEl, diskEl, countEl, activeList, completedList);
        } catch (err) {
            activeList.innerHTML = `<p style="color: #ef4444;">${escapeHtml(err.message)}</p>`;
        }
    }

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

function renderLists(downloads, speedEl, diskEl, countEl, activeList, completedList) {
    const active = downloads.filter(d => !isCompleted(d));
    const completed = downloads.filter(d => isCompleted(d));

    if (countEl) countEl.textContent = String(active.length);
    if (speedEl) {
        const totalSpeed = active.reduce((acc, d) => {
            const sp = d.downloadSpeed || '';
            const match = sp.match(/([\d.]+)\s*([KMG]?B\/s)/i);
            if (match) {
                const val = parseFloat(match[1]);
                const unit = match[2].toUpperCase();
                if (unit.startsWith('M')) return acc + val * 1024 * 1024;
                if (unit.startsWith('K')) return acc + val * 1024;
                return acc + val;
            }
            return acc;
        }, 0);
        if (totalSpeed >= 1024 * 1024) {
            speedEl.textContent = `${(totalSpeed / (1024 * 1024)).toFixed(1)} MB/s`;
        } else if (totalSpeed >= 1024) {
            speedEl.textContent = `${(totalSpeed / 1024).toFixed(0)} KB/s`;
        } else {
            speedEl.textContent = active.length > 0 ? (active[0].downloadSpeed || '0 B/s') : '0 B/s';
        }
    }
    if (diskEl) {
        const savedPath = localStorage.getItem('mf_save_path') || 'D:\\filmes';
        const diskMatch = savedPath.match(/^([A-Za-z]):/);
        diskEl.textContent = diskMatch ? `Disco ${diskMatch[1].toUpperCase()}:` : 'Pasta Local';
    }

    if (active.length === 0) {
        activeList.innerHTML = `
            <div class="card" style="padding: 36px; text-align: center; background: #1E1D1B; border: 1px solid rgba(250,249,245,0.1); border-radius: 20px; color: #A8A59C;">
                <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #FAF9F5;">Nenhum download ativo no momento.</p>
                <p style="margin: 0; font-size: 14px;">Navegue até a aba Torrents para escolher um título e começar a assistir ou baixar!</p>
            </div>
        `;
    } else {
        activeList.innerHTML = active.map(d => `
            <div class="card mf-dl-card" data-id="${escapeHtml(d.id)}" style="background:#1E1D1B;border:1px solid rgba(250,249,245,0.1);border-radius:20px;padding:24px 32px;display:flex;align-items:center;gap:32px;">
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:18px;color:#FAF9F5;word-break:break-all;">${escapeHtml(d.title || d.name || 'Download')}</div>
                    <div class="bar" style="height:8px;border-radius:4px;background:rgba(250,249,245,0.14);margin:14px 0 10px;overflow:hidden;">
                        <i style="display:block;height:8px;border-radius:4px;background:#E50914;width:${Math.min(100, parseFloat(d.progress) || 0)}%;"></i>
                    </div>
                    <div class="m" style="color:#A8A59C;font-size:14px;">
                        ${escapeHtml(d.progress || 0)}% · ETA ${escapeHtml(d.timeRemaining || 'Calculando')} · ${d.numPeers || 0} sementes ativas · ${escapeHtml(d.downloadSpeed || '0 B/s')}
                    </div>
                </div>
                <div style="display:flex;gap:12px;align-items:center;">
                    <button type="button" class="btn f mf-btn-watch-dl focusable" style="border:0;border-radius:12px;height:44px;padding:0 22px;background:#E50914;color:#FAF9F5;font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                        <span class="material-icons" style="font-size:18px;">play_arrow</span> Assistir
                    </button>
                    <button type="button" class="btn g mf-btn-cancel-dl focusable" style="border:0;border-radius:12px;height:44px;padding:0 22px;background:rgba(250,249,245,0.12);color:#FAF9F5;font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                        Cancelar
                    </button>
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
                        subInfo: `${d.progress || 0}% baixado`,
                        quality: '1080p',
                        infoHash: d.id
                    });
                }
            });
        });

        activeList.querySelectorAll('.mf-btn-cancel-dl').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                try {
                    await cancelDownload(id);
                    toast('Download cancelado');
                    const card = btn.closest('.mf-dl-card');
                    if (card) card.remove();
                } catch (e) {
                    toast('Erro ao cancelar: ' + e.message);
                }
            });
        });
    }

    if (completed.length === 0) {
        completedList.innerHTML = `
            <div class="card" style="padding: 24px 32px; background: #1E1D1B; border: 1px solid rgba(250,249,245,0.1); border-radius: 20px; color: #A8A59C;">
                Nenhum download concluído ainda.
            </div>
        `;
    } else {
        completedList.innerHTML = completed.map(d => `
            <div class="card mf-dl-card" data-id="${escapeHtml(d.id)}" style="background:#1E1D1B;border:1px solid rgba(250,249,245,0.1);border-radius:20px;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
                <div>
                    <div style="font-weight:600;font-size:17px;color:#FAF9F5;">${escapeHtml(d.title || d.name || 'Filme')}</div>
                    <div class="m" style="color:#46d369;font-size:13px;margin-top:4px;">100% Concluído · Salvo na pasta local</div>
                </div>
                <button type="button" class="btn f mf-btn-watch-dl focusable" style="border:0;border-radius:12px;height:42px;padding:0 20px;background:#E50914;color:#FAF9F5;font-weight:600;font-size:14px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                    <span class="material-icons" style="font-size:18px;">play_arrow</span> Assistir
                </button>
            </div>
        `).join('');

        completedList.querySelectorAll('.mf-btn-watch-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('.mf-dl-card').dataset.id;
                const d = completed.find(item => item.id === id);
                if (d) {
                    openCinemaPlayer({
                        streamUrl: d.streamUrl || `/api/stream/${d.id}`,
                        title: d.title || d.name,
                        subInfo: 'Salvo em disco',
                        quality: '1080p',
                        infoHash: d.id,
                        isLocal: true
                    });
                }
            });
        });
    }
}
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
