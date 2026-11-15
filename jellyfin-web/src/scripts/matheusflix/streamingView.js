/**
 * MatheusFlix - Catálogo (Stremio / torrents).
 * Uma barra só: busca + "Perguntar à IA" + ordenação, gêneros em chips e a grade de filmes.
 */

import { askAi, fetchCatalog, fetchGenres, fetchUserFavorites } from './api';
import { openStremioDetails } from './stremioDetail';
import { escapeHtml, normalizeMovie } from './utils';

const PAGE_SIZE = 48;

export function renderStreamingView(container) {
    const state = { q: '', genre: 'all', sort: 'trending', offset: 0, requestId: 0 };

    container.innerHTML = `
        <div class="mf-catalog">
            <div class="mf-catalog-toolbar">
                <div class="mf-search-box">
                    <span class="material-icons mf-search-icon">search</span>
                    <input type="search" class="mf-search-input" placeholder="Buscar filme… ou descreva o que quer ver e clique em IA" />
                </div>
                <button type="button" class="mf-btn-ai" title="Recomendação por IA a partir do texto digitado">
                    <span class="material-icons">auto_awesome</span><span>IA</span>
                </button>
                <select class="mf-select mf-sort-select" title="Ordenar">
                    <option value="trending">Em alta</option>
                    <option value="newest">Lançamentos</option>
                    <option value="rating">Melhor avaliados</option>
                    <option value="alpha">A–Z</option>
                </select>
            </div>
            <div class="mf-genre-bar"></div>
            <div class="mf-catalog-status"></div>
            <div class="mf-streaming-grid"></div>
            <div class="mf-catalog-more hide">
                <button type="button" class="mf-btn-more">Carregar mais</button>
            </div>
        </div>
    `;

    const grid = container.querySelector('.mf-streaming-grid');
    const status = container.querySelector('.mf-catalog-status');
    const genreBar = container.querySelector('.mf-genre-bar');
    const searchInput = container.querySelector('.mf-search-input');
    const sortSelect = container.querySelector('.mf-sort-select');
    const aiBtn = container.querySelector('.mf-btn-ai');
    const moreWrap = container.querySelector('.mf-catalog-more');
    const moreBtn = container.querySelector('.mf-btn-more');

    const setStatus = (html) => {
        status.innerHTML = html;
    };

    async function load(append = false) {
        const requestId = ++state.requestId;
        if (!append) {
            state.offset = 0;
            setStatus('<p class="mf-muted">Carregando…</p>');
        }
        try {
            if (state.genre === 'favorites') {
                const favRes = await fetchUserFavorites();
                if (requestId !== state.requestId) return;
                let movies = (favRes.favorites || []).map(f => normalizeMovie({
                    id: f.movieId,
                    imdbId: f.movieId,
                    title: f.title,
                    poster: f.poster,
                    year: f.year,
                    rating: f.rating
                }));
                if (state.q) {
                    const qLower = state.q.toLowerCase();
                    movies = movies.filter(m => m.title.toLowerCase().includes(qLower));
                }
                grid.innerHTML = '';
                appendCards(grid, movies);
                moreWrap.classList.add('hide');
                setStatus(movies.length ? '' : '<p class="mf-muted">Sua lista de favoritos está vazia. Abra um filme e clique no coração para adicionar!</p>');
                return;
            }

            const data = await fetchCatalog({ q: state.q, genre: state.genre, sort: state.sort, limit: PAGE_SIZE, offset: state.offset });
            if (requestId !== state.requestId) return; // resposta antiga, ignora
            const movies = (data.movies || []).map(normalizeMovie);
            if (!append) grid.innerHTML = '';
            appendCards(grid, movies);
            state.offset += movies.length;
            const total = Number(data.total) || 0;
            moreWrap.classList.toggle('hide', !(total > state.offset && movies.length > 0));
            setStatus(grid.children.length ? '' : '<p class="mf-muted">Nenhum filme encontrado.</p>');
        } catch (err) {
            if (requestId !== state.requestId) return;
            moreWrap.classList.add('hide');
            setStatus(`<p class="mf-error">Serviço de torrents indisponível (${escapeHtml(err.message)}). Verifique se o torrent-service está rodando na porta 8085.</p>`);
        }
    }

    async function runAi() {
        const prompt = searchInput.value.trim();
        if (!prompt) {
            searchInput.focus();
            setStatus('<p class="mf-muted">Digite o que você quer assistir (ex.: “suspense com final surpreendente”) e clique em IA.</p>');
            return;
        }
        const requestId = ++state.requestId;
        aiBtn.disabled = true;
        moreWrap.classList.add('hide');
        grid.innerHTML = '';
        setStatus('<p class="mf-muted">A IA está escolhendo filmes… (pode levar alguns segundos)</p>');
        try {
            const data = await askAi(prompt);
            if (requestId !== state.requestId) return;
            const movies = (data.movies || []).map(normalizeMovie);
            appendCards(grid, movies);
            setStatus(movies.length ?
                `<p class="mf-muted">Sugestões da IA para “${escapeHtml(prompt)}”. <a href="#" class="mf-link-clear">Voltar ao catálogo</a></p>` :
                '<p class="mf-muted">A IA não encontrou sugestões. Tente descrever de outro jeito.</p>');
            status.querySelector('.mf-link-clear')?.addEventListener('click', (e) => {
                e.preventDefault();
                searchInput.value = '';
                state.q = '';
                load();
            });
        } catch (err) {
            if (requestId !== state.requestId) return;
            setStatus(`<p class="mf-error">Falha na pesquisa com IA: ${escapeHtml(err.message)}</p>`);
        } finally {
            aiBtn.disabled = false;
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
        }
    });
    sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        load();
    });
    aiBtn.addEventListener('click', runAi);
    moreBtn.addEventListener('click', () => load(true));

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

    const all = [{ id: 'all', name: 'Todos' }, { id: 'favorites', name: '❤️ Minha Lista' }, ...genres];
    genreBar.innerHTML = all.map(g => `
        <button type="button" class="mf-genre-chip ${g.id === state.genre ? 'active' : ''}" data-genre="${escapeHtml(g.id)}">${escapeHtml(g.name)}</button>
    `).join('');

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
    const frag = document.createDocumentFragment();
    movies.forEach(m => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mf-movie-card';
        card.title = m.reason || m.title;
        card.style.cssText = 'color: #ffffff !important; text-align: left !important;';
        card.innerHTML = `
            <div class="mf-poster-wrap">
                <img src="${escapeHtml(m.poster)}" alt="" loading="lazy" class="mf-poster-img" />
                ${m.rating ? `<span class="mf-badge-rating">⭐ ${m.rating}</span>` : ''}
                ${m.isLocal ? '<span class="mf-badge-on-disk">Na pasta</span>' : ''}
            </div>
            <div class="mf-movie-info" style="padding: 10px 12px 14px 12px; text-align: left; background: rgba(15,18,26,0.95); width: 100%; box-sizing: border-box;">
                <h4 class="mf-movie-title" style="color: #ffffff !important; font-size: 14px; font-weight: 700; margin: 0 0 4px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${escapeHtml(m.title)}</h4>
                <div class="mf-movie-meta-row" style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; width: 100%;">
                    <span class="mf-meta-year" style="color: #cbd5e1 !important; font-weight: 500;">${escapeHtml(m.year)}</span>
                    <span class="mf-meta-genre" style="color: #ff7a1a !important; font-weight: 600;">${escapeHtml(String(m.genres).split(',')[0])}</span>
                </div>
                ${m.reason ? `<p class="mf-ai-reason" style="font-size: 11px; color: #38bdf8; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.reason)}</p>` : ''}
            </div>
        `;
        card.addEventListener('click', () => openStremioDetails(m));
        frag.appendChild(card);
    });
    grid.appendChild(frag);
}
