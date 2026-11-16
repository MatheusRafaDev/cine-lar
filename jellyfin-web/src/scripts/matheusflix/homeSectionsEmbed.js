/**
 * MatheusFlix - Seções extras da tela Início.
 * Destaque no topo + duas fileiras: "Em alta" (catálogo) e "Na sua pasta" (D:\filmes).
 */

import { fetchCatalog, fetchLocalMovies, fetchUserFavorites, fetchWatchHistory, deleteWatchHistory } from './api';
import { openStremioDetails } from './stremioDetail';
import { openCinemaPlayer } from './cinemaPlayer';
import { confirmDropMovieModal } from './confirmModal';
import { escapeHtml, normalizeMovie } from './utils';
import toast from 'components/toast/toast';

const inFlight = new WeakSet();

export async function embedMatheusFlixHomeSections(view) {
    if (!view || inFlight.has(view)) return;
    const homeTab = view.querySelector('#homeTab') || view;
    const sections = homeTab.querySelector('.sections');
    if (!sections) return;

    inFlight.add(view);
    try {
        const [catalog, local, historyRes, favsRes] = await Promise.allSettled([
            fetchCatalog({ limit: 16, sort: 'trending' }),
            fetchLocalMovies(),
            fetchWatchHistory(),
            fetchUserFavorites()
        ]);
        const trending = catalog.status === 'fulfilled' ? (catalog.value.movies || []).map(normalizeMovie) : [];
        const localMovies = local.status === 'fulfilled' ? (local.value.movies || []).map(normalizeMovie) : [];
        const historyList = historyRes.status === 'fulfilled' ? (historyRes.value.history || []) : [];
        const favoritesList = favsRes.status === 'fulfilled' ? (favsRes.value.favorites || []) : [];

        renderHero(homeTab, sections, trending[0]);

        // 1. Continuar Assistindo (histórico entre 10s e 95%)
        const continueWatching = historyList
            .map(h => {
                const pos = h.position ?? h.position_seconds ?? 0;
                const dur = h.duration ?? h.duration_seconds ?? 0;
                const movieId = h.movieId || h.id;
                return {
                    id: movieId,
                    imdbId: movieId,
                    title: h.title,
                    poster: h.poster,
                    position: pos,
                    duration: dur,
                    progressPct: dur > 0 ? Math.min(100, Math.max(1, Math.round((pos / dur) * 100))) : 0
                };
            })
            .filter(h => h.position > 10 && h.duration > 0 && h.position < (h.duration * 0.95));

        renderHistoryRow(sections, {
            key: 'history',
            title: 'Continuar Assistindo',
            movies: continueWatching
        });

        // 2. Minha Lista (Favoritos do usuário)
        const userFavs = favoritesList.map(f => ({
            id: f.movieId || f.id,
            imdbId: f.movieId || f.id,
            title: f.title,
            poster: f.poster,
            year: f.year || '',
            rating: f.rating || ''
        }));

        renderRow(sections, {
            key: 'favorites',
            title: 'Minha Lista',
            linkText: 'Ver catálogo',
            tabIndex: 1,
            movies: userFavs,
            onClick: openStremioDetails
        });

        // 3. Na sua pasta (arquivos baixados)
        renderRow(sections, {
            key: 'local',
            title: 'Na sua pasta',
            linkText: 'Ver tudo',
            tabIndex: 2,
            movies: localMovies,
            onClick: playLocal
        });

        // 4. Em alta (catálogo global)
        renderRow(sections, {
            key: 'trending',
            title: 'Em alta',
            linkText: 'Abrir catálogo',
            tabIndex: 1,
            movies: trending.slice(1),
            onClick: openStremioDetails
        });
    } finally {
        inFlight.delete(view);
    }
}

function playLocal(m) {
    openCinemaPlayer({
        streamUrl: m.streamUrl,
        title: m.title,
        subInfo: [m.quality, m.sizeFormatted].filter(Boolean).join(' • '),
        quality: m.quality || '',
        isLocal: true,
        movieId: m.imdbId || m.id,
        poster: m.poster
    });
}

function renderHero(homeTab, sections, movie) {
    let hero = homeTab.querySelector('.mf-home-hero');
    if (!movie) {
        hero?.remove();
        return;
    }
    if (!hero) {
        hero = document.createElement('div');
        hero.className = 'mf-home-hero';
        homeTab.insertBefore(hero, sections);
    }

    hero.style.backgroundImage = `linear-gradient(90deg, rgba(11,13,18,0.95) 0%, rgba(11,13,18,0.6) 50%, rgba(11,13,18,0.1) 100%), url('${escapeHtml(movie.backdrop)}')`;
    hero.innerHTML = `
        <div class="mf-hero-content">
            <span class="mf-hero-tag">EM ALTA</span>
            <h1 class="mf-hero-title">${escapeHtml(movie.title)}</h1>
            <div class="mf-hero-meta">
                ${movie.year ? `<span>${escapeHtml(movie.year)}</span>` : ''}
                ${movie.rating ? `<span>⭐ ${movie.rating}</span>` : ''}
                ${movie.genres ? `<span>${escapeHtml(movie.genres)}</span>` : ''}
            </div>
            ${movie.description ? `<p class="mf-hero-desc">${escapeHtml(movie.description)}</p>` : ''}
            <div class="mf-hero-buttons">
                <button type="button" class="mf-btn-hero-play focusable">
                    <span class="material-icons">play_arrow</span>Assistir
                </button>
            </div>
        </div>
    `;
    hero.querySelector('.mf-btn-hero-play').addEventListener('click', () => openStremioDetails(movie));
}

function renderRow(sections, { key, title, linkText, tabIndex, movies, onClick }) {
    let row = sections.querySelector(`.mf-home-section[data-mf-row="${key}"]`);
    if (!movies.length) {
        row?.remove();
        return;
    }
    if (!row) {
        row = document.createElement('div');
        row.className = 'verticalSection mf-home-section';
        row.dataset.mfRow = key;
        sections.insertBefore(row, sections.firstElementChild);
    }

    row.innerHTML = `
        <div class="sectionTitleContainer sectionTitleContainer-cards">
            <h2 class="sectionTitle">${escapeHtml(title)}</h2>
            <button type="button" class="mf-btn-see-all focusable">${escapeHtml(linkText)}</button>
        </div>
        <div class="mf-home-scroller"></div>
    `;
    row.querySelector('.mf-btn-see-all').addEventListener('click', () => window.MatheusFlix?.navigateToTab?.(tabIndex));

    const scroller = row.querySelector('.mf-home-scroller');
    movies.forEach(m => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mf-home-card focusable';
        card.title = m.title;
        card.style.cssText = 'color: #ffffff !important; text-align: left !important;';
        card.innerHTML = `
            <div class="mf-home-card-poster-wrap">
                <img class="mf-home-card-poster" src="${escapeHtml(m.poster)}" alt="" loading="lazy" />
                <div class="mf-home-card-play-overlay"><span class="material-icons" style="font-size: 26px; color: #140a02;">play_arrow</span></div>
                ${m.isLocal ? '<span class="mf-badge-on-disk"><span class="material-icons" style="font-size: 13px; vertical-align: middle;">check_circle</span> Na sua pasta</span>' : ''}
            </div>
            <div class="mf-home-card-info" style="padding: 10px 12px; text-align: left; background: rgba(15,18,26,0.95); width: 100%; box-sizing: border-box;">
                <h4 class="mf-home-card-title" style="color: #ffffff !important; font-size: 13px; font-weight: 700; margin: 0 0 4px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(m.title)}</h4>
                <div class="mf-home-card-meta" style="display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1 !important; text-align: left;"><span>${escapeHtml(m.year)}</span>${m.rating ? `<span>⭐ ${m.rating}</span>` : ''}</div>
            </div>
        `;
        card.addEventListener('click', () => onClick(m));
        scroller.appendChild(card);
    });
}

function renderHistoryRow(sections, { key, title, movies }) {
    let row = sections.querySelector(`.mf-home-section[data-mf-row="${key}"]`);
    if (!movies.length) {
        row?.remove();
        return;
    }
    if (!row) {
        row = document.createElement('div');
        row.className = 'verticalSection mf-home-section';
        row.dataset.mfRow = key;
        sections.insertBefore(row, sections.firstElementChild);
    }

    row.innerHTML = `
        <div class="sectionTitleContainer sectionTitleContainer-cards">
            <h2 class="sectionTitle" style="color: #ffffff !important; font-weight: 600;">${escapeHtml(title)}</h2>
        </div>
        <div class="mf-home-scroller"></div>
    `;

    const scroller = row.querySelector('.mf-home-scroller');
    movies.forEach(m => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mf-home-card mf-home-card-history focusable';
        card.title = `${m.title} (${m.progressPct}%)`;
        card.style.cssText = 'color: #ffffff !important; text-align: left !important;';
        const remainingMin = Math.max(1, Math.round((m.duration - m.position) / 60));
        card.innerHTML = `
            <div class="mf-home-card-poster-wrap">
                <img class="mf-home-card-poster" src="${escapeHtml(m.poster)}" alt="" loading="lazy" />
                <button type="button" class="mf-btn-history-remove focusable" title="Dropar filme (Remover de Continuar Assistindo)">
                    <span class="material-icons" style="font-size: 16px;">close</span>
                </button>
                <div class="mf-home-card-play-overlay"><span class="material-icons" style="font-size: 26px; color: #140a02;">play_arrow</span></div>
                <div class="mf-history-bar"><div class="mf-history-bar-fill" style="width: ${m.progressPct}%;"></div></div>
            </div>
            <div class="mf-home-card-info" style="padding: 10px 12px; text-align: left; background: rgba(15,18,26,0.95); width: 100%; box-sizing: border-box;">
                <h4 class="mf-home-card-title" style="color: #ffffff !important; font-size: 13px; font-weight: 700; margin: 0 0 4px 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(m.title)}</h4>
                <div class="mf-home-card-meta" style="display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1 !important; text-align: left;"><span style="color: #ef4444 !important; font-weight: 700;">${m.progressPct}%</span> • <span>Faltam ${remainingMin}m</span></div>
            </div>
        `;

        const btnDrop = card.querySelector('.mf-btn-history-remove');
        if (btnDrop) {
            btnDrop.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await confirmDropMovieModal({ title: m.title });
                if (confirmed) {
                    try {
                        await deleteWatchHistory(m.id || m.movieId);
                        toast(`"${m.title}" removido de Continuar Assistindo.`);
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.85)';
                        setTimeout(() => {
                            card.remove();
                            if (!scroller.querySelector('.mf-home-card')) {
                                row.remove();
                            }
                        }, 200);
                    } catch (err) {
                        toast(`Erro ao remover: ${err.message}`);
                    }
                }
            });
        }

        card.addEventListener('click', () => openStremioDetails({ ...m, resumePosition: m.position }));
        scroller.appendChild(card);
    });
}
