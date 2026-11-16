/**
 * MatheusFlix - Fileiras e Categorias da Tela Inicial estilo Netflix.
 * Inclui:
 * 1. Hero em destaque no topo
 * 2. Continuar Assistindo (histórico)
 * 3. Minha Lista (favoritos)
 * 4. Na sua pasta (D:\filmes)
 * 5. ✨ Lançamentos
 * 6. 🔥 Em Alta
 * 7. 💥 Filmes de Ação
 * 8. 🏰 Filmes de Aventura
 * 9. 🤣 Comédias
 * 10. 🚀 Ficção Científica
 * 11. 🎨 Animação & Família
 *
 * Cada fileira possui botões laterais de navegação (< e >) estilo Netflix
 * sem barra de scroll nativa, com suporte perfeito a controle remoto de TV.
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
        const [
            catalogRes,
            newestRes,
            actionRes,
            adventureRes,
            comedyRes,
            scifiRes,
            animRes,
            localRes,
            historyRes,
            favsRes
        ] = await Promise.allSettled([
            fetchCatalog({ limit: 20, sort: 'trending' }),
            fetchCatalog({ limit: 20, sort: 'newest' }),
            fetchCatalog({ limit: 20, genre: 'Action' }),
            fetchCatalog({ limit: 20, genre: 'Adventure' }),
            fetchCatalog({ limit: 20, genre: 'Comedy' }),
            fetchCatalog({ limit: 20, genre: 'Sci-Fi' }),
            fetchCatalog({ limit: 20, genre: 'Animation' }),
            fetchLocalMovies(),
            fetchWatchHistory(),
            fetchUserFavorites()
        ]);

        const trending = catalogRes.status === 'fulfilled' ? (catalogRes.value?.movies || []).map(normalizeMovie) : [];
        const newest = newestRes.status === 'fulfilled' ? (newestRes.value?.movies || []).map(normalizeMovie) : [];
        const action = actionRes.status === 'fulfilled' ? (actionRes.value?.movies || []).map(normalizeMovie) : [];
        const adventure = adventureRes.status === 'fulfilled' ? (adventureRes.value?.movies || []).map(normalizeMovie) : [];
        const comedy = comedyRes.status === 'fulfilled' ? (comedyRes.value?.movies || []).map(normalizeMovie) : [];
        const scifi = scifiRes.status === 'fulfilled' ? (scifiRes.value?.movies || []).map(normalizeMovie) : [];
        const anim = animRes.status === 'fulfilled' ? (animRes.value?.movies || []).map(normalizeMovie) : [];
        const localMovies = localRes.status === 'fulfilled' ? (localRes.value?.movies || []).map(normalizeMovie) : [];
        const historyList = historyRes.status === 'fulfilled' ? (historyRes.value?.history || []) : [];
        const favoritesList = favsRes.status === 'fulfilled' ? (favsRes.value?.favorites || []) : [];

        renderHero(homeTab, sections, trending[0]);

        // Container exclusivo das fileiras do MatheusFlix para preservar a sequência estilo Netflix
        let wrap = sections.querySelector('.mf-home-sections-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'mf-home-sections-wrap';
            sections.insertBefore(wrap, sections.firstElementChild);
        }

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

        renderHistoryRow(wrap, {
            key: 'history',
            title: 'Continuar Assistindo',
            movies: continueWatching
        });

        // 2. Minha Lista (favoritos do usuário)
        const userFavs = favoritesList.map(f => ({
            id: f.movieId || f.id,
            imdbId: f.movieId || f.id,
            title: f.title,
            poster: f.poster,
            year: f.year || '',
            rating: f.rating || ''
        }));
        renderRow(wrap, {
            key: 'favorites',
            title: 'Minha Lista',
            linkText: 'Ver catálogo',
            tabIndex: 1,
            movies: userFavs,
            onClick: openStremioDetails
        });

        // 3. Na sua pasta (D:\filmes)
        renderRow(wrap, {
            key: 'local',
            title: 'Na sua pasta (D:\\filmes)',
            linkText: 'Ver tudo',
            tabIndex: 2,
            movies: localMovies,
            onClick: playLocal
        });

        // 4. ✨ Lançamentos
        renderRow(wrap, {
            key: 'newest',
            title: '✨ Lançamentos',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: newest,
            onClick: openStremioDetails
        });

        // 5. 🔥 Em alta no MatheusFlix
        renderRow(wrap, {
            key: 'trending',
            title: '🔥 Em alta no MatheusFlix',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: trending.slice(1),
            onClick: openStremioDetails
        });

        // 6. 💥 Filmes de Ação
        renderRow(wrap, {
            key: 'action',
            title: '💥 Filmes de Ação',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: action,
            onClick: openStremioDetails
        });

        // 7. 🏰 Filmes de Aventura
        renderRow(wrap, {
            key: 'adventure',
            title: '🏰 Aventura & Fantasia',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: adventure,
            onClick: openStremioDetails
        });

        // 8. 🤣 Comédias
        renderRow(wrap, {
            key: 'comedy',
            title: '🤣 Comédias',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: comedy,
            onClick: openStremioDetails
        });

        // 9. 🚀 Ficção Científica
        renderRow(wrap, {
            key: 'scifi',
            title: '🚀 Ficção Científica',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: scifi,
            onClick: openStremioDetails
        });

        // 10. 🎨 Animação & Família
        renderRow(wrap, {
            key: 'anim',
            title: '🎨 Animação & Família',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: anim,
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

function setupRowSlider(row) {
    const scroller = row.querySelector('.mf-home-scroller');
    const prevBtn = row.querySelector('.mf-slider-prev');
    const nextBtn = row.querySelector('.mf-slider-next');
    if (!scroller || !prevBtn || !nextBtn) return;

    const getScrollStep = () => {
        const firstCard = scroller.querySelector('.mf-home-card');
        const cardWidth = firstCard ? firstCard.getBoundingClientRect().width + 16 : 190;
        return Math.max(cardWidth * 2, scroller.clientWidth * 0.75);
    };

    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scroller.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scroller.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
    });

    const updateVisibility = () => {
        const sl = scroller.scrollLeft;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        prevBtn.classList.toggle('visible', sl > 12);
        nextBtn.classList.toggle('visible', maxScroll - sl > 12);
    };

    scroller.addEventListener('scroll', updateVisibility, { passive: true });
    setTimeout(updateVisibility, 200);
    setTimeout(updateVisibility, 800);
}

function renderRow(container, { key, title, linkText, tabIndex, movies, onClick }) {
    let row = container.querySelector(`.mf-home-section[data-mf-row="${key}"]`);
    if (!movies.length) {
        row?.remove();
        return;
    }
    if (!row) {
        row = document.createElement('div');
        row.className = 'verticalSection mf-home-section';
        row.dataset.mfRow = key;
        container.appendChild(row);
    }

    row.innerHTML = `
        <div class="sectionTitleContainer sectionTitleContainer-cards">
            <h2 class="sectionTitle">${escapeHtml(title)}</h2>
            <button type="button" class="mf-btn-see-all focusable">${escapeHtml(linkText)}</button>
        </div>
        <div class="mf-row-slider-container">
            <button type="button" class="mf-slider-btn mf-slider-prev focusable" aria-label="Voltar" title="Voltar títulos">
                <span class="material-icons">chevron_left</span>
            </button>
            <div class="mf-home-scroller"></div>
            <button type="button" class="mf-slider-btn mf-slider-next focusable" aria-label="Avançar" title="Avançar títulos">
                <span class="material-icons">chevron_right</span>
            </button>
        </div>
    `;

    row.querySelector('.mf-btn-see-all')?.addEventListener('click', () => {
        window.location.hash = `#/home?tab=${tabIndex}`;
    });

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
        card.addEventListener('focus', () => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
        scroller.appendChild(card);
    });

    setupRowSlider(row);
}

function renderHistoryRow(container, { key, title, movies }) {
    let row = container.querySelector(`.mf-home-section[data-mf-row="${key}"]`);
    if (!movies.length) {
        row?.remove();
        return;
    }
    if (!row) {
        row = document.createElement('div');
        row.className = 'verticalSection mf-home-section';
        row.dataset.mfRow = key;
        container.appendChild(row);
    }

    row.innerHTML = `
        <div class="sectionTitleContainer sectionTitleContainer-cards">
            <h2 class="sectionTitle" style="color: #ffffff !important; font-weight: 600;">${escapeHtml(title)}</h2>
        </div>
        <div class="mf-row-slider-container">
            <button type="button" class="mf-slider-btn mf-slider-prev focusable" aria-label="Voltar" title="Voltar títulos">
                <span class="material-icons">chevron_left</span>
            </button>
            <div class="mf-home-scroller"></div>
            <button type="button" class="mf-slider-btn mf-slider-next focusable" aria-label="Avançar" title="Avançar títulos">
                <span class="material-icons">chevron_right</span>
            </button>
        </div>
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
        card.addEventListener('focus', () => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
        scroller.appendChild(card);
    });

    setupRowSlider(row);
}
