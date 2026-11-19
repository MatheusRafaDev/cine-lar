/**
 * MatheusFlix - Página completa de detalhes do filme (catálogo / torrents / local).
 * Design System unificado, layout cinematográfico imersivo, botão de voltar e filtros de fontes.
 */

import { checkIsFavorite, fetchDownloads, fetchSeriesMeta, searchTorrents, startDownload, toggleFavorite, deleteLocalMovie, deleteWatchHistory } from './api';
import { openCinemaPlayer, closeCinemaPlayer } from './cinemaPlayer';
import { confirmDownloadModal, confirmDeleteFileModal } from './confirmModal';
import { escapeHtml, normalizeMovie, normalizeStream, parseDuration, PLACEHOLDER_POSTER } from './utils';
import toast from 'components/toast/toast';

const MAX_SOURCES = 15;
let activeModal = null;
let activeKeyHandler = null;
let activePopHandler = null;
let lastFocusedElement = null;

function closeDetails(triggerBack = true) {
    closeCinemaPlayer();
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
    }
    if (activeKeyHandler) {
        window.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
    }
    if (activePopHandler) {
        window.removeEventListener('popstate', activePopHandler);
        activePopHandler = null;
    }
    document.body.style.overflow = '';

    if (triggerBack && window.history.state && window.history.state.mfMoviePage) {
        window.history.back();
    }

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function' && lastFocusedElement.isConnected) {
        const elToFocus = lastFocusedElement;
        setTimeout(() => {
            try {
                elToFocus.focus();
            } catch (_) {}
        }, 60);
    }
}

function launchPlayer(config) {
    closeDetails(false);
    openCinemaPlayer(config);
}

export async function openStremioDetails(rawMovie) {
    if (document.activeElement && document.activeElement !== document.body) {
        lastFocusedElement = document.activeElement;
    }

    closeCinemaPlayer();
    closeDetails(false);
    const movie = normalizeMovie(rawMovie);

    // Suporte ao botão Voltar do navegador
    activePopHandler = () => {
        closeDetails(false);
    };
    window.addEventListener('popstate', activePopHandler, { once: true });
    window.history.pushState({ mfMoviePage: true }, '');

    document.body.style.overflow = 'hidden';

    const modalEl = document.createElement('div');
    modalEl.className = 'mf-movie-page mf-stremio-modal mf-stremio-modal-backdrop';
    modalEl.innerHTML = `
        <div class="mf-movie-page-window mf-stremio-window mf-stremio-card">
            <!-- Topbar transparente flutuante padrão Netflix -->
            <header class="mf-movie-page-topbar">
                <button type="button" class="mf-movie-page-back-btn mf-stremio-close-btn focusable" title="Voltar (Esc)" aria-label="Voltar">
                    <span class="material-icons">arrow_back</span>
                    <span>Voltar</span>
                </button>
                <div class="mf-topbar-actions">
                    <button type="button" class="mf-btn-topbar-close mf-stremio-close-btn focusable" title="Fechar (Esc)" aria-label="Fechar">
                        <span class="material-icons">close</span>
                    </button>
                </div>
            </header>

            <!-- Conteúdo da Página Completa -->
            <div class="mf-movie-page-body mf-stremio-content">
                <!-- Coluna Esquerda: Hero Cinematográfico -->
                <div class="mf-stremio-left" style="background-image: linear-gradient(to right, rgba(20,20,20,0.96) 0%, rgba(20,20,20,0.82) 55%, #141414 100%), linear-gradient(to top, #141414 0%, rgba(20,20,20,0.4) 50%, transparent 100%), url('${escapeHtml(movie.backdrop || movie.poster)}');">
                    <div class="mf-hero-details-container">
                        <div class="mf-stremio-poster-wrap">
                            <div class="mf-poster-glow-container">
                                <img src="${escapeHtml(movie.poster || PLACEHOLDER_POSTER)}" alt="Pôster de ${escapeHtml(movie.title)}" class="mf-stremio-poster" onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';" />
                            </div>
                            <div class="mf-stremio-header-info">
                                <h1 class="mf-stremio-title">${escapeHtml(movie.title)}</h1>
                                <div class="mf-stremio-subinfo">
                                    ${movie.rating ? `<span class="mf-netflix-match"><span class="material-icons" style="font-size: 15px; vertical-align: middle; margin-right: 3px;">star</span>${movie.rating}</span>` : ''}
                                    ${movie.year ? `<span class="mf-netflix-year">${escapeHtml(movie.year)}</span>` : ''}
                                    <span class="mf-netflix-badge-hd">1080p</span>
                                    ${movie.genres ? `<span class="mf-netflix-genres">${escapeHtml(movie.genres.split(/[,/]/).slice(0, 3).map(g => g.trim()).join(' • '))}</span>` : ''}
                                    ${movie.franchise ? `<span class="mf-badge-chip mf-badge-franchise"><span class="material-icons" style="font-size: 13px; vertical-align: middle;">collections_bookmark</span> Coleção ${escapeHtml(movie.franchise)}</span>` : ''}
                                    ${movie.isSeries ? '<span class="mf-badge-chip mf-badge-series"><span class="material-icons" style="font-size: 13px; vertical-align: middle;">tv</span> Série</span>' : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Sinopse -->
                        <div class="mf-synopsis-wrap">
                            <p class="mf-stremio-synopsis">${escapeHtml(movie.description || 'Sinopse não disponível para este título.')}</p>
                        </div>

                        <!-- Alerta se o filme estiver salvo no disco local -->
                        <div class="mf-local-status-container"></div>

                        <!-- Acoes Principais Estilo Cinelar TV -->
                        <div class="mf-stremio-hero-action" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:24px 0;">
                            <button type="button" class="mf-btn-hero-watch btn f focusable" style="height:48px;padding:0 26px;border-radius:12px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;" disabled>
                                <span class="material-icons mf-hero-play-icon" style="font-size:20px;">play_arrow</span>
                                <span class="mf-hero-watch-text">Carregando opções...</span>
                            </button>
                            <button type="button" class="btn g mf-btn-trailer focusable" style="height:48px;padding:0 22px;border-radius:12px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
                                <span class="material-icons" style="font-size:18px;">movie</span>
                                <span>Trailer oficial</span>
                            </button>
                            <button type="button" class="btn g mf-btn-fav-toggle focusable" style="height:48px;padding:0 22px;border-radius:12px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;" title="Minha Lista" aria-label="Minha Lista">
                                <span class="material-icons mf-fav-icon" style="font-size:18px;">add</span>
                                <span class="mf-fav-text">Minha lista</span>
                            </button>
                            ${movie.resumePosition ? `
                            <button type="button" class="btn g mf-btn-drop-movie focusable" style="height:48px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:500;display:inline-flex;align-items:center;gap:6px;cursor:pointer;" title="Remover de Continuar Assistindo">
                                <span class="material-icons" style="font-size:18px;">delete_outline</span>
                                <span>Remover</span>
                            </button>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Coluna Direita: Fontes, Filtros & Downloads -->
                <div class="mf-stremio-right">
                    <!-- Seção de Temporadas e Episódios (Para Séries) -->
                    <div class="mf-series-episodes-section hide">
                        <div class="mf-series-season-bar">
                            <span class="mf-series-label">Temporada:</span>
                            <select class="mf-series-season-select focusable"></select>
                        </div>
                        <div class="mf-series-episodes-list"></div>
                    </div>

                    <div class="mf-stremio-streams-header">
                        <div class="mf-streams-header-title">
                            <h3>Fontes de Transmissão</h3>
                            <span class="mf-streams-count"></span>
                        </div>
                        <div class="mf-streams-filter-chips">
                            <button type="button" class="mf-filter-chip focusable active" data-filter="all">Todos PT-BR</button>
                            <button type="button" class="mf-filter-chip focusable" data-filter="dub">Dublado / Dual</button>
                            <button type="button" class="mf-filter-chip focusable" data-filter="1080p">1080p</button>
                            <button type="button" class="mf-filter-chip focusable" data-filter="4k">4K UHD</button>
                        </div>
                    </div>
                    <div class="mf-stremio-streams-list">
                        <div class="mf-streams-loading">
                            <div class="mf-spinner"></div>
                            <p>Buscando opções de reprodução...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    activeModal = modalEl;

    // Foco inicial automático para navegação por controle remoto na TV
    setTimeout(() => {
        const heroWatch = modalEl.querySelector('.mf-btn-hero-watch');
        const backBtn = modalEl.querySelector('.mf-movie-page-back-btn');
        if (heroWatch && !heroWatch.disabled) {
            heroWatch.focus();
        } else if (backBtn) {
            backBtn.focus();
        }
    }, 80);

    modalEl.querySelectorAll('.mf-stremio-close-btn').forEach((btn) => {
        btn.addEventListener('click', () => closeDetails(true));
    });
    activeKeyHandler = (e) => {
        if (['Escape', 'Backspace', 'BrowserBack', 'Back'].includes(e.key) && !document.querySelector('.mf-cinema-player') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            closeDetails(true);
            return;
        }

        const active = document.activeElement;
        const hero = modalEl.querySelector('.mf-btn-hero-watch');
        const backBtn = modalEl.querySelector('.mf-movie-page-back-btn');
        const closeBtn = modalEl.querySelector('.mf-btn-topbar-close');
        const trailerBtn = modalEl.querySelector('.mf-btn-trailer');
        const favBtn = modalEl.querySelector('.mf-btn-fav-toggle');
        const dropBtn = modalEl.querySelector('.mf-btn-drop-movie');
        const firstStream = modalEl.querySelector('.mf-stream-item, .mf-episode-chip');

        if (e.key === 'ArrowDown') {
            if (active === hero || active === trailerBtn || active === favBtn || active === dropBtn) {
                e.preventDefault();
                firstStream?.focus?.();
            } else if (active === backBtn || active === closeBtn) {
                e.preventDefault();
                hero?.focus?.();
            } else if (active?.classList.contains('mf-stream-item')) {
                const next = active.nextElementSibling;
                if (next && next.classList.contains('mf-stream-item')) {
                    e.preventDefault();
                    next.focus();
                }
            }
        } else if (e.key === 'ArrowUp') {
            if (active === firstStream) {
                e.preventDefault();
                hero?.focus?.();
            } else if (active === hero || active === trailerBtn || active === favBtn || active === dropBtn) {
                e.preventDefault();
                backBtn?.focus?.();
            } else if (active?.classList.contains('mf-stream-item')) {
                const prev = active.previousElementSibling;
                if (prev && prev.classList.contains('mf-stream-item')) {
                    e.preventDefault();
                    prev.focus();
                } else {
                    e.preventDefault();
                    hero?.focus?.();
                }
            }
        } else if (e.key === 'ArrowRight') {
            if (active === backBtn) {
                e.preventDefault();
                if (closeBtn) closeBtn.focus();
                else hero?.focus?.();
            } else if (active === hero) {
                e.preventDefault();
                if (trailerBtn) trailerBtn.focus();
                else if (favBtn) favBtn.focus();
                else firstStream?.focus?.();
            } else if (active === trailerBtn) {
                e.preventDefault();
                if (favBtn) favBtn.focus();
                else if (dropBtn) dropBtn.focus();
                else firstStream?.focus?.();
            } else if (active === favBtn) {
                e.preventDefault();
                if (dropBtn) dropBtn.focus();
                else firstStream?.focus?.();
            } else if (active === dropBtn) {
                e.preventDefault();
                firstStream?.focus?.();
            }
        } else if (e.key === 'ArrowLeft') {
            if (active === closeBtn) {
                e.preventDefault();
                backBtn?.focus?.();
            } else if (active === dropBtn) {
                e.preventDefault();
                if (favBtn) favBtn.focus();
                else hero?.focus?.();
            } else if (active === favBtn) {
                e.preventDefault();
                if (trailerBtn) trailerBtn.focus();
                else hero?.focus?.();
            } else if (active === trailerBtn) {
                e.preventDefault();
                hero?.focus?.();
            } else if (active?.classList?.contains('mf-stream-item') || active?.classList?.contains('mf-episode-chip')) {
                e.preventDefault();
                hero?.focus?.();
            } else if (active === hero) {
                e.preventDefault();
                backBtn?.focus?.();
            }
        }
    };
    window.addEventListener('keydown', activeKeyHandler);

    // Configurar botão de trailer oficial
    const btnTrailer = modalEl.querySelector('.mf-btn-trailer');
    if (btnTrailer) {
        btnTrailer.addEventListener('click', (e) => {
            e.stopPropagation();
            const query = encodeURIComponent(`${movie.title} trailer oficial dublado`);
            window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
        });
    }

    // Configurar botão de favoritos (Minha Lista)
    const btnFav = modalEl.querySelector('.mf-btn-fav-toggle');
    const favIcon = modalEl.querySelector('.mf-fav-icon');
    const favText = modalEl.querySelector('.mf-fav-text');
    if (btnFav && movie.imdbId) {
        checkIsFavorite(movie.imdbId).then(res => {
            if (res.favorite) {
                if (favIcon) favIcon.textContent = 'check';
                if (favText) favText.textContent = 'Na minha lista';
                btnFav.classList.add('active');
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
                    if (favIcon) favIcon.textContent = 'check';
                    if (favText) favText.textContent = 'Na minha lista';
                    btnFav.classList.add('active');
                    toast(`"${movie.title}" adicionado à Minha Lista.`);
                } else {
                    if (favIcon) favIcon.textContent = 'add';
                    if (favText) favText.textContent = 'Minha lista';
                    btnFav.classList.remove('active');
                    toast(`"${movie.title}" removido da Minha Lista.`);
                }
            } catch (err) {
                toast(`Erro ao favoritar: ${err.message}`);
            } finally {
                btnFav.disabled = false;
            }
        });
    }

    // Configurar botão de dropar filme (remover de Continuar Assistindo diretamente sem modal)
    const btnDropMovie = modalEl.querySelector('.mf-btn-drop-movie');
    if (btnDropMovie) {
        btnDropMovie.addEventListener('click', async (e) => {
            e.stopPropagation();
            btnDropMovie.disabled = true;
            try {
                await deleteWatchHistory(movie.imdbId || movie.id);
                movie.resumePosition = 0;
                btnDropMovie.style.opacity = '0';
                setTimeout(() => btnDropMovie.remove(), 200);
                toast(`"${movie.title}" removido de Continuar Assistindo.`);
            } catch (err) {
                btnDropMovie.disabled = false;
                toast(`Erro ao remover: ${err.message}`);
            }
        });
    }

    if (!movie.imdbId) {
        renderStreams([], movie, modalEl, null, null);
        return;
    }

    const isSeries = Boolean(movie.isSeries || movie.type === 'series');
    const seriesSection = modalEl.querySelector('.mf-series-episodes-section');

    if (isSeries) {
        seriesSection.classList.remove('hide');
        try {
            const seriesMeta = await fetchSeriesMeta(movie.imdbId);
            const videos = seriesMeta?.meta?.videos || [];

            if (videos.length > 0) {
                const seasonMap = new Map();
                videos.forEach((v) => {
                    const s = v.season || 1;
                    if (!seasonMap.has(s)) {
                        seasonMap.set(s, []);
                    }
                    seasonMap.get(s).push(v);
                });

                const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);
                const seasonSelect = modalEl.querySelector('.mf-series-season-select');
                const epList = modalEl.querySelector('.mf-series-episodes-list');

                seasons.forEach((s) => {
                    const opt = document.createElement('option');
                    opt.value = String(s);
                    opt.textContent = `Temporada ${s} (${seasonMap.get(s).length} eps)`;
                    seasonSelect.appendChild(opt);
                });

                let currentSeason = seasons[0] || 1;
                let currentEp = (seasonMap.get(currentSeason) || [])[0] || { season: 1, number: 1, episode: 1, name: 'Episódio 1' };

                const loadEpisodeTorrents = async (ep) => {
                    const listEl = modalEl.querySelector('.mf-stremio-streams-list');
                    listEl.innerHTML = `
                        <div class="mf-streams-loading">
                            <div class="mf-spinner"></div>
                            <p>Procurando fontes PT-BR para Temporada ${ep.season}, Episódio ${ep.number || ep.episode}...</p>
                        </div>
                    `;
                    try {
                        const [data, dlRes] = await Promise.all([
                            searchTorrents(movie.imdbId, movie.title, {
                                type: 'series',
                                season: ep.season,
                                episode: ep.number || ep.episode
                            }),
                            fetchDownloads().catch(() => ({ downloads: [] }))
                        ]);
                        if (activeModal !== modalEl) return;

                        const activeDl = (dlRes.downloads || []).find((d) =>
                            (movie.imdbId && d.imdbId === movie.imdbId)
                            || (d.title && movie.title && d.title.toLowerCase().includes(movie.title.toLowerCase()))
                        );

                        renderStreams(
                            (data.torrents || []).map(normalizeStream).filter((s) => s.magnet),
                            movie,
                            modalEl,
                            data.localFile,
                            activeDl,
                            ep
                        );
                    } catch {
                        if (activeModal !== modalEl) return;
                        renderStreams([], movie, modalEl, null, null, ep);
                    }
                };

                const renderEpisodesBar = (seasonNum) => {
                    epList.innerHTML = '';
                    const eps = seasonMap.get(seasonNum) || [];
                    eps.sort((a, b) => (a.number || a.episode || 1) - (b.number || b.episode || 1));

                    eps.forEach((ep) => {
                        const epNum = ep.number || ep.episode || 1;
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        const isCurrent = ep === currentEp || epNum === (currentEp.number || currentEp.episode);
                        btn.className = `mf-episode-chip focusable ${isCurrent ? 'active' : ''}`;
                        btn.innerHTML = `
                            <span class="mf-ep-chip-badge">E${String(epNum).padStart(2, '0')}</span>
                            <span class="mf-ep-chip-title">${escapeHtml(ep.name || `Episódio ${epNum}`)}</span>
                        `;
                        btn.addEventListener('click', () => {
                            epList.querySelectorAll('.mf-episode-chip').forEach((c) => {
                                c.classList.remove('active');
                            });
                            btn.classList.add('active');
                            currentEp = ep;
                            loadEpisodeTorrents(currentEp);
                        });
                        epList.appendChild(btn);
                    });
                };

                seasonSelect.addEventListener('change', () => {
                    currentSeason = parseInt(seasonSelect.value, 10) || 1;
                    const eps = seasonMap.get(currentSeason) || [];
                    currentEp = eps[0] || { season: currentSeason, number: 1, episode: 1, name: 'Episódio 1' };
                    renderEpisodesBar(currentSeason);
                    loadEpisodeTorrents(currentEp);
                });

                renderEpisodesBar(currentSeason);
                loadEpisodeTorrents(currentEp);
                return;
            }
        } catch (e) {
            console.warn('[MatheusFlix] Falha ao carregar temporadas da série:', e.message);
        }
    }

    try {
        const [data, dlRes] = await Promise.all([
            searchTorrents(movie.imdbId, movie.title),
            fetchDownloads().catch(() => ({ downloads: [] }))
        ]);
        if (activeModal !== modalEl) return;

        // Identifica se este filme já está baixando ou se foi concluído
        const activeDl = (dlRes.downloads || []).find((d) =>
            (movie.imdbId && d.imdbId === movie.imdbId)
            || (d.title && movie.title && d.title.toLowerCase().includes(movie.title.toLowerCase()))
        );

        renderStreams(
            (data.torrents || []).map(normalizeStream).filter((s) => s.magnet),
            movie,
            modalEl,
            data.localFile,
            activeDl
        );
    } catch {
        if (activeModal !== modalEl) return;
        renderStreams([], movie, modalEl, null, null);
    }
}

function renderStreams(streams, movie, modalEl, localFile = null, activeDl = null, currentEp = null) {
    const listEl = modalEl.querySelector('.mf-stremio-streams-list');
    const countEl = modalEl.querySelector('.mf-streams-count');
    const heroBtn = modalEl.querySelector('.mf-btn-hero-watch');
    const heroText = modalEl.querySelector('.mf-hero-watch-text');
    const localStatus = modalEl.querySelector('.mf-local-status-container');
    const filterChips = modalEl.querySelectorAll('.mf-filter-chip');

    // Se o filme já está sendo baixado no momento para D:\filmes
    if (activeDl && activeDl.status === 'downloading' && localStatus) {
        localStatus.innerHTML = `
            <div class="mf-downloading-alert-banner">
                <div class="mf-dl-alert-left">
                    <span class="material-icons mf-dl-spinning-icon">sync</span>
                    <div class="mf-dl-alert-text">
                        <strong>Baixando para a pasta local (${activeDl.progress || 0}%)</strong>
                    </div>
                </div>
                <button type="button" class="mf-btn-watch-while-dl">
                    <span class="material-icons">play_arrow</span>
                    <span>Assistir</span>
                </button>
            </div>
        `;

        localStatus.querySelector('.mf-btn-watch-while-dl')?.addEventListener('click', () => {
            launchPlayer({
                streamUrl: activeDl.streamUrl,
                title: movie.title,
                subInfo: `${activeDl.quality || '1080p'} • Baixando (${activeDl.progress || 0}%)`,
                quality: activeDl.quality || '1080p',
                isLocal: false,
                infoHash: activeDl.id,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0,
                duration: parseDuration(movie)
            });
        });

        heroBtn.disabled = false;
        heroBtn.className = 'mf-btn-hero-watch mf-btn-watching-dl';
        heroText.textContent = `Assistir (${activeDl.quality || '1080p'})`;
        heroBtn.onclick = () => {
            launchPlayer({
                streamUrl: activeDl.streamUrl,
                title: movie.title,
                subInfo: `${activeDl.quality || '1080p'} • Baixando (${activeDl.progress || 0}%)`,
                quality: activeDl.quality || '1080p',
                isLocal: false,
                infoHash: activeDl.id,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0,
                duration: parseDuration(movie)
            });
        };
    } else if (localFile && localStatus) {
        // Se o filme já existe salvo na pasta local
        localStatus.innerHTML = `
            <div class="mf-local-alert-banner">
                <div class="mf-local-alert-pill">
                    <span class="material-icons" style="font-size: 15px;">folder_special</span>
                    <span>Acervo Local</span>
                </div>
                <div class="mf-local-alert-text">
                    <strong>Arquivo salvo no computador (${escapeHtml(localFile.quality)})</strong>
                    <span>Reprodução instantânea de alta fidelidade sem internet · ${escapeHtml(localFile.sizeFormatted)}</span>
                </div>
            </div>
        `;

        heroBtn.disabled = false;
        heroBtn.className = 'mf-btn-hero-watch mf-btn-play-local';
        heroText.textContent = movie.resumePosition > 10 ? `Continuar Assistindo (${localFile.quality})` : `Assistir Agora (${localFile.quality})`;
        heroBtn.onclick = () => {
            launchPlayer({
                streamUrl: localFile.streamUrl,
                title: movie.title,
                subInfo: [localFile.quality, localFile.sizeFormatted].filter(Boolean).join(' • '),
                quality: localFile.quality,
                isLocal: true,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0,
                duration: parseDuration(localFile) || parseDuration(movie)
            });
        };
    }

    if (!streams.length && !localFile) {
        listEl.innerHTML = `
            <div class="mf-empty-state" style="padding: 60px 20px; text-align: center; color: #a0a6b5;">
                <span class="material-icons" style="font-size: 48px; color: #64748b; margin-bottom: 12px; display: block;">search_off</span>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #cbd5e1;">Nenhuma fonte em Português (PT-BR) encontrada.</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Tente novamente mais tarde ou altere o filtro de reprodução.</p>
            </div>
        `;
        countEl.textContent = '';
        heroText.textContent = 'Indisponível em PT-BR';
        return;
    }

    if (!localFile && !activeDl) {
        const best = streams.find(s => s.isDubbed && /1080p/i.test(s.quality) && s.seeders > 0)
            || streams.find(s => s.isDubbed && s.seeders > 0)
            || streams.find(s => /1080p/i.test(s.quality) && s.seeders > 0)
            || streams.find(s => s.seeders > 0)
            || streams[0];

        heroBtn.disabled = false;
        const watchLabel = currentEp ?
            `Assistir T${currentEp.season}E${currentEp.number || currentEp.episode} (${best.quality})` :
            `Assistir (${best.quality})`;
        heroText.textContent = movie.resumePosition > 10 ? `Continuar (${best.quality})` : watchLabel;
        heroBtn.onclick = () => playStream(best, movie, currentEp);
    }

    let currentFilter = 'all';

    function updateStreamsList() {
        let filtered = streams;
        if (currentFilter === 'dub') {
            filtered = streams.filter(s => s.isDubbed);
        } else if (currentFilter === '1080p') {
            filtered = streams.filter(s => /1080p/i.test(s.quality));
        } else if (currentFilter === '4k') {
            filtered = streams.filter(s => /4k|2160p/i.test(s.quality));
        }

        const shown = filtered.slice(0, MAX_SOURCES);
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'fonte PT-BR' : 'fontes PT-BR'}`;

        listEl.innerHTML = '';

        // Exibe arquivo local no topo se aplicável
        if (localFile && (currentFilter === 'all' || currentFilter === 'pt')) {
            const localItem = document.createElement('div');
            localItem.className = 'mf-stream-item mf-stream-item-local focusable';
            localItem.setAttribute('tabindex', '0');
            localItem.setAttribute('role', 'button');
            localItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    localItem.click();
                }
            });
            localItem.innerHTML = `
                <div class="mf-stream-meta">
                    <div class="mf-stream-badges">
                        <span class="mf-badge-on-disk" style="position: static !important;">
                            <span class="material-icons" style="font-size: 13px; vertical-align: middle;">download_done</span> Arquivo Salvo
                        </span>
                        <span class="mf-stream-quality q-local">${escapeHtml(localFile.quality)}</span>
                        <span class="mf-stream-size">${escapeHtml(localFile.sizeFormatted)}</span>
                    </div>
                    <div class="mf-stream-title" style="color: #FAF9F5; font-weight: 600;">Reprodução direta do disco (Sem consumo de rede)</div>
                </div>
                <div class="mf-stream-actions">
                    <button type="button" class="mf-btn-stream-play mf-btn-stream-play-local focusable" title="Assistir arquivo local">
                        <span class="material-icons">play_arrow</span>
                    </button>
                    <button type="button" class="mf-btn-stream-delete-local focusable" title="Excluir arquivo do computador">
                        <span class="material-icons" style="font-size: 18px;">delete_outline</span>
                    </button>
                </div>
            `;
            const btnDelLocal = localItem.querySelector('.mf-btn-stream-delete-local');
            if (btnDelLocal) {
                btnDelLocal.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const confirmed = await confirmDeleteFileModal({ title: movie.title });
                    if (confirmed) {
                        btnDelLocal.disabled = true;
                        try {
                            await deleteLocalMovie(localFile.videoPath || localFile.path || localFile.file);
                            toast(`"${movie.title}" foi excluído do computador.`);
                            localFile = null;
                            localItem.remove();
                            updateStreamsList();
                        } catch (err) {
                            btnDelLocal.disabled = false;
                            toast(`Erro ao excluir: ${err.message}`);
                        }
                    }
                });
            }

            localItem.addEventListener('click', () => {
                launchPlayer({
                    streamUrl: localFile.streamUrl,
                    title: movie.title,
                    subInfo: [localFile.quality, localFile.sizeFormatted].filter(Boolean).join(' • '),
                    quality: localFile.quality,
                    isLocal: true,
                    movieId: movie.imdbId || movie.id,
                    poster: movie.poster,
                    resumePosition: movie.resumePosition || 0,
                    duration: (localFile && localFile.duration) || movie.duration || (movie.runtime ? movie.runtime * 60 : 0)
                });
            });
            listEl.appendChild(localItem);
        }

        if (!shown.length && !localFile) {
            listEl.innerHTML = `
                <div class="mf-empty-state" style="padding: 40px 20px; text-align: center; color: #a0a6b5;">
                    <p style="margin: 0; font-size: 14px;">Nenhuma fonte encontrada para o filtro selecionado.</p>
                </div>
            `;
            return;
        }

        shown.forEach((stream) => {
            const item = document.createElement('div');
            item.className = 'mf-stream-item focusable';
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    playStream(stream, movie, currentEp);
                }
            });
            const is4k = /4k|2160p/i.test(stream.quality);
            const is1080 = /1080p/i.test(stream.quality);
            let qualityClass = 'q-720p';
            if (is4k) {
                qualityClass = 'q-4k';
            } else if (is1080) {
                qualityClass = 'q-1080p';
            }

            item.innerHTML = `
                <div class="mf-stream-meta">
                    <div class="mf-stream-badges">
                        <span class="mf-stream-quality ${qualityClass}">${escapeHtml(stream.quality)}</span>
                        ${stream.isDubbed ? '<span class="mf-stream-audio-dub"><span class="material-icons" style="font-size: 11px; vertical-align: middle;">mic</span> DUBLADO / DUAL</span>' : '<span class="mf-stream-audio-pt"><span class="material-icons" style="font-size: 11px; vertical-align: middle;">subtitles</span> LEGENDA PT-BR</span>'}
                        ${stream.size ? `<span class="mf-stream-size">${escapeHtml(stream.size)}</span>` : ''}
                        <span class="mf-stream-seeds"><span class="mf-seed-dot"></span>${stream.seeders} seeds</span>
                    </div>
                    <div class="mf-stream-title" title="${escapeHtml(stream.label)}">${escapeHtml(stream.label)}</div>
                </div>
                <div class="mf-stream-actions">
                    <button type="button" class="mf-btn-stream-play" title="Assistir agora">
                        <span class="material-icons">play_arrow</span>
                    </button>
                    <button type="button" class="mf-btn-stream-dl" title="Baixar para sua pasta">
                        <span class="material-icons">download</span>
                    </button>
                </div>
            `;

            // Clicar em qualquer lugar da linha do torrent inicia a reprodução imediata!
            item.addEventListener('click', (e) => {
                if (e.target.closest('.mf-btn-stream-dl')) return;
                playStream(stream, movie, currentEp);
            });

            item.querySelector('.mf-btn-stream-play').addEventListener('click', () => playStream(stream, movie, currentEp));
            const dlBtn = item.querySelector('.mf-btn-stream-dl');
            dlBtn?.addEventListener('click', async (e) => {
                e.stopPropagation();

                const btn = dlBtn;
                let dest = `MatheusFlix\\${movie.title}`;
                if (currentEp) {
                    const sStr = String(currentEp.season || 1).padStart(2, '0');
                    const eStr = String(currentEp.number || currentEp.episode || 1).padStart(2, '0');
                    dest = `MatheusFlix\\Series\\${movie.seriesName || movie.title}\\Temporada ${sStr}\\${movie.title} S${sStr}E${eStr}`;
                } else if (movie.franchise) {
                    dest = `MatheusFlix\\Franquias\\${movie.franchise}\\${movie.title}`;
                } else if (movie.isSeries) {
                    dest = `MatheusFlix\\Series\\${movie.seriesName || movie.title}\\Temporada ${String(movie.season || 1).padStart(2, '0')}`;
                }

                const confirmed = await confirmDownloadModal({
                    title: movie.title,
                    quality: stream.quality,
                    size: stream.size,
                    destination: dest
                });
                if (!confirmed) return;

                if (btn) btn.disabled = true;
                try {
                    await startDownload({
                        magnet: stream.magnet,
                        imdbId: movie.imdbId,
                        title: currentEp ? `${movie.title} S${String(currentEp.season || 1).padStart(2, '0')}E${String(currentEp.number || currentEp.episode || 1).padStart(2, '0')}` : movie.title,
                        quality: stream.quality,
                        filename: stream.label
                    });
                    if (btn) {
                        btn.innerHTML = '<span class="material-icons" style="color: #38bdf8;">sync</span>';
                        btn.title = 'Assistir enquanto baixa';
                        btn.disabled = false;
                        btn.onclick = (ev) => {
                            ev.stopPropagation();
                            playStream(stream, movie, currentEp);
                        };
                    }

                    // Atualiza o botão principal Hero e adiciona o banner interativo
                    if (heroBtn) {
                        heroBtn.disabled = false;
                        heroBtn.className = 'mf-btn-hero-watch mf-btn-watching-dl';
                        heroBtn.onclick = () => playStream(stream, movie, currentEp);
                    }
                    if (heroText) {
                        heroText.textContent = `Assistir Enquanto Baixa (${stream.quality})`;
                    }

                    if (localStatus) {
                        localStatus.innerHTML = `
                            <div class="mf-downloading-alert-banner">
                                <div class="mf-dl-alert-left">
                                    <span class="material-icons mf-dl-spinning-icon">sync</span>
                                    <div class="mf-dl-alert-text">
                                        <strong>Download iniciado na sua pasta!</strong>
                                        <span>Você não precisa esperar terminar. Dê play agora mesmo!</span>
                                    </div>
                                </div>
                                <button type="button" class="mf-btn-watch-while-dl">
                                    <span class="material-icons">play_circle_filled</span>
                                    <span>Assistir Agora Enquanto Baixa</span>
                                </button>
                            </div>
                        `;
                        localStatus.querySelector('.mf-btn-watch-while-dl')?.addEventListener('click', () => {
                            playStream(stream, movie, currentEp);
                        });
                    }

                    toast('Download iniciado na sua pasta! Você já pode assistir enquanto baixa.');
                } catch (err) {
                    if (btn) btn.disabled = false;
                    toast(`Falha no download: ${err.message}`);
                }
            });

            listEl.appendChild(item);
        });
    }

    filterChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            filterChips.forEach((c) => {
                c.classList.remove('active');
            });
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter') || 'all';
            updateStreamsList();
        });
    });

    updateStreamsList();

    // Foco automático de TV no botão principal de Assistir
    setTimeout(() => {
        heroBtn?.focus?.();
    }, 150);
}

function playStream(stream, movie, currentEp = null) {
    const hashMatch = (stream.magnet || '').match(/btih:([a-f0-9]{40}|[a-z2-7]{32})/i);
    const infoHash = (stream.infoHash || (hashMatch && hashMatch[1]) || '').toLowerCase();

    if (!infoHash) {
        toast('Fonte inválida. Escolha outra.');
        return;
    }

    const titleDisplay = currentEp ?
        `${movie.title} - T${currentEp.season}E${currentEp.number || currentEp.episode}: ${currentEp.name || 'Episódio'}` :
        movie.title;

    launchPlayer({
        streamUrl: `/api/stream/${infoHash}?magnet=${encodeURIComponent(stream.magnet)}&title=${encodeURIComponent(titleDisplay)}`,
        title: titleDisplay,
        subInfo: [stream.quality, stream.size, stream.isPortuguese ? 'PT-BR' : ''].filter(Boolean).join(' • '),
        quality: stream.quality,
        isLocal: false,
        infoHash,
        movieId: movie.imdbId || movie.id,
        poster: movie.poster,
        resumePosition: movie.resumePosition || 0,
        duration: parseDuration(movie)
    });
}
