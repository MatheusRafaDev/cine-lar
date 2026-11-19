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
                    <div class="m mf-dl-disk-label" style="color:#A8A59C;font-size:15px;">Espaço livre em disco</div>
                    <div class="t mf-dl-disk-space" style="font-size:36px;font-weight:700;color:#FAF9F5;margin-top:6px;">Carregando...</div>
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
    const diskLabelEl = container.querySelector('.mf-dl-disk-label');
    const countEl = container.querySelector('.mf-dl-active-count');
    const activeList = container.querySelector('.mf-active-list');
    const completedList = container.querySelector('.mf-completed-list');

    let cachedStatus = null;
    async function fetchStatus() {
        try {
            const res = await fetch('http://localhost:8085/api/status');
            if (res.ok) {
                cachedStatus = await res.json();
            }
        } catch (_) {}
    }
    fetchStatus();

    async function loadData() {
        try {
            const data = await fetchDownloads();
            const list = data.downloads || [];
            renderLists(list, speedEl, diskEl, diskLabelEl, countEl, activeList, completedList, cachedStatus);
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

function renderLists(downloads, speedEl, diskEl, diskLabelEl, countEl, activeList, completedList, statusData) {
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
        const savedPath = statusData?.savePath || localStorage.getItem('mf_save_path') || 'D:\\filmes';
        const diskMatch = savedPath.match(/^([A-Za-z]):/);
        const driveLetter = diskMatch ? diskMatch[1].toUpperCase() : '';
        if (diskLabelEl) {
            diskLabelEl.textContent = driveLetter ? `Espaço livre em ${driveLetter}:` : 'Espaço livre em disco';
        }
        if (statusData?.freeSpaceGB != null) {
            diskEl.textContent = `${statusData.freeSpaceGB} GB`;
        } else {
            diskEl.textContent = driveLetter ? `Disco ${driveLetter}:` : 'Pasta Local';
        }
    }

    if (active.length === 0) {
        activeList.innerHTML = `
            <div class="card" style="padding: 36px; text-align: center; background: #1E1D1B; border: 1px solid rgba(250,249,245,0.1); border-radius: 20px; color: #A8A59C;">
                <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #FAF9F5;">Nenhum download ativo no momento.</p>
                <p style="margin: 0; font-size: 14px;">Você pode iniciar downloads através da aba Torrents.</p>
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
                    <div class="m" style="color:#46d369;font-size:13px;margin-top:4px;">Salvo na pasta local</div>
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
