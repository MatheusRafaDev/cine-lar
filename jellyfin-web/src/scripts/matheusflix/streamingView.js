/**
 * MatheusFlix - Catálogo (Stremio / torrents).
 * Uma barra só: busca + "Perguntar à IA" + ordenação, gêneros em chips e a grade de filmes.
 */

import { fetchCatalog, fetchGenres, fetchUserFavorites } from './api';
import { openStremioDetails } from './stremioDetail';
import { escapeHtml, normalizeMovie, PLACEHOLDER_POSTER } from './utils';

const PAGE_SIZE = 48;

export function renderStreamingView(container, initialFilters = {}) {
    let hashGenre = initialFilters.genre;
    let hashSort = initialFilters.sort;
    let hashType = initialFilters.type;

    if (!hashGenre || !hashSort || !hashType) {
        try {
            const h = window.location.hash || '';
            const qIdx = h.indexOf('?');
            if (qIdx !== -1) {
                const sp = new URLSearchParams(h.substring(qIdx));
                if (!hashGenre && sp.has('genre')) hashGenre = sp.get('genre');
                if (!hashSort && sp.has('sort')) hashSort = sp.get('sort');
                if (!hashType && sp.has('type')) hashType = sp.get('type');
            }
        } catch {}
    }

    const state = {
        type: hashType || 'movie',
        q: '',
        genre: hashGenre || 'all',
        sort: hashSort || 'trending',
        release: 'all',
        offset: 0,
        requestId: 0
    };

    container.innerHTML = `
        <div class="mf-catalog">
            <div class="mf-torrent-type-bar">
                <button type="button" class="mf-type-chip focusable ${state.type === 'movie' ? 'active' : ''}" data-type="movie">
                    <span class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">movie</span>Filmes
                </button>
                <button type="button" class="mf-type-chip focusable ${state.type === 'series' ? 'active' : ''}" data-type="series">
                    <span class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">tv</span>Séries
                </button>
            </div>
            <div class="mf-catalog-toolbar">
                <div class="mf-search-box">
                    <span class="material-icons mf-search-icon">search</span>
                    <input type="search" class="mf-search-input focusable" placeholder="Buscar filmes e séries…" />
                </div>
                <select class="mf-select mf-sort-select focusable" title="Ordenar">
                    <option value="trending"${state.sort === 'trending' ? ' selected' : ''}>Em alta</option>
                    <option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Lançamentos</option>
                    <option value="rating"${state.sort === 'rating' ? ' selected' : ''}>Melhor avaliados</option>
                    <option value="alpha"${state.sort === 'alpha' ? ' selected' : ''}>A–Z</option>
                </select>
            </div>
            <div class="mf-cinelar-release-chips" style="display:flex;gap:12px;margin:14px 0 18px;overflow-x:auto;padding-bottom:4px;">
                <button type="button" class="mf-release-chip c on focusable" data-release="all">Todos</button>
                <button type="button" class="mf-release-chip c focusable" data-release="4k">4K UHD</button>
                <button type="button" class="mf-release-chip c focusable" data-release="1080p">1080p</button>
                <button type="button" class="mf-release-chip c focusable" data-release="dub">Dublados PT-BR</button>
                <button type="button" class="mf-release-chip c focusable" data-release="seeds">Mais sementes</button>
            </div>
            <div class="mf-genre-bar"></div>
            <div class="mf-catalog-status"></div>
            <div class="mf-streaming-grid"></div>
            <div class="mf-catalog-more hide">
                <button type="button" class="mf-btn-more focusable">Carregar mais</button>
            </div>
        </div>
    `;

    const grid = container.querySelector('.mf-streaming-grid');
    const status = container.querySelector('.mf-catalog-status');
    const genreBar = container.querySelector('.mf-genre-bar');
    const searchInput = container.querySelector('.mf-search-input');
    const sortSelect = container.querySelector('.mf-sort-select');
    const moreWrap = container.querySelector('.mf-catalog-more');
    const moreBtn = container.querySelector('.mf-btn-more');
    const typeChips = container.querySelectorAll('.mf-type-chip');

    const setStatus = (html) => {
        status.innerHTML = html;
    };

    async function load(append = false) {
        const requestId = ++state.requestId;
        if (!append) {
            state.offset = 0;
            setStatus('');
            grid.innerHTML = Array(12).fill(0).map(() => `
                <div class="mf-movie-card mf-skeleton-card" style="aspect-ratio: 2/3; border-radius: 14px; background: #1E1D1B; position: relative; overflow: hidden;">
                    <div class="mf-skeleton-shimmer"></div>
                </div>
            `).join('');
        }
        try {
            if (state.genre === 'favorites') {
                const favRes = await fetchUserFavorites();
                if (requestId !== state.requestId) return;
                let movies = (favRes.favorites || []).map((f) => normalizeMovie({
                    id: f.movieId,
                    imdbId: f.movieId,
                    title: f.title,
                    poster: f.poster,
                    year: f.year,
                    rating: f.rating
                }));
                if (state.q) {
                    const qLower = state.q.toLowerCase();
                    movies = movies.filter((m) => m.title.toLowerCase().includes(qLower));
                }
                grid.innerHTML = '';
                appendCards(grid, movies);
                moreWrap.classList.add('hide');
                setStatus(movies.length ? '' : '<p class="mf-muted">Sua lista de favoritos está vazia. Abra um título e clique no coração para adicionar!</p>');
                return;
            }

            const data = await fetchCatalog({
                type: state.type,
                q: state.q,
                genre: state.genre,
                sort: state.sort,
                limit: PAGE_SIZE,
                offset: state.offset
            });
            if (requestId !== state.requestId) return; // resposta antiga, ignora
            let movies = (data.movies || []).map(normalizeMovie);
            if (state.release === '4k') {
                movies = movies.filter(m => /4k|2160p|uhd/i.test(`${m.title} ${m.genres || ''}`));
            } else if (state.release === '1080p') {
                movies = movies.filter(m => /1080p|fhd/i.test(`${m.title} ${m.genres || ''}`) || !m.isLocal);
            } else if (state.release === 'dub') {
                movies = movies.filter(m => m.isDubbed !== false);
            }
            if (!append) grid.innerHTML = '';
            appendCards(grid, movies);
            state.offset += movies.length;
            const total = Number(data.total) || 0;
            moreWrap.classList.toggle('hide', !(total > state.offset && movies.length > 0));
            const emptyMsg = state.type === 'series' ? 'Nenhuma série encontrada.' : 'Nenhum filme encontrado.';
            setStatus(grid.children.length ? '' : `<p class="mf-muted">${emptyMsg}</p>`);
        } catch (err) {
            if (requestId !== state.requestId) return;
            moreWrap.classList.add('hide');
            setStatus(`<p class="mf-error">Serviço de torrents indisponível (${escapeHtml(err.message)}). Verifique se o torrent-service está rodando na porta 8085.</p>`);
        }
    }

    let searchTimer = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.q = searchInput.value.trim();
            load();
        }, 350);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimer);
            state.q = searchInput.value.trim();
            load();
            setTimeout(() => {
                const first = grid.querySelector('.mf-movie-card.focusable');
                if (first) first.focus();
            }, 300);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const first = grid.querySelector('.mf-movie-card.focusable');
            if (first) first.focus();
        }
    });
    sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        load();
    });
    moreBtn.addEventListener('click', () => load(true));

    typeChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const selectedType = chip.getAttribute('data-type') || 'movie';
            if (state.type === selectedType) return;
            typeChips.forEach((c) => {
                c.classList.remove('active');
            });
            chip.classList.add('active');
            state.type = selectedType;
            state.offset = 0;
            state.genre = 'all';
            searchInput.value = '';
            state.q = '';
            if (state.type === 'series') {
                searchInput.placeholder = 'Buscar séries…';
                genreBar.style.display = 'none';
            } else {
                searchInput.placeholder = 'Buscar filmes…';
                genreBar.style.display = '';
            }
            load();
        });
    });

    container.querySelectorAll('.mf-release-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.mf-release-chip').forEach(b => b.classList.remove('on'));
            btn.classList.add('on');
            state.release = btn.getAttribute('data-release') || 'all';
            if (state.release === 'seeds') {
                state.sort = 'trending';
                if (sortSelect) sortSelect.value = 'trending';
            }
            load(false);
        });
    });

    renderGenres(genreBar, state, load);
    load();
}

async function renderGenres(genreBar, state, load) {
    let genres = [];
    try {
        genres = (await fetchGenres()).genres || [];
    } catch {
        // sem gêneros: a barra fica só com "Todos"
    }

    const all = [{ id: 'all', name: 'Todos' }, { id: 'favorites', name: 'Minha Lista' }, ...genres];
    genreBar.innerHTML = all.map(g => `
        <button type="button" class="mf-genre-chip focusable ${g.id === state.genre ? 'active' : ''}" data-genre="${escapeHtml(g.id)}">${escapeHtml(g.name)}</button>
    `).join('');

    const activeChip = genreBar.querySelector('.mf-genre-chip.active');
    if (activeChip) {
        setTimeout(() => activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 120);
    }

    genreBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.mf-genre-chip');
        if (!chip) return;
        genreBar.querySelectorAll('.mf-genre-chip').forEach(c => {
            c.classList.toggle('active', c === chip);
        });
        state.genre = chip.dataset.genre;
        load();
    });
}

function appendCards(grid, movies) {
    const existingKeys = new Set(
        Array.from(grid.querySelectorAll('.mf-movie-card[data-movie-key]')).map((c) => c.getAttribute('data-movie-key'))
    );
    const frag = document.createDocumentFragment();
    movies.forEach((m) => {
        const rawKey = m.imdbId || m.id || m.title;
        const key = rawKey ? String(rawKey).trim().toLowerCase() : '';
        if (key && existingKeys.has(key)) return;
        if (key) existingKeys.add(key);

        const card = document.createElement('button');
        card.type = 'button';
        if (key) card.setAttribute('data-movie-key', key);
        card.className = 'mf-movie-card focusable';
        card.title = m.reason || m.title;
        card.style.cssText = 'color: #ffffff !important; text-align: left !important;';

        const seriesBadge = m.isSeries || m.type === 'series' ?
            '<span class="mf-badge-card-series" title="Série de TV"><span class="material-icons" style="font-size: 12px; vertical-align: middle; margin-right: 2px;">tv</span>Série</span>' :
            '';

        card.innerHTML = `
            <div class="mf-poster-wrap">
                <img src="${escapeHtml(m.poster || PLACEHOLDER_POSTER)}" alt="Pôster de ${escapeHtml(m.title)}" loading="lazy" class="mf-poster-img" onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';" />
                ${m.rating ? `<span class="mf-badge-rating"><span class="material-icons" style="font-size: 12px; vertical-align: middle; margin-right: 2px; color: #f59e0b;">star</span>${m.rating}</span>` : ''}
                ${m.isLocal ? '<span class="mf-badge-on-disk"><span class="material-icons" style="font-size: 13px; vertical-align: middle;">check_circle</span> Na sua pasta</span>' : ''}
                ${seriesBadge}
            </div>
            <div class="mf-movie-info" style="padding: 8px 2px 4px 2px; text-align: left; background: transparent; width: 100%; box-sizing: border-box;">
                <h4 class="mf-movie-title" style="color: #ffffff !important; font-size: 13px; font-weight: 600; margin: 0 0 2px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(m.title)}</h4>
                <div class="mf-movie-meta-row" style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-2, #b3b3b3); width: 100%;">
                    <span class="mf-meta-year" style="color: var(--text-2, #b3b3b3) !important; font-weight: 500;">${escapeHtml(m.year)}</span>
                    <span class="mf-meta-genre" style="color: var(--text-2, #b3b3b3) !important; font-weight: 500;">${escapeHtml(String(m.genres).split(',')[0])}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openStremioDetails(m));
        frag.appendChild(card);
    });
    grid.appendChild(frag);
}
