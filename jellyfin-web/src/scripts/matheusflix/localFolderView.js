/**
 * MatheusFlix - Minha Pasta (D:\filmes).
 * Filmes já salvos no computador + downloads em andamento, numa tela só.
 * Clique no pôster = assistir.
 */

import { cancelDownload, fetchDownloads, fetchLocalMovies, rescanLocalMovies, deleteLocalMovie, renameLocalMovie, updateSavePath } from './api';
import { openCinemaPlayer } from './cinemaPlayer';
import { confirmDeleteModal, confirmDeleteFileModal, promptTextModal } from './confirmModal';
import { escapeHtml, normalizeMovie, parseDuration, PLACEHOLDER_POSTER } from './utils';
import toast from 'components/toast/toast';

export function renderLocalFolderView(container) {
    let movies = [];
    let franchises = [];
    let series = [];
    let currentView = 'all';

    const savedPath = localStorage.getItem('mf_save_path') || 'D:\\filmes';

    container.innerHTML = `
        <div class="mf-local sp" style="padding: 36px 48px; max-width: 1600px; margin: 0 auto;">
            <!-- Header Editorial Estilo Cinelar -->
            <div class="mf-local-header-hero" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:24px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(250,249,245,0.08);">
                <div>
                    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(250,249,245,0.06);border:1px solid rgba(250,249,245,0.1);font-size:12px;font-weight:600;color:#D97757;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:10px;">
                        <span class="material-icons" style="font-size:14px;">folder_special</span>
                        <span>Acervo em Disco</span>
                    </div>
                    <div class="t mf-local-main-title" style="font-size:40px;font-weight:600;letter-spacing:-0.5px;color:#FAF9F5;line-height:1.15;">Pasta Local</div>
                    <div class="m mf-local-path-label" style="margin-top:8px;color:#A8A59C;font-size:14px;display:flex;align-items:center;gap:8px;">
                        <span class="material-icons" style="font-size:15px;color:#FAF9F5;opacity:0.5;">folder</span>
                        <span>${escapeHtml(savedPath)}</span>
                        <span style="opacity:0.3;">•</span>
                        <span>Reprodução direta de alta fidelidade</span>
                    </div>
                </div>
                <div class="mf-local-category-bar" style="display:flex;gap:12px;flex-wrap:wrap;">
                    <button type="button" class="mf-category-chip c on focusable active" data-view="all">
                        <span>Todos os Filmes</span>
                    </button>
                    <button type="button" class="mf-category-chip c focusable" data-view="franchises">
                        <span>Franquias</span>
                    </button>
                    <button type="button" class="mf-category-chip c focusable" data-view="series">
                        <span>Séries</span>
                    </button>
                </div>
            </div>

            <!-- Toolbar de Busca, Alterar Pasta e Sincronizacao -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:28px;">
                <div class="mf-search-box" style="flex:1;max-width:440px;">
                    <span class="material-icons mf-search-icon">search</span>
                    <input type="search" class="mf-search-input mf-local-search-input focusable" placeholder="Filtrar arquivos locais..." />
                </div>
                <div style="display:flex;gap:12px;align-items:center;">
                    <button type="button" class="btn g mf-btn-change-folder focusable" style="height:44px;padding:0 20px;border-radius:12px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                        <span class="material-icons" style="font-size:18px;">folder_open</span>
                        Alterar pasta
                    </button>
                    <button type="button" class="btn g mf-btn-rescan-folder focusable" style="height:44px;padding:0 22px;border-radius:12px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                        <span class="material-icons" style="font-size:18px;">sync</span>
                        Sincronizar pasta
                    </button>
                </div>
            </div>

            <div class="mf-downloads-strip hide"></div>
            <div class="mf-local-content-area">
                <div class="mf-local-grid"></div>
            </div>
        </div>
    `;

    const contentArea = container.querySelector('.mf-local-content-area');
    const stats = container.querySelector('.mf-local-stats-text');
    const searchInput = container.querySelector('.mf-local-search-input');
    const btnRescan = container.querySelector('.mf-btn-rescan-folder');
    const strip = container.querySelector('.mf-downloads-strip');
    const categoryChips = container.querySelectorAll('.mf-category-chip');
    const countAll = container.querySelector('.mf-count-all');
    const countFranchises = container.querySelector('.mf-count-franchises');
    const countSeries = container.querySelector('.mf-count-series');

    const render = () => {
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (currentView === 'franchises') {
            renderFranchisesView(contentArea, franchises, q);
        } else if (currentView === 'series') {
            renderSeriesView(contentArea, series, q);
        } else {
            const list = q ?
                movies.filter((m) => [m.title, m.originalTitle, m.folderName, m.franchise].some((v) => v && v.toLowerCase().includes(q))) :
                movies;
            renderAllGrid(contentArea, list, q);
        }
    };

    categoryChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            categoryChips.forEach((c) => {
                c.classList.remove('active');
                c.classList.remove('on');
            });
            chip.classList.add('active');
            chip.classList.add('on');
            currentView = chip.getAttribute('data-view') || 'all';
            render();
        });
    });

    async function load(force = false) {
        try {
            const data = await fetchLocalMovies(force);
            movies = (data.movies || []).map(normalizeMovie);
            franchises = data.franchises || [];
            series = data.series || [];

            if (countAll) countAll.textContent = String(movies.length);
            if (countFranchises) countFranchises.textContent = String(franchises.length);
            if (countSeries) countSeries.textContent = String(series.length);

            if (stats) {
                stats.textContent = `${data.count ?? movies.length} filmes • ${data.totalSize || ''} • ${franchises.length} franquias organizadas`;
            }
            render();
        } catch (err) {
            if (stats) stats.textContent = '';
            contentArea.innerHTML = `<p class="mf-error">Não foi possível ler a pasta (${escapeHtml(err.message)}). Verifique se o torrent-service está rodando.</p>`;
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', render);
    }

    if (btnRescan) {
        btnRescan.addEventListener('click', async () => {
            btnRescan.disabled = true;
            try {
                await rescanLocalMovies();
                await load(true);
                toast('Pasta atualizada e reorganizada.');
            } catch (err) {
                toast(`Erro ao atualizar a pasta: ${err.message}`);
            } finally {
                btnRescan.disabled = false;
            }
        });
    }

    const btnChangeFolder = container.querySelector('.mf-btn-change-folder');
    if (btnChangeFolder) {
        btnChangeFolder.addEventListener('click', async () => {
            const current = localStorage.getItem('mf_save_path') || 'D:\\filmes';
            const newPath = await promptTextModal({
                title: 'Alterar pasta de filmes locais',
                subtitle: 'Defina a pasta onde seus vídeos e downloads são armazenados no computador.',
                icon: 'folder_open',
                label: 'Caminho absoluto da pasta:',
                defaultValue: current,
                placeholder: 'D:\\filmes',
                confirmText: 'Salvar pasta',
                cancelText: 'Cancelar'
            });
            if (newPath && newPath !== current) {
                try {
                    await updateSavePath(newPath);
                    localStorage.setItem('mf_save_path', newPath);
                    toast(`Pasta alterada para: ${newPath}`);
                    const pathLabel = container.querySelector('.mf-local-path-label');
                    if (pathLabel) pathLabel.textContent = `${newPath} · reprodução direta do disco`;
                    load(true);
                } catch (err) {
                    toast(`Erro ao alterar pasta: ${err.message}`);
                }
            }
        });
    }

    load(false);
    startDownloadsPolling(container, strip, () => load(true));
}

function renderAllGrid(container, movies, query) {
    if (!movies.length) {
        container.innerHTML = `<p class="mf-muted" style="padding: 40px 20px; text-align: center;">${query ? 'Nenhum filme corresponde ao filtro digitado.' : 'Nenhum filme na sua pasta ainda.'}</p>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'mf-local-grid';

    const frag = document.createDocumentFragment();
    movies.forEach(m => {
        const card = createMovieCard(m);
        frag.appendChild(card);
    });
    grid.appendChild(frag);

    container.innerHTML = '';
    container.appendChild(grid);
}

function renderFranchisesView(container, franchises, query) {
    let filtered = franchises;
    if (query) {
        filtered = franchises.filter(f =>
            f.name.toLowerCase().includes(query)
            || f.movies.some(m => m.title.toLowerCase().includes(query))
        );
    }

    if (!filtered.length) {
        container.innerHTML = `<p class="mf-muted" style="padding: 40px 20px; text-align: center;">${query ? 'Nenhuma franquia corresponde à busca.' : 'Nenhuma franquia identificada na pasta.'}</p>`;
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'mf-franchises-container';

    filtered.forEach(f => {
        const block = document.createElement('div');
        block.className = 'mf-franchise-block';
        block.innerHTML = `
            <div class="mf-franchise-block-header">
                <div class="mf-franchise-block-left">
                    <span class="material-icons mf-franchise-block-icon" style="font-size: 24px; vertical-align: middle;">collections_bookmark</span>
                    <div>
                        <h3 class="mf-franchise-block-title">Coleção ${escapeHtml(f.name)}</h3>
                        <span class="mf-franchise-block-meta">${f.movies.length} ${f.movies.length === 1 ? 'filme salvo' : 'filmes salvos em ordem cronológica'}</span>
                    </div>
                </div>
            </div>
            <div class="mf-local-grid mf-franchise-grid"></div>
        `;

        const grid = block.querySelector('.mf-franchise-grid');
        f.movies.forEach(m => {
            const card = createMovieCard(m);
            grid.appendChild(card);
        });

        wrapper.appendChild(block);
    });

    container.innerHTML = '';
    container.appendChild(wrapper);
}

function renderSeriesView(container, series, query) {
    let filtered = series;
    if (query) {
        filtered = series.filter(s =>
            s.name.toLowerCase().includes(query)
            || s.episodes.some(e => e.title.toLowerCase().includes(query))
        );
    }

    if (!filtered.length) {
        container.innerHTML = '<p class="mf-muted" style="padding: 40px 20px; text-align: center;">Nenhuma série identificada na sua pasta ainda.</p>';
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'mf-series-container';

    filtered.forEach(s => {
        const block = document.createElement('div');
        block.className = 'mf-franchise-block mf-series-block';
        block.innerHTML = `
            <div class="mf-franchise-block-header">
                <div class="mf-franchise-block-left">
                    <span class="material-icons mf-franchise-block-icon" style="font-size: 24px; vertical-align: middle;">tv</span>
                    <div>
                        <h3 class="mf-franchise-block-title">Série: ${escapeHtml(s.name)}</h3>
                        <span class="mf-franchise-block-meta">${s.episodes.length} episódios</span>
                    </div>
                </div>
            </div>
            <div class="mf-local-grid mf-series-grid"></div>
        `;

        const grid = block.querySelector('.mf-series-grid');
        s.episodes.forEach(e => {
            const card = createMovieCard(e);
            grid.appendChild(card);
        });

        wrapper.appendChild(block);
    });

    container.innerHTML = '';
    container.appendChild(wrapper);
}

function createMovieCard(m) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mf-movie-card mf-local-card focusable';
    card.title = `Assistir ${m.title}`;
    card.style.cssText = 'color: #ffffff !important; text-align: left !important;';

    const franchiseTag = m.franchise ?
        `<span class="mf-badge-card-franchise" title="Franquia ${escapeHtml(m.franchise)}"><span class="material-icons" style="font-size: 12px; vertical-align: middle; margin-right: 2px;">collections_bookmark</span>${escapeHtml(m.franchise)}</span>` :
        '';

    card.innerHTML = `
        <div class="mf-poster-wrap">
            <img src="${escapeHtml(m.poster || PLACEHOLDER_POSTER)}" alt="Pôster de ${escapeHtml(m.title)}" loading="lazy" class="mf-poster-img" onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';" />
            <div class="mf-card-top-actions">
                <button type="button" class="mf-btn-rename-local focusable" title="Alterar título ou renomear arquivo">
                    <span class="material-icons" style="font-size: 15px;">edit</span>
                </button>
                <button type="button" class="mf-btn-delete-local focusable" title="Excluir arquivo do disco">
                    <span class="material-icons" style="font-size: 15px;">delete_outline</span>
                </button>
            </div>
            <div class="mf-poster-play-hover"><span class="material-icons mf-play-icon-large">play_circle_filled</span></div>
            ${franchiseTag}
        </div>
        <div class="mf-movie-info" style="padding: 8px 2px 4px 2px; text-align: left; background: transparent; width: 100%; box-sizing: border-box;">
            <h4 class="mf-movie-title" style="color: #ffffff !important; font-size: 13px; font-weight: 600; margin: 0 0 2px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(m.title)}</h4>
            <div class="mf-movie-meta-row" style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; width: 100%;">
                <span class="mf-meta-year" style="color: #FAF9F5 !important; font-weight: 500;">${escapeHtml(m.year)}</span>
                <span class="mf-meta-genre" style="color: #D97757 !important; font-weight: 600;">${escapeHtml(m.sizeFormatted || '')}</span>
            </div>
        </div>
    `;

    const btnRename = card.querySelector('.mf-btn-rename-local');
    if (btnRename) {
        btnRename.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newTitle = await promptTextModal({
                title: 'Alterar nome do filme',
                subtitle: m.videoPath,
                icon: 'edit',
                label: 'Novo título para o filme:',
                defaultValue: m.title,
                placeholder: 'Ex: Interestelar (2014)',
                confirmText: 'Salvar',
                cancelText: 'Cancelar'
            });
            if (newTitle && newTitle !== m.title) {
                btnRename.disabled = true;
                try {
                    const res = await renameLocalMovie(m.videoPath, newTitle);
                    toast('Arquivo renomeado com sucesso.');
                    m.title = newTitle;
                    if (res?.newPath) m.videoPath = res.newPath;
                    const titleEl = card.querySelector('.mf-movie-title');
                    if (titleEl) titleEl.textContent = newTitle;
                    card.title = `Assistir ${newTitle}`;
                } catch (err) {
                    toast(`Erro ao renomear: ${err.message}`);
                } finally {
                    btnRename.disabled = false;
                }
            }
        });
    }

    const btnDel = card.querySelector('.mf-btn-delete-local');
    if (btnDel) {
        btnDel.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await confirmDeleteFileModal({ title: m.title });
            if (confirmed) {
                btnDel.disabled = true;
                try {
                    await deleteLocalMovie(m.videoPath);
                    toast(`"${m.title}" excluído do disco.`);
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.85)';
                    setTimeout(() => card.remove(), 250);
                } catch (err) {
                    btnDel.disabled = false;
                    toast(`Erro ao excluir: ${err.message}`);
                }
            }
        });
    }

    card.addEventListener('click', () => {
        openCinemaPlayer({
            streamUrl: m.streamUrl,
            title: m.title,
            subInfo: [m.quality, m.sizeFormatted, m.franchise ? `Franquia ${m.franchise}` : ''].filter(Boolean).join(' • '),
            quality: m.quality || '',
            isLocal: true,
            movieId: m.imdbId || m.id,
            poster: m.poster,
            duration: parseDuration(m)
        });
    });

    return card;
}

/** Mostra os downloads ativos no topo da pasta; para sozinho quando a tela sai do DOM. */
function startDownloadsPolling(container, strip, onRefresh) {
    const completedSeen = new Set();
    let firstRun = true;

    const tick = async () => {
        if (!container.isConnected) return;
        try {
            if (container.offsetParent !== null) {
                const data = await fetchDownloads();
                const downloads = data.downloads || [];
                renderDownloads(strip, downloads, onRefresh);

                const newlyDone = downloads.filter(d => isDone(d) && !completedSeen.has(d.id));
                newlyDone.forEach(d => {
                    completedSeen.add(d.id);
                });
                if (newlyDone.length && !firstRun && onRefresh) onRefresh();
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

function renderDownloads(strip, downloads, onRefresh) {
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
                toast(`Download de "${title}" cancelado e removido da pasta.`);
                row.remove();
                if (onRefresh) onRefresh();
            } catch (err) {
                btn.disabled = false;
                toast(`Erro ao cancelar: ${err.message}`);
            }
        });
    });
}
