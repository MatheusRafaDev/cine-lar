import https from 'https';

const cache = new Map();

function getTmdbKey() {
    return (process.env.TMDB_API_KEY || '').trim();
}

function fetchJson(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'MatheusFlix/2.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve);
            }
            if (res.statusCode !== 200) {
                return resolve(null);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(6000, () => {
            req.destroy();
            resolve(null);
        });
    });
}

/**
 * Gera variações inteligentes de busca para encontrar capas mesmo em arquivos
 * com prefixos de coleções, curtas, numerações ou palavras coladas.
 */
export function buildSearchCandidates(rawQuery) {
    if (!rawQuery) return [];
    const base = String(rawQuery)
        .replace(/([a-zA-ZÀ-ÿ])(19\d\d|20\d\d)\b/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (!base) return [];

    const candidates = [];
    const addCandidate = (q) => {
        const clean = String(q || '').replace(/^[\s\-\:\.]+|[\s\-\:\.]+$/g, '').replace(/\s+/g, ' ').trim();
        if (clean.length >= 2 && !candidates.some(c => c.toLowerCase() === clean.toLowerCase())) {
            candidates.push(clean);
        }
    };

    addCandidate(base);

    // 1. Remover prefixo de coleção/curtas/numeração: ex. "Toy Story Curtas 2 Férias no Havaí" -> "Férias no Havaí"
    const strippedShort = base.replace(/^.*?\b(?:curtas?|toons?|shorts?|epis[oó]dio|ep|vol(?:ume)?|parte?)\s*\d*[\s\-\:\.]*/i, '');
    if (strippedShort && strippedShort.toLowerCase() !== base.toLowerCase()) {
        addCandidate(strippedShort);
    }

    // 2. Separar sufixos compostos comuns (ex: "Festassauro Rex" -> "Festa Sauro Rex")
    const splitCompound = (str) => str.replace(/([a-zA-ZÀ-ÿ]{3,}?)ssauro\b/gi, '$1 Sauro');
    addCandidate(splitCompound(base));
    if (strippedShort) addCandidate(splitCompound(strippedShort));

    // 3. Se tiver prefixo de franquia + subtítulo longo, testar "<2 primeiras palavras> <última palavra>" (ex: "Toy Story Rex")
    const words = base.split(' ').filter(Boolean);
    if (words.length >= 4) {
        addCandidate(`${words[0]} ${words[1]} ${words[words.length - 1]}`);
        addCandidate(`${words[0]} ${words[1]}`);
    }

    return candidates;
}

/**
 * Busca título, sinopse e capa oficiais do filme ou série em Português do Brasil (PT-BR) via TMDB por IMDb ID.
 * @param {string} imdbId - ex: 'tt0468569'
 */
export async function fetchPtBrMetadata(imdbId) {
    if (!imdbId || !String(imdbId).startsWith('tt')) return null;
    const apiKey = getTmdbKey();
    if (!apiKey) return null;

    const id = String(imdbId).trim();
    if (cache.has(id)) {
        return cache.get(id);
    }

    try {
        const url = `https://api.themoviedb.org/3/find/${id}?api_key=${encodeURIComponent(apiKey)}&external_source=imdb_id&language=pt-BR`;
        const data = await fetchJson(url);
        const result = data?.movie_results?.[0] || data?.tv_results?.[0];

        if (result) {
            const titleBr = (result.title || result.name || '').trim();
            const originalTitle = (result.original_title || result.original_name || '').trim();
            const overviewBr = (result.overview || '').trim();
            const poster = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '';
            const backdrop = result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : poster;
            const releaseDate = result.release_date || result.first_air_date || '';
            const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
            const rating = result.vote_average ? parseFloat(Number(result.vote_average).toFixed(1)) : null;

            if (titleBr.length > 0 || poster) {
                const info = { titleBr, originalTitle, overviewBr, poster, backdrop, year, rating, imdbId: id };
                cache.set(id, info);
                return info;
            }
        }
    } catch (e) {
        console.debug('[TMDB] Falha ao traduzir filme:', id, e.message);
    }

    cache.set(id, null);
    return null;
}

/**
 * Busca filme, curta ou especial diretamente por título (TMDB multi-search + Cinemeta + Apple iTunes BR fallback).
 * Sempre prioriza resultados que possuam imagem de capa (poster).
 * @param {string} query
 * @param {number|null} year
 */
export async function searchPtBrMovie(query, year = null) {
    if (!query || query.trim().length < 2) return null;
    const cacheKey = `search_${query.toLowerCase().trim()}_${year || ''}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const apiKey = getTmdbKey();
    const candidates = buildSearchCandidates(query);

    // 1. Busca principal e multi-search no TMDB (PT-BR)
    if (apiKey) {
        for (const candidate of candidates) {
            const urlsToTry = [];
            if (year) {
                urlsToTry.push(`https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(candidate)}&language=pt-BR&year=${year}`);
            }
            urlsToTry.push(`https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(candidate)}&language=pt-BR`);
            urlsToTry.push(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(candidate)}&language=pt-BR`);

            for (const url of urlsToTry) {
                try {
                    const data = await fetchJson(url);
                    const results = Array.isArray(data?.results) ? data.results : [];
                    const hit = results.find(r => r && r.poster_path && (r.title || r.name)) || results[0];
                    if (hit && hit.poster_path && (hit.title || hit.name)) {
                        const releaseDate = hit.release_date || hit.first_air_date || '';
                        const info = {
                            titleBr: (hit.title || hit.name).trim(),
                            originalTitle: (hit.original_title || hit.original_name || hit.title || hit.name).trim(),
                            overviewBr: (hit.overview || '').trim(),
                            poster: `https://image.tmdb.org/t/p/w500${hit.poster_path}`,
                            backdrop: hit.backdrop_path ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}` : `https://image.tmdb.org/t/p/w500${hit.poster_path}`,
                            rating: hit.vote_average ? parseFloat(Number(hit.vote_average).toFixed(1)) : 8.0,
                            year: releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : year
                        };
                        cache.set(cacheKey, info);
                        return info;
                    }
                } catch (_) {}
            }
        }
    }

    // 2. Fallback automático: Cinemeta Catalog Search (não requer chave de API)
    for (const candidate of candidates) {
        try {
            const data = await fetchJson(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(candidate)}.json`);
            const metas = Array.isArray(data?.metas) ? data.metas : [];
            const hit = metas.find(m => m && (m.poster || m.imdb_id)) || null;
            if (hit) {
                const posterUrl = hit.poster || (hit.imdb_id ? `https://images.metahub.space/poster/small/${hit.imdb_id}/img` : '');
                if (posterUrl) {
                    const info = {
                        imdbId: hit.imdb_id || '',
                        titleBr: (hit.name || candidate).trim(),
                        originalTitle: (hit.name || candidate).trim(),
                        overviewBr: (hit.description || '').trim(),
                        poster: posterUrl,
                        backdrop: hit.background || posterUrl,
                        rating: parseFloat(hit.imdbRating) || 8.0,
                        year: parseInt(hit.releaseInfo || hit.year, 10) || year
                    };
                    cache.set(cacheKey, info);
                    return info;
                }
            }
        } catch (_) {}
    }

    // 3. Fallback automático: Apple iTunes Brazil Movie Search (capas oficiais PT-BR em alta resolução sem chave)
    for (const candidate of candidates) {
        try {
            const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(candidate)}&media=movie&country=BR&limit=5`);
            const results = Array.isArray(data?.results) ? data.results : [];
            const hit = results.find(r => r && r.artworkUrl100);
            if (hit) {
                const hiResPoster = hit.artworkUrl100.replace(/100x100bb/i, '600x900bb');
                const info = {
                    titleBr: (hit.trackName || candidate).trim(),
                    originalTitle: (hit.trackName || candidate).trim(),
                    overviewBr: (hit.longDescription || hit.shortDescription || '').trim(),
                    poster: hiResPoster,
                    backdrop: hiResPoster,
                    rating: 8.0,
                    year: hit.releaseDate ? parseInt(String(hit.releaseDate).slice(0, 4), 10) : year
                };
                cache.set(cacheKey, info);
                return info;
            }
        } catch (_) {}
    }

    cache.set(cacheKey, null);
    return null;
}
