/**
 * MatheusFlix - Minha Pasta (D:\filmes).
 * Filmes já salvos no computador + downloads em andamento, numa tela só.
 * Clique no pôster = assistir.
 */

import { cancelDownload, fetchDownloads, fetchLocalMovies, rescanLocalMovies } from './api';
import { openCinemaPlayer } from './cinemaPlayer';
import { confirmDeleteModal } from './confirmModal';
import { escapeHtml, normalizeMovie } from './utils';
import toast from 'components/toast/toast';

export function renderLocalFolderView(container) {
    let movies = [];

    container.innerHTML = `
        <div class="mf-local">
            <div class="mf-local-header-bar">
                <div>
                    <h3 class="mf-local-path">D:\\filmes</h3>
                    <div class="mf-local-stats-text">Carregando…</div>
                </div>
                <div class="mf-local-actions">
                    <div class="mf-local-search-wrap">
                        <span class="material-icons" style="font-size: 18px; color: #8c93a4;">search</span>
                        <input type="search" class="mf-local-search-input" placeholder="Filtrar filmes da pasta" />
                    </div>
                    <button type="button" class="mf-btn-rescan-folder" title="Procurar arquivos novos na pasta">
                        <span class="material-icons">refresh</span><span>Atualizar</span>
                    </button>
                </div>
            </div>
            <div class="mf-downloads-strip hide"></div>
            <div class="mf-local-grid"></div>
        </div>
    `;

    const grid = container.querySelector('.mf-local-grid');
    const stats = container.querySelector('.mf-local-stats-text');
    const searchInput = container.querySelector('.mf-local-search-input');
    const btnRescan = container.querySelector('.mf-btn-rescan-folder');
    const strip = container.querySelector('.mf-downloads-strip');

    const applyFilter = () => {
        const q = searchInput.value.toLowerCase().trim();
        const list = q ?
            movies.filter(m => [m.title, m.originalTitle, m.folderName].some(v => v && v.toLowerCase().includes(q))) :
            movies;
        renderCards(grid, list, q);
    };

    async function load(force = false) {
        try {
            const data = await fetchLocalMovies(force);
            movies = (data.movies || []).map(normalizeMovie);
            stats.textContent = `${data.count ?? movies.length} filmes • ${data.totalSize || ''}`;
            applyFilter();
        } catch (err) {
            stats.textContent = '';
            grid.innerHTML = `<p class="mf-error">Não foi possível ler a pasta (${escapeHtml(err.message)}). Verifique se o torrent-service está rodando.</p>`;
        }
    }

    searchInput.addEventListener('input', applyFilter);

    btnRescan.addEventListener('click', async () => {
        btnRescan.disabled = true;
        try {
            await rescanLocalMovies();
            await load(true);
            toast('Pasta atualizada.');
        } catch (err) {
            toast(`Erro ao atualizar a pasta: ${err.message}`);
        } finally {
            btnRescan.disabled = false;
        }
    });

    load(false);
    startDownloadsPolling(container, strip, () => load(true));
}

function renderCards(grid, movies, query) {
    if (!movies.length) {
        grid.innerHTML = `<p class="mf-muted">${query ? 'Nenhum filme corresponde ao filtro.' : 'Nenhum filme na pasta ainda.'}</p>`;
        return;
    }

    const frag = document.createDocumentFragment();
    movies.forEach(m => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mf-movie-card mf-local-card';
        card.title = `Assistir ${m.title}`;
        card.style.cssText = 'color: #ffffff !important; text-align: left !important;';
        card.innerHTML = `
            <div class="mf-poster-wrap">
                <img src="${escapeHtml(m.poster)}" alt="" loading="lazy" class="mf-poster-img" />
                <div class="mf-poster-play-hover"><span class="material-icons mf-play-icon-large">play_circle_filled</span></div>
            </div>
            <div class="mf-movie-info" style="padding: 10px 12px 14px 12px; text-align: left; background: rgba(15,18,26,0.95); width: 100%; box-sizing: border-box;">
                <h4 class="mf-movie-title" style="color: #ffffff !important; font-size: 14px; font-weight: 700; margin: 0 0 4px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(m.title)}</h4>
                <div class="mf-movie-meta-row" style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; width: 100%;">
                    <span class="mf-meta-year" style="color: #cbd5e1 !important; font-weight: 500;">${escapeHtml(m.year)}</span>
                    <span class="mf-meta-genre" style="color: #22c55e !important; font-weight: 600;">${escapeHtml(m.sizeFormatted || '')}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            openCinemaPlayer({
                streamUrl: m.streamUrl,
                title: m.title,
                subInfo: [m.quality, m.sizeFormatted].filter(Boolean).join(' • '),
                quality: m.quality || '',
                isLocal: true
            });
        });
        frag.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
}

/** Mostra os downloads ativos no topo da pasta; para sozinho quando a tela sai do DOM. */
function startDownloadsPolling(container, strip, onCompleted) {
    const completedSeen = new Set();
    let firstRun = true;

    const tick = async () => {
        if (!container.isConnected) return;
        try {
            if (container.offsetParent !== null) {
                const data = await fetchDownloads();
                const downloads = data.downloads || [];
                renderDownloads(strip, downloads);

                const newlyDone = downloads.filter(d => isDone(d) && !completedSeen.has(d.id));
                newlyDone.forEach(d => {
                    completedSeen.add(d.id);
                });
                if (newlyDone.length && !firstRun) onCompleted();
                firstRun = false;
            }
        } catch {
            strip.classList.add('hide');
        }
        setTimeout(tick, 3000);
    };
    tick();
}

function isDone(d) {
    return d.status === 'completed' || parseFloat(d.progress) >= 100;
}

function renderDownloads(strip, downloads) {
    const active = downloads.filter(d => !isDone(d));
    if (!active.length) {
        strip.classList.add('hide');
        strip.innerHTML = '';
        return;
    }

    strip.classList.remove('hide');
    strip.innerHTML = `<h4 class="mf-strip-title">Baixando (${active.length})</h4>` + active.map(d => `
        <div class="mf-dl-row" data-id="${escapeHtml(d.id)}">
            <div class="mf-dl-row-top">
                <span class="mf-dl-row-name">${escapeHtml(d.title || d.name || 'Download')}</span>
                <span class="mf-dl-row-info">${escapeHtml(d.progress || 0)}% • ${escapeHtml(d.downloadSpeed || '0 KB/s')} • ${escapeHtml(d.timeRemaining || '')}</span>
                <button type="button" class="mf-dl-row-cancel" title="Cancelar download"><span class="material-icons">close</span></button>
            </div>
            <div class="mf-dl-row-bar"><div style="width: ${Math.min(100, parseFloat(d.progress) || 0)}%;"></div></div>
        </div>
    `).join('');

    strip.querySelectorAll('.mf-dl-row-cancel').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.mf-dl-row');
            const id = row.dataset.id;
            const title = row.querySelector('.mf-dl-row-name')?.textContent || 'este filme';

            const confirmed = await confirmDeleteModal({
                title,
                isCompleted: false
            });
            if (!confirmed) return;

            btn.disabled = true;
            try {
                await cancelDownload(id);
                toast(`Download de "${title}" cancelado.`);
                row.remove();
            } catch (err) {
                btn.disabled = false;
                toast(`Erro ao cancelar: ${err.message}`);
            }
        });
    });
}
