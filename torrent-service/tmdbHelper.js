import https from 'https';

const cache = new Map();

function getTmdbKey() {
    return (process.env.TMDB_API_KEY || '').trim();
}

function fetchJson(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'MatheusFlix/2.0' } }, (res) => {
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
 * Busca título e sinopse oficiais do filme ou série em Português do Brasil (PT-BR) via TMDB por IMDb ID.
 * @param {string} imdbId - ex: 'tt0468569'
 * @returns {Promise<{ titleBr: string, originalTitle: string, overviewBr: string } | null>}
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

            if (titleBr.length > 0) {
                const info = { titleBr, originalTitle, overviewBr };
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
 * Busca filme diretamente por título no TMDB em Português do Brasil.
 * @param {string} query
 * @param {number|null} year
 * @returns {Promise<{ titleBr: string, originalTitle: string, overviewBr: string, poster: string, backdrop: string, rating: number, year: number } | null>}
 */
export async function searchPtBrMovie(query, year = null) {
    if (!query || query.trim().length < 2) return null;
    const apiKey = getTmdbKey();
    if (!apiKey) return null;
    const cacheKey = `search_${query.toLowerCase().trim()}_${year || ''}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
        let url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query.trim())}&language=pt-BR`;
        if (year) url += `&year=${year}`;
        const data = await fetchJson(url);
        const res = data?.results?.[0];
        if (res && res.title) {
            const info = {
                titleBr: res.title.trim(),
                originalTitle: (res.original_title || res.title).trim(),
                overviewBr: (res.overview || '').trim(),
                poster: res.poster_path ? `https://image.tmdb.org/t/p/w500${res.poster_path}` : '',
                backdrop: res.backdrop_path ? `https://image.tmdb.org/t/p/w1280${res.backdrop_path}` : '',
                rating: res.vote_average ? parseFloat(res.vote_average.toFixed(1)) : 8.0,
                year: res.release_date ? parseInt(res.release_date.slice(0, 4), 10) : year
            };
            cache.set(cacheKey, info);
            return info;
        }
    } catch (e) {
        console.debug('[TMDB] Falha na busca por nome:', query, e.message);
    }

    cache.set(cacheKey, null);
    return null;
}
