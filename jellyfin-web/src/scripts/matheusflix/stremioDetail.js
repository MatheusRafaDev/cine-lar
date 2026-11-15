/**
 * MatheusFlix - Página completa de detalhes do filme (catálogo / torrents / local).
 * Design System unificado, layout cinematográfico imersivo, botão de voltar e filtros de fontes.
 */

import { checkIsFavorite, fetchDownloads, searchTorrents, startDownload, toggleFavorite } from './api';
import { openCinemaPlayer } from './cinemaPlayer';
import { confirmDownloadModal } from './confirmModal';
import { escapeHtml, normalizeMovie, normalizeStream } from './utils';
import toast from 'components/toast/toast';

const MAX_SOURCES = 15;
let activeModal = null;
let activeKeyHandler = null;
let activePopHandler = null;

function closeDetails(triggerBack = true) {
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
}

export async function openStremioDetails(rawMovie) {
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
            <!-- Topbar fixa de vidro fosco -->
            <header class="mf-movie-page-topbar">
                <button type="button" class="mf-movie-page-back-btn mf-stremio-close-btn" title="Voltar (Esc)">
                    <span class="material-icons" style="font-size: 20px;">arrow_back</span>
                    <span>Voltar</span>
                </button>
                <div class="mf-movie-page-top-title">${escapeHtml(movie.title)}</div>
                <div class="mf-topbar-actions">
                    <button type="button" class="mf-btn-topbar-fav mf-btn-fav-toggle" title="Favoritar filme">
                        <span class="material-icons mf-fav-icon">favorite_border</span>
                    </button>
                </div>
            </header>

            <!-- Conteúdo da Página Completa -->
            <div class="mf-movie-page-body mf-stremio-content">
                <!-- Coluna Esquerda: Hero Cinematográfico -->
                <div class="mf-stremio-left" style="background-image: linear-gradient(180deg, rgba(8,10,15,0.7) 0%, rgba(8,10,15,0.96) 65%, #080a0f 100%), url('${escapeHtml(movie.backdrop)}');">
                    <div class="mf-hero-details-container">
                        <div class="mf-stremio-poster-wrap">
                            <div class="mf-poster-glow-container">
                                <img src="${escapeHtml(movie.poster)}" alt="" class="mf-stremio-poster" />
                            </div>
                            <div class="mf-stremio-header-info">
                                <h1 class="mf-stremio-title">${escapeHtml(movie.title)}</h1>
                                <div class="mf-stremio-subinfo">
                                    ${movie.rating ? `<span class="mf-badge-chip mf-badge-rating"><span class="material-icons" style="font-size: 14px; color: #f59e0b;">star</span> ${movie.rating}</span>` : ''}
                                    ${movie.year ? `<span class="mf-badge-chip mf-badge-year">${escapeHtml(movie.year)}</span>` : ''}
                                    ${movie.genres ? movie.genres.split(/[,/]/).slice(0, 3).map(g => `<span class="mf-badge-chip mf-badge-genre">${escapeHtml(g.trim())}</span>`).join('') : ''}
                                    ${movie.franchise ? `<span class="mf-badge-chip mf-badge-franchise">${escapeHtml(movie.franchiseIcon || '🎬')} Coleção ${escapeHtml(movie.franchise)}</span>` : ''}
                                    ${movie.isSeries ? '<span class="mf-badge-chip mf-badge-series">📺 Série</span>' : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Sinopse -->
                        <div class="mf-synopsis-wrap">
                            <h3 class="mf-section-heading">Sinopse</h3>
                            <p class="mf-stremio-synopsis">${escapeHtml(movie.description || 'Sinopse não disponível para este título.')}</p>
                        </div>

                        <!-- Alerta se o filme estiver salvo no disco local -->
                        <div class="mf-local-status-container"></div>

                        <!-- Ações Principais -->
                        <div class="mf-stremio-hero-action">
                            <button type="button" class="mf-btn-hero-watch" disabled>
                                <span class="material-icons" style="font-size: 26px;">play_circle_filled</span>
                                <span class="mf-hero-watch-text">Buscando fontes disponíveis...</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Coluna Direita: Fontes, Filtros & Downloads -->
                <div class="mf-stremio-right">
                    <div class="mf-stremio-streams-header">
                        <div class="mf-streams-header-title">
                            <h3>Fontes de Streaming & Download</h3>
                            <span class="mf-streams-count"></span>
                        </div>
                        <div class="mf-streams-filter-chips">
                            <button type="button" class="mf-filter-chip active" data-filter="all">Todos PT-BR</button>
                            <button type="button" class="mf-filter-chip" data-filter="dub">🇧🇷 Dublado / Dual</button>
                            <button type="button" class="mf-filter-chip" data-filter="1080p">1080p</button>
                            <button type="button" class="mf-filter-chip" data-filter="4k">4K UHD</button>
                        </div>
                    </div>
                    <div class="mf-stremio-streams-list">
                        <div class="mf-streams-loading">
                            <div class="mf-spinner"></div>
                            <p>Procurando as melhores fontes de transmissão...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    activeModal = modalEl;

    modalEl.querySelector('.mf-movie-page-back-btn').addEventListener('click', () => closeDetails(true));
    activeKeyHandler = (e) => {
        if (e.key === 'Escape' && !document.querySelector('.mf-cinema-player')) {
            closeDetails(true);
        }
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
        renderStreams([], movie, modalEl, null, null);
        return;
    }

    try {
        const [data, dlRes] = await Promise.all([
            searchTorrents(movie.imdbId, movie.title),
            fetchDownloads().catch(() => ({ downloads: [] }))
        ]);
        if (activeModal !== modalEl) return;

        // Identifica se este filme já está baixando ou se foi concluído
        const activeDl = (dlRes.downloads || []).find(d =>
            (movie.imdbId && d.imdbId === movie.imdbId)
            || (d.title && movie.title && d.title.toLowerCase().includes(movie.title.toLowerCase()))
        );

        renderStreams(
            (data.torrents || []).map(normalizeStream).filter(s => s.magnet),
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

function renderStreams(streams, movie, modalEl, localFile = null, activeDl = null) {
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
                        <strong>Baixando para D:\\filmes (${activeDl.progress || 0}%)</strong>
                        <span>Você pode assistir em tempo real enquanto baixa, sem travar!</span>
                    </div>
                </div>
                <button type="button" class="mf-btn-watch-while-dl">
                    <span class="material-icons">play_circle_filled</span>
                    <span>Assistir Agora Enquanto Baixa</span>
                </button>
            </div>
        `;

        localStatus.querySelector('.mf-btn-watch-while-dl')?.addEventListener('click', () => {
            openCinemaPlayer({
                streamUrl: activeDl.streamUrl,
                title: movie.title,
                subInfo: `${activeDl.quality || '1080p'} • Baixando em tempo real (${activeDl.progress || 0}%)`,
                quality: activeDl.quality || '1080p',
                isLocal: false,
                infoHash: activeDl.id,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0
            });
        });

        heroBtn.disabled = false;
        heroBtn.className = 'mf-btn-hero-watch mf-btn-watching-dl';
        heroText.textContent = `Assistir Enquanto Baixa (${activeDl.quality || '1080p'})`;
        heroBtn.onclick = () => {
            openCinemaPlayer({
                streamUrl: activeDl.streamUrl,
                title: movie.title,
                subInfo: `${activeDl.quality || '1080p'} • Baixando em tempo real (${activeDl.progress || 0}%)`,
                quality: activeDl.quality || '1080p',
                isLocal: false,
                infoHash: activeDl.id,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0
            });
        };
    } else if (localFile && localStatus) {
        // Se o filme já existe salvo na pasta D:\filmes
        localStatus.innerHTML = `
            <div class="mf-local-alert-banner">
                <span class="material-icons mf-local-alert-icon">folder_special</span>
                <div class="mf-local-alert-text">
                    <strong>Disponível na sua pasta local (D:\\filmes)</strong>
                    <span>Reprodução imediata sem download • ${escapeHtml(localFile.quality)} • ${escapeHtml(localFile.sizeFormatted)} • Sem gastar internet</span>
                </div>
            </div>
        `;

        heroBtn.disabled = false;
        heroBtn.className = 'mf-btn-hero-watch mf-btn-play-local';
        heroText.textContent = movie.resumePosition > 10 ? `Continuar da Pasta Local (${localFile.quality})` : `Assistir da Pasta Local (${localFile.quality})`;
        heroBtn.onclick = () => {
            openCinemaPlayer({
                streamUrl: localFile.streamUrl,
                title: movie.title,
                subInfo: [localFile.quality, localFile.sizeFormatted].filter(Boolean).join(' • '),
                quality: localFile.quality,
                isLocal: true,
                movieId: movie.imdbId || movie.id,
                poster: movie.poster,
                resumePosition: movie.resumePosition || 0
            });
        };
    }

    if (!streams.length && !localFile) {
        listEl.innerHTML = `
            <div class="mf-empty-state" style="padding: 60px 20px; text-align: center; color: #a0a6b5;">
                <span class="material-icons" style="font-size: 48px; color: #64748b; margin-bottom: 12px; display: block;">search_off</span>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #cbd5e1;">Nenhuma fonte em Português (PT-BR) encontrada.</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Fontes exclusivamente em inglês foram ocultadas conforme sua preferência por conteúdo dublado / nacional.</p>
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
        heroText.textContent = movie.resumePosition > 10 ? `Continuar (${best.quality})` : `Assistir (${best.quality})`;
        heroBtn.onclick = () => playStream(best, movie);
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
            localItem.className = 'mf-stream-item mf-stream-item-local';
            localItem.innerHTML = `
                <div class="mf-stream-meta">
                    <div class="mf-stream-badges">
                        <span class="mf-badge-on-disk" style="position: static !important;">
                            <span class="material-icons" style="font-size: 13px; vertical-align: middle;">check_circle</span> Na sua pasta
                        </span>
                        <span class="mf-stream-quality q-local">${escapeHtml(localFile.quality)}</span>
                        <span class="mf-stream-size">${escapeHtml(localFile.sizeFormatted)}</span>
                    </div>
                    <div class="mf-stream-title" style="color: #4ade80; font-weight: 700;">Reproduzir arquivo salvo no computador (D:\\filmes)</div>
                </div>
                <div class="mf-stream-actions">
                    <button type="button" class="mf-btn-stream-play mf-btn-stream-play-local" title="Assistir agora da pasta local">
                        <span class="material-icons">play_arrow</span>
                    </button>
                </div>
            `;
            localItem.addEventListener('click', () => {
                openCinemaPlayer({
                    streamUrl: localFile.streamUrl,
                    title: movie.title,
                    subInfo: [localFile.quality, localFile.sizeFormatted].filter(Boolean).join(' • '),
                    quality: localFile.quality,
                    isLocal: true,
                    movieId: movie.imdbId || movie.id,
                    poster: movie.poster,
                    resumePosition: movie.resumePosition || 0
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
            item.className = 'mf-stream-item';
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
                    <button type="button" class="mf-btn-stream-dl" title="Baixar para D:\\filmes">
                        <span class="material-icons">download</span>
                    </button>
                </div>
            `;

            // Clicar em qualquer lugar da linha do torrent inicia a reprodução imediata!
            item.addEventListener('click', (e) => {
                if (e.target.closest('.mf-btn-stream-dl')) return;
                playStream(stream, movie);
            });

            item.querySelector('.mf-btn-stream-play').addEventListener('click', () => playStream(stream, movie));
            item.querySelector('.mf-btn-stream-dl').addEventListener('click', async (e) => {
                e.stopPropagation();

                let dest = `D:\\filmes\\${movie.title}`;
                if (movie.franchise) {
                    dest = `D:\\filmes\\Franquias\\${movie.franchise}\\${movie.title}`;
                } else if (movie.isSeries) {
                    dest = `D:\\filmes\\Series\\${movie.seriesName || movie.title}\\Temporada ${String(movie.season || 1).padStart(2, '0')}`;
                }

                const confirmed = await confirmDownloadModal({
                    title: movie.title,
                    quality: stream.quality,
                    size: stream.size,
                    destination: dest
                });
                if (!confirmed) return;

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
                    btn.innerHTML = '<span class="material-icons" style="color: #38bdf8;">sync</span>';
                    btn.title = 'Assistir enquanto baixa';
                    btn.disabled = false;
                    btn.onclick = (ev) => {
                        ev.stopPropagation();
                        playStream(stream, movie);
                    };

                    // Atualiza o botão principal Hero e adiciona o banner interativo
                    heroBtn.disabled = false;
                    heroBtn.className = 'mf-btn-hero-watch mf-btn-watching-dl';
                    heroText.textContent = `Assistir Enquanto Baixa (${stream.quality})`;
                    heroBtn.onclick = () => playStream(stream, movie);

                    if (localStatus) {
                        localStatus.innerHTML = `
                            <div class="mf-downloading-alert-banner">
                                <div class="mf-dl-alert-left">
                                    <span class="material-icons mf-dl-spinning-icon">sync</span>
                                    <div class="mf-dl-alert-text">
                                        <strong>Download iniciado para D:\\filmes!</strong>
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
                            playStream(stream, movie);
                        });
                    }

                    toast('Download iniciado para D:\\filmes! Você já pode assistir enquanto baixa.');
                } catch (err) {
                    btn.disabled = false;
                    toast(`Falha no download: ${err.message}`);
                }
            });

            listEl.appendChild(item);
        });
    }

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => {
                c.classList.remove('active');
            });
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter') || 'all';
            updateStreamsList();
        });
    });

    updateStreamsList();
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
