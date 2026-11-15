/**
 * MatheusFlix - Seções extras da tela Início.
 * Destaque no topo + duas fileiras: "Em alta" (catálogo) e "Na sua pasta" (D:\filmes).
 */

import { fetchCatalog, fetchLocalMovies } from './api';
import { openStremioDetails } from './stremioDetail';
import { openCinemaPlayer } from './cinemaPlayer';
import { escapeHtml, normalizeMovie } from './utils';

const inFlight = new WeakSet();

export async function embedMatheusFlixHomeSections(view) {
    if (!view || inFlight.has(view)) return;
    const homeTab = view.querySelector('#homeTab') || view;
    const sections = homeTab.querySelector('.sections');
    if (!sections) return;

    inFlight.add(view);
    try {
        const [catalog, local] = await Promise.allSettled([
            fetchCatalog({ limit: 16, sort: 'trending' }),
            fetchLocalMovies()
        ]);
        const trending = catalog.status === 'fulfilled' ? (catalog.value.movies || []).map(normalizeMovie) : [];
        const localMovies = local.status === 'fulfilled' ? (local.value.movies || []).map(normalizeMovie) : [];

        renderHero(homeTab, sections, trending[0]);
        renderRow(sections, {
            key: 'local',
            title: 'Na sua pasta',
            linkText: 'Ver tudo',
            tabIndex: 2,
            movies: localMovies,
            onClick: playLocal
        });
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
        isLocal: true
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
                <button type="button" class="mf-btn-hero-play">
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
            <button type="button" class="mf-btn-see-all">${escapeHtml(linkText)}</button>
        </div>
        <div class="mf-home-scroller"></div>
    `;
    row.querySelector('.mf-btn-see-all').addEventListener('click', () => window.MatheusFlix?.navigateToTab?.(tabIndex));

    const scroller = row.querySelector('.mf-home-scroller');
    movies.forEach(m => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mf-home-card';
        card.title = m.title;
        card.innerHTML = `
            <div class="mf-home-card-poster-wrap">
                <img class="mf-home-card-poster" src="${escapeHtml(m.poster)}" alt="" loading="lazy" />
                <div class="mf-home-card-play-overlay"><span class="material-icons" style="font-size: 26px; color: #140a02;">play_arrow</span></div>
            </div>
            <div class="mf-home-card-info">
                <h4 class="mf-home-card-title">${escapeHtml(m.title)}</h4>
                <div class="mf-home-card-meta"><span>${escapeHtml(m.year)}</span>${m.rating ? `<span>⭐ ${m.rating}</span>` : ''}</div>
            </div>
        `;
        card.addEventListener('click', () => onClick(m));
        scroller.appendChild(card);
    });
}
