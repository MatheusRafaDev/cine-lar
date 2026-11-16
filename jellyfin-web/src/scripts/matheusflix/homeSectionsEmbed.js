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
import { escapeHtml, normalizeMovie } from './utils';
import toast from 'components/toast/toast';

const inFlight = new WeakSet();

function getMovieKey(m) {
    if (!m) return '';
    const id = m.imdbId || m.id || m.imdb_id;
    if (id && String(id).startsWith('tt')) {
        return String(id).toLowerCase();
    }
    if (m.title) {
        return m.title.trim().toLowerCase();
    }
    return id ? String(id) : '';
}

function filterUniqueCategoryMovies(movies, seenSet, limit = 20, minTarget = 12) {
    const list = [];
    const skipped = [];
    for (const m of movies) {
        if (!m) continue;
        const key = getMovieKey(m);
        if (!key) continue;
        if (!seenSet.has(key)) {
            seenSet.add(key);
            list.push(m);
            if (list.length >= limit) break;
        } else {
            skipped.push(m);
        }
    }
    if (list.length < minTarget && skipped.length > 0) {
        for (const m of skipped) {
            const key = getMovieKey(m);
            if (!list.some(existing => getMovieKey(existing) === key)) {
                list.push(m);
                if (list.length >= minTarget) break;
            }
        }
    }
    return list;
}

export async function embedMatheusFlixHomeSections(view) {
    if (!view || inFlight.has(view)) return;
    const homeTab = view.querySelector('#homeTab') || view;
    const sections = homeTab.querySelector('.sections');
    if (!sections) return;

    // Remove imediatamente quaisquer seções legadas do Jellyfin (Minha mídia e Filmes recentes)
    sections.querySelectorAll('.verticalSection:not(.mf-home-section):not(.mf-home-sections-wrap), [data-type="smalllibrarytiles"], [data-type="latestmedia"], [data-type="librarybuttons"]').forEach((el) => {
        el.remove();
    });

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
            fetchCatalog({ limit: 60, sort: 'trending' }),
            fetchCatalog({ limit: 60, sort: 'newest' }),
            fetchCatalog({ limit: 60, genre: 'Action' }),
            fetchCatalog({ limit: 60, genre: 'Adventure' }),
            fetchCatalog({ limit: 60, genre: 'Comedy' }),
            fetchCatalog({ limit: 60, genre: 'Sci-Fi' }),
            fetchCatalog({ limit: 60, genre: 'Animation' }),
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

        // Registro de filmes já exibidos para evitar qualquer repetição entre as sugestões
        const seenMovieKeys = new Set();

        // Carrossel rotativo no topo: seleciona os principais destaques com backdrop
        const heroMovies = trending.filter(m => m.backdrop && m.backdrop.length > 5);
        const heroSelection = heroMovies.length >= 2 ? heroMovies.slice(0, 6) : trending.slice(0, 5);
        heroSelection.forEach(m => {
            const k = getMovieKey(m);
            if (k) seenMovieKeys.add(k);
        });
        renderHero(homeTab, sections, heroSelection);

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

        continueWatching.forEach(m => {
            const k = getMovieKey(m);
            if (k) seenMovieKeys.add(k);
        });

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

        userFavs.forEach(m => {
            const k = getMovieKey(m);
            if (k) seenMovieKeys.add(k);
        });

        renderRow(wrap, {
            key: 'favorites',
            title: 'Minha Lista',
            linkText: 'Ver catálogo',
            tabIndex: 1,
            movies: userFavs,
            onClick: openStremioDetails
        });

        // 3. Na sua pasta
        localMovies.forEach(m => {
            const k = getMovieKey(m);
            if (k) seenMovieKeys.add(k);
        });

        renderRow(wrap, {
            key: 'local',
            title: 'Na sua pasta',
            linkText: 'Ver tudo',
            tabIndex: 2,
            movies: localMovies,
            onClick: playLocal
        });

        // 4. ✨ Lançamentos (filtrados sem repetição)
        const uniqueNewest = filterUniqueCategoryMovies(newest, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'newest',
            title: '✨ Lançamentos',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueNewest,
            onClick: openStremioDetails
        });

        // 5. 🔥 Em alta no MatheusFlix (filtrados sem repetição)
        const uniqueTrending = filterUniqueCategoryMovies(trending, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'trending',
            title: '🔥 Em alta no MatheusFlix',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueTrending,
            onClick: openStremioDetails
        });

        // 6. 💥 Filmes de Ação (filtrados sem repetição)
        const uniqueAction = filterUniqueCategoryMovies(action, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'action',
            title: '💥 Filmes de Ação',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueAction,
            onClick: openStremioDetails
        });

        // 7. 🏰 Filmes de Aventura (filtrados sem repetição)
        const uniqueAdventure = filterUniqueCategoryMovies(adventure, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'adventure',
            title: '🏰 Aventura & Fantasia',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueAdventure,
            onClick: openStremioDetails
        });

        // 8. 🤣 Comédias (filtrados sem repetição)
        const uniqueComedy = filterUniqueCategoryMovies(comedy, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'comedy',
            title: '🤣 Comédias',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueComedy,
            onClick: openStremioDetails
        });

        // 9. 🚀 Ficção Científica (filtrados sem repetição)
        const uniqueScifi = filterUniqueCategoryMovies(scifi, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'scifi',
            title: '🚀 Ficção Científica',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueScifi,
            onClick: openStremioDetails
        });

        // 10. 🎨 Animação & Família (filtrados sem repetição)
        const uniqueAnim = filterUniqueCategoryMovies(anim, seenMovieKeys, 20);
        renderRow(wrap, {
            key: 'anim',
            title: '🎨 Animação & Família',
            linkText: 'Ver mais',
            tabIndex: 1,
            movies: uniqueAnim,
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

function renderHero(homeTab, sections, movies) {
    let list = [];
    if (Array.isArray(movies)) {
        list = movies.filter(Boolean);
    } else if (movies) {
        list = [movies];
    }
    let hero = homeTab.querySelector('.mf-home-hero');

    if (list.length === 0) {
        if (hero) {
            if (hero._mfStopTimer) hero._mfStopTimer();
            hero.remove();
        }
        return;
    }

    if (!hero) {
        hero = document.createElement('div');
        hero.className = 'mf-home-hero';
        homeTab.insertBefore(hero, sections);
    } else if (hero._mfStopTimer) {
        hero._mfStopTimer();
    }

    hero.innerHTML = `
        <div class="mf-hero-bg-layer" aria-hidden="true"></div>
        ${list.length > 1 ? `
            <button type="button" class="mf-hero-nav mf-hero-prev focusable" aria-label="Filme anterior" title="Anterior">
                <span class="material-icons">chevron_left</span>
            </button>
            <button type="button" class="mf-hero-nav mf-hero-next focusable" aria-label="Próximo filme" title="Próximo">
                <span class="material-icons">chevron_right</span>
            </button>
        ` : ''}
        <div class="mf-hero-content">
            <span class="mf-hero-tag">EM ALTA</span>
            <h1 class="mf-hero-title"></h1>
            <div class="mf-hero-meta"></div>
            <p class="mf-hero-desc"></p>
            <div class="mf-hero-buttons">
                <button type="button" class="mf-btn-hero-play focusable">
                    <span class="material-icons">play_arrow</span>Assistir
                </button>
                <button type="button" class="mf-btn-hero-info focusable">
                    <span class="material-icons">info_outline</span>Mais Informações
                </button>
            </div>
        </div>
        ${list.length > 1 ? `
            <div class="mf-hero-indicators" role="tablist" aria-label="Destaques">
                ${list.map((_, i) => `<button type="button" class="mf-hero-dot focusable${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
            </div>
        ` : ''}
    `;

    const bgLayer = hero.querySelector('.mf-hero-bg-layer');
    const content = hero.querySelector('.mf-hero-content');
    const titleEl = hero.querySelector('.mf-hero-title');
    const metaEl = hero.querySelector('.mf-hero-meta');
    const descEl = hero.querySelector('.mf-hero-desc');
    const playBtn = hero.querySelector('.mf-btn-hero-play');
    const infoBtn = hero.querySelector('.mf-btn-hero-info');
    const prevBtn = hero.querySelector('.mf-hero-prev');
    const nextBtn = hero.querySelector('.mf-hero-next');
    const dots = hero.querySelectorAll('.mf-hero-dot');

    let currentIndex = 0;
    let timer = null;

    function applyMovieData(movie) {
        if (titleEl) titleEl.textContent = movie.title || '';
        if (metaEl) {
            metaEl.innerHTML = [
                movie.year ? `<span>${escapeHtml(movie.year)}</span>` : '',
                movie.rating ? `<span>⭐ ${escapeHtml(movie.rating)}</span>` : '',
                movie.genres ? `<span>${escapeHtml(movie.genres)}</span>` : ''
            ].filter(Boolean).join('');
        }
        if (descEl) {
            descEl.textContent = movie.description || '';
            descEl.style.display = movie.description ? '' : 'none';
        }
    }

    function updateSlide(nextIndex, animate = true) {
        currentIndex = (nextIndex + list.length) % list.length;
        const currentMovie = list[currentIndex];
        if (!currentMovie) return;

        const bgUrl = currentMovie.backdrop || currentMovie.poster || '';
        const bgStyle = `linear-gradient(90deg, rgba(11,13,18,0.96) 0%, rgba(11,13,18,0.7) 48%, rgba(11,13,18,0.15) 100%), linear-gradient(0deg, #0b0d12 0%, rgba(11,13,18,0) 40%), url('${escapeHtml(bgUrl)}')`;

        if (animate && content) {
            content.style.opacity = '0';
            content.style.transform = 'translateY(6px)';
            if (bgLayer) bgLayer.style.opacity = '0.4';

            setTimeout(() => {
                if (bgLayer) {
                    bgLayer.style.backgroundImage = bgStyle;
                    bgLayer.style.opacity = '1';
                }
                applyMovieData(currentMovie);
                content.style.opacity = '1';
                content.style.transform = 'translateY(0)';
            }, 120);
        } else {
            if (bgLayer) bgLayer.style.backgroundImage = bgStyle;
            applyMovieData(currentMovie);
        }

        dots.forEach((dot, idx) => {
            if (idx === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function startTimer() {
        stopTimer();
        if (list.length > 1) {
            timer = setInterval(() => {
                updateSlide(currentIndex + 1, true);
            }, 6500);
        }
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    hero._mfStopTimer = stopTimer;

    const onAction = () => {
        const currentMovie = list[currentIndex];
        if (currentMovie) openStremioDetails(currentMovie);
    };
    if (playBtn) playBtn.addEventListener('click', onAction);
    if (infoBtn) infoBtn.addEventListener('click', onAction);

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateSlide(currentIndex - 1, true);
            startTimer();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateSlide(currentIndex + 1, true);
            startTimer();
        });
    }

    dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(dot.getAttribute('data-index') || '0', 10);
            updateSlide(idx, true);
            startTimer();
        });
    });

    hero.addEventListener('mouseenter', stopTimer);
    hero.addEventListener('mouseleave', () => {
        if (!hero.contains(document.activeElement)) {
            startTimer();
        }
    });
    hero.addEventListener('focusin', stopTimer);
    hero.addEventListener('focusout', (e) => {
        if (!hero.contains(e.relatedTarget)) {
            startTimer();
        }
    });

    updateSlide(0, false);
    startTimer();
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
