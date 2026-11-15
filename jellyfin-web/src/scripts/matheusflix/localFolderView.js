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
    let franchises = [];
    let series = [];
    let currentView = 'all';

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
                        <input type="search" class="mf-local-search-input focusable" placeholder="Filtrar filmes da pasta" />
                    </div>
                    <button type="button" class="mf-btn-rescan-folder focusable" title="Procurar arquivos novos na pasta">
                        <span class="material-icons">refresh</span><span>Atualizar</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Categorias e Agrupamentos (Todos, Franquias, Séries) -->
            <div class="mf-local-category-bar">
                <button type="button" class="mf-category-chip focusable active" data-view="all">
                    <span class="material-icons" style="font-size: 16px;">folder</span>
                    <span>Todos os Filmes</span>
                    <span class="mf-chip-count mf-count-all">0</span>
                </button>
                <button type="button" class="mf-category-chip focusable" data-view="franchises">
                    <span class="material-icons" style="font-size: 16px;">movie_filter</span>
                    <span>🎬 Franquias & Coleções</span>
                    <span class="mf-chip-count mf-count-franchises">0</span>
                </button>
                <button type="button" class="mf-category-chip focusable" data-view="series">
                    <span class="material-icons" style="font-size: 16px;">tv</span>
                    <span>📺 Séries</span>
                    <span class="mf-chip-count mf-count-series">0</span>
                </button>
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
        const q = searchInput.value.toLowerCase().trim();

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
            });
            chip.classList.add('active');
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

            countAll.textContent = String(movies.length);
            countFranchises.textContent = String(franchises.length);
            countSeries.textContent = String(series.length);

            stats.textContent = `${data.count ?? movies.length} filmes • ${data.totalSize || ''} • ${franchises.length} franquias organizadas`;
            render();
        } catch (err) {
            stats.textContent = '';
            contentArea.innerHTML = `<p class="mf-error">Não foi possível ler a pasta (${escapeHtml(err.message)}). Verifique se o torrent-service está rodando.</p>`;
        }
    }

    searchInput.addEventListener('input', render);

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

    load(false);
    startDownloadsPolling(container, strip, () => load(true));
}

function renderAllGrid(container, movies, query) {
    if (!movies.length) {
        container.innerHTML = `<p class="mf-muted" style="padding: 40px 20px; text-align: center;">${query ? 'Nenhum filme corresponde ao filtro digitado.' : 'Nenhum filme na pasta D:\\filmes ainda.'}</p>`;
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
                    <span class="mf-franchise-block-icon">${f.icon || '🎬'}</span>
                    <div>
                        <h3 class="mf-franchise-block-title">Coleção ${escapeHtml(f.name)}</h3>
                        <span class="mf-franchise-block-meta">${f.movies.length} ${f.movies.length === 1 ? 'filme salvo' : 'filmes salvos em ordem cronológica'} • D:\\filmes\\Franquias\\${escapeHtml(f.name)}</span>
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
        container.innerHTML = '<p class="mf-muted" style="padding: 40px 20px; text-align: center;">Nenhuma série identificada na pasta. As séries baixadas pelo MatheusFlix são salvas em D:\\filmes\\Series e agrupadas aqui automaticamente.</p>';
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
                    <span class="mf-franchise-block-icon">📺</span>
                    <div>
                        <h3 class="mf-franchise-block-title">Série: ${escapeHtml(s.name)}</h3>
                        <span class="mf-franchise-block-meta">${s.episodes.length} episódios • D:\\filmes\\Series\\${escapeHtml(s.name)}</span>
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
        `<span class="mf-badge-card-franchise" title="Franquia ${escapeHtml(m.franchise)}">${escapeHtml(m.franchiseIcon || '🎬')} ${escapeHtml(m.franchise)}</span>` :
        '';

    card.innerHTML = `
        <div class="mf-poster-wrap">
            <img src="${escapeHtml(m.poster)}" alt="" loading="lazy" class="mf-poster-img" />
            <div class="mf-poster-play-hover"><span class="material-icons mf-play-icon-large">play_circle_filled</span></div>
            ${franchiseTag}
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
            subInfo: [m.quality, m.sizeFormatted, m.franchise ? `Franquia ${m.franchise}` : ''].filter(Boolean).join(' • '),
            quality: m.quality || '',
            isLocal: true,
            movieId: m.imdbId || m.id,
            poster: m.poster
        });
    });

    return card;
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
