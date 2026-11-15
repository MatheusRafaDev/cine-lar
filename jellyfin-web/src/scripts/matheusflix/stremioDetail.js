/**
 * MatheusFlix - Detalhes do filme (catálogo / torrents).
 * Um botão principal "Assistir" (melhor fonte) e uma lista curta de fontes alternativas.
 */

import { checkIsFavorite, searchTorrents, startDownload, toggleFavorite } from './api';
import { openCinemaPlayer } from './cinemaPlayer';
import { escapeHtml, normalizeMovie, normalizeStream } from './utils';
import toast from 'components/toast/toast';

const MAX_SOURCES = 12;
let activeModal = null;
let activeKeyHandler = null;

function closeDetails() {
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
    }
    if (activeKeyHandler) {
        window.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
    }
}

export async function openStremioDetails(rawMovie) {
    closeDetails();
    const movie = normalizeMovie(rawMovie);

    const modalEl = document.createElement('div');
    modalEl.className = 'mf-stremio-modal-backdrop';
    modalEl.innerHTML = `
        <div class="mf-stremio-card">
            <button type="button" class="mf-stremio-close-btn" title="Fechar (Esc)">✕</button>
            <div class="mf-stremio-left" style="background-image: linear-gradient(180deg, rgba(13,16,24,0.4) 0%, rgba(13,16,24,0.95) 85%), url('${escapeHtml(movie.backdrop)}');">
                <div class="mf-stremio-poster-wrap">
                    <img src="${escapeHtml(movie.poster)}" alt="" class="mf-stremio-poster" />
                    <div class="mf-stremio-header-info">
                        <h2>${escapeHtml(movie.title)}</h2>
                        <div class="mf-stremio-subinfo">
                            ${movie.year ? `<span class="mf-badge-year">${escapeHtml(movie.year)}</span>` : ''}
                            ${movie.rating ? `<span class="mf-badge-rating">⭐ ${movie.rating}</span>` : ''}
                            ${movie.genres ? `<span class="mf-badge-genres">${escapeHtml(movie.genres)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <p class="mf-stremio-synopsis">${escapeHtml(movie.description || 'Sinopse não disponível.')}</p>
                <div class="mf-stremio-hero-action" style="display: flex; gap: 12px; align-items: center;">
                    <button type="button" class="mf-btn-hero-watch" disabled>
                        <span class="material-icons">play_arrow</span>
                        <span class="mf-hero-watch-text">Buscando fontes...</span>
                    </button>
                    <button type="button" class="mf-btn-fav-toggle" title="Adicionar aos Favoritos" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <span class="material-icons mf-fav-icon">favorite_border</span>
                    </button>
                </div>
            </div>
            <div class="mf-stremio-right">
                <div class="mf-stremio-streams-header">
                    <h3>Fontes</h3>
                    <span class="mf-streams-count" style="font-size: 13px; color: #8c93a4;"></span>
                </div>
                <div class="mf-stremio-streams-list">
                    <div class="mf-streams-loading"><p>Procurando fontes...</p></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    activeModal = modalEl;

    modalEl.querySelector('.mf-stremio-close-btn').addEventListener('click', closeDetails);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeDetails();
    });
    activeKeyHandler = (e) => {
        if (e.key === 'Escape' && !document.querySelector('.mf-cinema-player')) closeDetails();
    };
    window.addEventListener('keydown', activeKeyHandler);

    // Configurar botão de favoritos
    const btnFav = modalEl.querySelector('.mf-btn-fav-toggle');
    const favIcon = modalEl.querySelector('.mf-fav-icon');
    if (btnFav && movie.imdbId) {
        checkIsFavorite(movie.imdbId).then(res => {
            if (res.favorite) {
                favIcon.textContent = 'favorite';
                favIcon.style.color = '#ef4444';
            }
        }).catch(() => {
            // Ignore failure on favorite check
        });

        btnFav.addEventListener('click', async (e) => {
            e.stopPropagation();
            btnFav.disabled = true;
            try {
                const res = await toggleFavorite({
                    id: movie.imdbId,
                    title: movie.title,
                    poster: movie.poster,
                    year: movie.year,
                    rating: movie.rating
                });
                if (res.favorite) {
                    favIcon.textContent = 'favorite';
                    favIcon.style.color = '#ef4444';
                    toast(`"${movie.title}" adicionado aos Favoritos!`);
                } else {
                    favIcon.textContent = 'favorite_border';
                    favIcon.style.color = '#fff';
                    toast(`"${movie.title}" removido dos Favoritos.`);
                }
            } catch (err) {
                toast(`Erro ao favoritar: ${err.message}`);
            } finally {
                btnFav.disabled = false;
            }
        });
    }

    if (!movie.imdbId) {
        renderStreams([], movie, modalEl);
        return;
    }

    try {
        const data = await searchTorrents(movie.imdbId, movie.title);
        if (activeModal !== modalEl) return; // usuário já fechou
        renderStreams((data.torrents || []).map(normalizeStream).filter(s => s.magnet), movie, modalEl);
    } catch {
        if (activeModal !== modalEl) return;
        renderStreams([], movie, modalEl);
    }
}

function renderStreams(streams, movie, modalEl) {
    const listEl = modalEl.querySelector('.mf-stremio-streams-list');
    const countEl = modalEl.querySelector('.mf-streams-count');
    const heroBtn = modalEl.querySelector('.mf-btn-hero-watch');
    const heroText = modalEl.querySelector('.mf-hero-watch-text');

    if (!streams.length) {
        listEl.innerHTML = '<div class="mf-empty-state" style="padding: 40px 20px; text-align: center; color: #a0a6b5;"><p>Nenhuma fonte encontrada para este filme.</p></div>';
        countEl.textContent = '';
        heroText.textContent = 'Indisponível';
        return;
    }

    // Prioriza 1080p dublado/legendado PT com mais sementes (backend já ordena PT + seeders).
    const best = streams.find(s => /1080p/i.test(s.quality) && s.seeders > 0)
        || streams.find(s => s.seeders > 0)
        || streams[0];

    heroBtn.disabled = false;
    heroText.textContent = movie.resumePosition > 10 ? `Continuar (${best.quality})` : `Assistir (${best.quality})`;
    heroBtn.onclick = () => playStream(best, movie);

    const shown = streams.slice(0, MAX_SOURCES);
    countEl.textContent = streams.length > MAX_SOURCES ? `${MAX_SOURCES} melhores de ${streams.length}` : `${streams.length}`;

    listEl.innerHTML = '';
    shown.forEach((stream) => {
        const item = document.createElement('div');
        item.className = 'mf-stream-item';
        item.innerHTML = `
            <div class="mf-stream-meta">
                <div class="mf-stream-badges">
                    <span class="mf-stream-quality">${escapeHtml(stream.quality)}</span>
                    ${stream.isPortuguese ? '<span class="mf-stream-audio-pt">PT-BR</span>' : ''}
                    ${stream.size ? `<span class="mf-stream-size">${escapeHtml(stream.size)}</span>` : ''}
                    <span class="mf-stream-seeds">${stream.seeders} seeds</span>
                </div>
                <div class="mf-stream-title" title="${escapeHtml(stream.label)}">${escapeHtml(stream.label)}</div>
            </div>
            <div class="mf-stream-actions">
                <button type="button" class="mf-btn-stream-play" title="Assistir agora">
                    <span class="material-icons" style="font-size: 18px;">play_arrow</span>
                </button>
                <button type="button" class="mf-btn-stream-dl" title="Baixar para D:\\filmes">
                    <span class="material-icons" style="font-size: 18px;">download</span>
                </button>
            </div>
        `;

        item.querySelector('.mf-btn-stream-play').addEventListener('click', () => playStream(stream, movie));
        item.querySelector('.mf-btn-stream-dl').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                await startDownload({
                    magnet: stream.magnet,
                    imdbId: movie.imdbId,
                    title: movie.title,
                    quality: stream.quality,
                    filename: stream.label
                });
                btn.innerHTML = '<span class="material-icons" style="font-size: 18px; color: #4ade80;">check</span>';
                toast(`Baixando "${movie.title}" — acompanhe em Minha Pasta.`);
            } catch (err) {
                btn.disabled = false;
                toast(`Não foi possível iniciar o download: ${err.message}`);
            }
        });

        listEl.appendChild(item);
    });
}

function playStream(stream, movie) {
    const hashMatch = stream.magnet.match(/btih:([a-f0-9]{40}|[a-z2-7]{32})/i);
    const infoHash = (stream.infoHash || (hashMatch && hashMatch[1]) || '').toLowerCase();

    if (!infoHash) {
        toast('Fonte inválida. Escolha outra.');
        return;
    }

    openCinemaPlayer({
        streamUrl: `/api/stream/${infoHash}?magnet=${encodeURIComponent(stream.magnet)}&title=${encodeURIComponent(movie.title)}`,
        title: movie.title,
        subInfo: [stream.quality, stream.size, stream.isPortuguese ? 'PT-BR' : ''].filter(Boolean).join(' • '),
        quality: stream.quality,
        isLocal: false,
        infoHash,
        movieId: movie.imdbId || movie.id,
        poster: movie.poster,
        resumePosition: movie.resumePosition || 0
    });
}
