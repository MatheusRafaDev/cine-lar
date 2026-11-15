import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import WebTorrent from 'webtorrent';
import { initDb, upsertMovie, searchCatalog, getGenresSummary, getUserFavorites, isUserFavorite, toggleUserFavorite, updateWatchProgress, getWatchHistory } from './db.js';
import { seedCatalog, scanLocalMovies } from './seeder.js';
import { askAiMovieRecommendations } from './aiSearch.js';
import { getLocalLibrary, streamLocalVideo } from './localScanner.js';
import { getOrganizedDownloadPath, groupMediaLibrary } from './organizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8085;
const SAVE_PATH = process.env.SAVE_PATH || 'D:\\filmes';
const JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://localhost:8096';
const JELLYFIN_USER = process.env.JELLYFIN_USER || 'rafae';
const JELLYFIN_PW = process.env.JELLYFIN_PW || '10092004';

// Initialize SQLite database
initDb();

// Ensure save path directory exists
try {
    if (!fs.existsSync(SAVE_PATH)) {
        fs.mkdirSync(SAVE_PATH, { recursive: true });
    }
} catch (e) {
    console.warn(`[TorrentService] Could not verify save path "${SAVE_PATH}":`, e.message);
}

// Torrent Client
const client = new WebTorrent();
client.on('error', (err) => {
    console.error('[WebTorrent] Global error:', err.message);
});

// Downloads registry: infoHash -> meta info
const downloadsRegistry = new Map();
const DOWNLOADS_FILE = path.join(__dirname, 'downloads.json');

// Load saved downloads history if available
try {
    if (fs.existsSync(DOWNLOADS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(DOWNLOADS_FILE, 'utf8'));
        if (Array.isArray(saved)) {
            saved.forEach(item => {
                downloadsRegistry.set(item.id, item);
            });
        }
    }
} catch (e) {
    console.warn('[TorrentService] Could not load downloads history:', e.message);
}

function persistDownloads() {
    try {
        const list = Array.from(downloadsRegistry.values()).map(d => ({
            id: d.id,
            imdbId: d.imdbId,
            title: d.title,
            quality: d.quality,
            status: d.status,
            downloaded: d.downloaded || '0 MB',
            total: d.total || '0 MB',
            progress: d.progress || 0,
            completedAt: d.completedAt || null,
            createdAt: d.createdAt || new Date().toISOString()
        }));
        fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
        console.error('[TorrentService] Error persisting downloads:', e.message);
    }
}

// Public trackers list for magnet generation (atualizado sem trackers mortos e com trackers rápidos)
const DEFAULT_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://open.tracker.cl:1337/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://explodie.org:6969/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.theoks.net:6969/announce'
];

// Helper para localizar instâncias de ffmpeg disponíveis no sistema
const FFMPEG_CANDIDATES = [
    process.env.FFMPEG_PATH,
    'C:\\Program Files\\Jellyfin\\Server\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg'
].filter(Boolean);

let RESOLVED_FFMPEG = null;
for (const p of FFMPEG_CANDIDATES) {
    if (p === 'ffmpeg') {
        RESOLVED_FFMPEG = 'ffmpeg';
        break;
    }
    if (fs.existsSync(p)) {
        RESOLVED_FFMPEG = p;
        break;
    }
}
if (RESOLVED_FFMPEG) {
    console.log(`[TorrentService] FFmpeg detectado para suporte a áudio/transcode: "${RESOLVED_FFMPEG}"`);
}

/**
 * Busca um torrent ativo de forma segura e síncrona/imediata pela lista em memória
 */
function getActiveTorrent(hash) {
    if (!hash) return null;
    const clean = hash.trim().toLowerCase();
    return client.torrents.find(t => (t.infoHash && t.infoHash.toLowerCase() === clean)) || null;
}

/**
 * Seleciona o arquivo principal de vídeo do torrent (maior arquivo de vídeo, ignorando samples)
 */
function selectBestVideoFile(files) {
    if (!files || !files.length) return null;
    const videoExts = /\.(mp4|mkv|webm|avi|mov|m4v|ts)$/i;
    const videoFiles = files.filter(f => videoExts.test(f.name) && !/sample/i.test(f.name));
    if (videoFiles.length > 0) {
        return videoFiles.reduce((prev, curr) => (curr.length > prev.length ? curr : prev));
    }
    // Fallback: qualquer vídeo mesmo com sample no nome
    const anyVideo = files.filter(f => videoExts.test(f.name));
    if (anyVideo.length > 0) {
        return anyVideo.reduce((prev, curr) => (curr.length > prev.length ? curr : prev));
    }
    return files[0];
}

/**
 * Prioriza o download sequencial das peças do arquivo de vídeo
 * para garantir que o usuário consiga assistir enquanto baixa (progressive streaming).
 */
function prioritizeVideoForStreaming(torrent, file) {
    if (!torrent || !file) return;
    try {
        file.select();
        const startPiece = file._startPiece || 0;
        const endPiece = file._endPiece || (torrent.pieces ? torrent.pieces.length - 1 : 0);

        // Marca as primeiras 16 peças como críticas (cabeçalho, metadados e primeiros minutos de filme)
        const firstBatchEnd = Math.min(startPiece + 16, endPiece);
        if (typeof torrent.critical === 'function' && firstBatchEnd >= startPiece) {
            torrent.critical(startPiece, firstBatchEnd);
        }

        // Marca as últimas 8 peças como críticas (índice moov de MP4 / seek table)
        const lastBatchStart = Math.max(startPiece, endPiece - 8);
        if (typeof torrent.critical === 'function' && lastBatchStart <= endPiece) {
            torrent.critical(lastBatchStart, endPiece);
        }

        console.log(`[TorrentService] ⚡ Peças priorizadas para streaming imediato: ${startPiece}..${firstBatchEnd} e ${lastBatchStart}..${endPiece}`);
    } catch (e) {
        console.warn('[TorrentService] prioritizeVideoForStreaming warning:', e.message);
    }
}

function buildMagnet(infoHash, name, extraTrackers = []) {
    let magnet = `magnet:?xt=urn:btih:${infoHash}`;
    if (name) magnet += `&dn=${encodeURIComponent(name)}`;
    const trackers = Array.from(new Set([...DEFAULT_TRACKERS, ...(extraTrackers || [])]));
    trackers.forEach(tr => {
        magnet += `&tr=${encodeURIComponent(tr)}`;
    });
    return magnet;
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ms) {
    if (!ms || isNaN(ms) || ms === Infinity || ms <= 0) return 'Calculando...';
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// HTTP request helper
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const clientLib = url.startsWith('https') ? https : http;
        const req = clientLib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 MatheusFlix/2.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(12000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

// Jellyfin Library Refresh
async function refreshJellyfinLibrary() {
    console.log('[TorrentService] Triggering Jellyfin library refresh...');
    try {
        const authPayload = JSON.stringify({ Username: JELLYFIN_USER, Pw: JELLYFIN_PW });
        const authRes = await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8096,
                path: '/Users/AuthenticateByName',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emby-Authorization': 'MediaBrowser Client="MatheusFlix TorrentService", Device="Node", DeviceId="matheusflix_torrent", Version="2.0.0"'
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.write(authPayload);
            req.end();
        });

        const token = authRes?.AccessToken;
        if (!token) {
            console.warn('[TorrentService] Could not authenticate with Jellyfin for library refresh');
            return;
        }

        const refreshReq = http.request({
            hostname: 'localhost',
            port: 8096,
            path: '/Library/Refresh',
            method: 'POST',
            headers: {
                'X-Emby-Token': token
            }
        }, (res) => {
            console.log('[TorrentService] Jellyfin library refresh status:', res.statusCode);
        });
        refreshReq.on('error', (e) => console.warn('[TorrentService] Error requesting library refresh:', e.message));
        refreshReq.end();
    } catch (e) {
        console.error('[TorrentService] Failed to trigger library refresh:', e.message);
    }
}

async function getJellyfinAdminToken() {
    try {
        const authPayload = JSON.stringify({ Username: JELLYFIN_USER, Pw: JELLYFIN_PW });
        return await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8096,
                path: '/Users/AuthenticateByName',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emby-Authorization': 'MediaBrowser Client="MatheusFlix Backend", Device="Node", DeviceId="matheusflix_backend", Version="2.0.0"'
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json?.AccessToken || null);
                    } catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.write(authPayload);
            req.end();
        });
    } catch {
        return null;
    }
}

async function createJellyfinUserProfile(name) {
    const token = await getJellyfinAdminToken();
    if (!token) throw new Error('Não foi possível autenticar como administrador no Jellyfin');

    const newUser = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8096,
            path: '/Users/New',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Emby-Token': token
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ Name: name }));
        req.end();
    });

    if (newUser?.Id) {
        // Desoculta o perfil para aparecer na tela inicial estilo Netflix
        await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8096,
                path: `/Users/${newUser.Id}/Policy`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Emby-Token': token
                }
            }, () => resolve());
            req.on('error', () => resolve());
            req.write(JSON.stringify({
                ...(newUser.Policy || {}),
                IsHidden: false
            }));
            req.end();
        });
    }

    return newUser;
}

/**
 * Cruza a lista de filmes do catálogo com a biblioteca local (D:\filmes)
 * garantindo que qualquer filme já baixado seja sinalizado com is_local: 1
 */
async function markLocalMoviesInList(movieList) {
    if (!movieList || !movieList.length) return;
    try {
        const localMovies = await getLocalLibrary(SAVE_PATH, false);
        const localImdbSet = new Set(localMovies.map(m => m.imdbId).filter(Boolean));
        const localTitlesSet = new Set(localMovies.map(m => (m.cleanName || m.title || '').toLowerCase().trim()).filter(Boolean));

        movieList.forEach(m => {
            const id = m.imdb_id || m.imdbId || m.id;
            const title = (m.title || m.name || m.original_title || '').toLowerCase().trim();
            if ((id && localImdbSet.has(id)) || (title && localTitlesSet.has(title))) {
                m.is_local = 1;
                m.isLocal = true;
            }
        });
    } catch {
        // Fallback silently
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Emby-Token');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:8085'}`);
    const pathname = urlObj.pathname;

    try {
        // Status endpoint
        if (pathname === '/api/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                status: 'online',
                savePath: SAVE_PATH,
                activeTorrents: client.torrents.length,
                totalDownloads: downloadsRegistry.size,
                qbittorrentInstalled: fs.existsSync('C:\\Program Files\\qBittorrent\\qbittorrent.exe')
            }));
            return;
        }

        // User Favorites & Continuar Assistindo (Netflix style)
        if (pathname === '/api/user/favorites' && req.method === 'GET') {
            const userId = urlObj.searchParams.get('userId') || 'default';
            const favorites = getUserFavorites(userId);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ favorites }));
            return;
        }

        if (pathname === '/api/user/favorites/check' && req.method === 'GET') {
            const userId = urlObj.searchParams.get('userId') || 'default';
            const movieId = urlObj.searchParams.get('movieId');
            const favorite = isUserFavorite(userId, movieId);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ favorite }));
            return;
        }

        if (pathname === '/api/user/favorites/toggle' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { userId = 'default', movie } = data;
                    const result = toggleUserFavorite(userId, movie);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(result));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        if (pathname === '/api/user/history' && req.method === 'GET') {
            const userId = urlObj.searchParams.get('userId') || 'default';
            const history = getWatchHistory(userId);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ history }));
            return;
        }

        if (pathname === '/api/user/progress' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { userId = 'default', movieId, title, poster, position, duration } = data;
                    updateWatchProgress(userId, movieId, title, poster, position, duration);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Perfis de usuários estilo Netflix
        if (pathname === '/api/user/profiles' && req.method === 'GET') {
            try {
                const publicUsers = await fetchJson(`${JELLYFIN_URL}/Users/Public`);
                const profiles = (publicUsers || []).map(u => ({
                    id: u.Id,
                    name: u.Name,
                    hasPassword: Boolean(u.HasPassword),
                    isAdmin: Boolean(u.Policy?.IsAdministrator)
                }));
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ profiles }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        if (pathname === '/api/user/profiles/create' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const name = (data.name || '').trim();
                    if (!name) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Nome de perfil inválido' }));
                        return;
                    }
                    const newUser = await createJellyfinUserProfile(name);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, profile: { id: newUser.Id, name: newUser.Name } }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Genres endpoint
        if (pathname === '/api/genres' && req.method === 'GET') {
            const genres = getGenresSummary();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ genres }));
            return;
        }

        // AI Movie Search & Semantic Recommendations
        if ((pathname === '/api/ai/search' || pathname === '/api/ai-search') && (req.method === 'GET' || req.method === 'POST')) {
            let query = urlObj.searchParams.get('q') || urlObj.searchParams.get('prompt') || '';

            const handleAi = async (qText) => {
                if (!qText) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Query parameter q or prompt is required' }));
                    return;
                }
                try {
                    const result = await askAiMovieRecommendations(qText);
                    const movies = Array.isArray(result) ? result : (result.movies || []);
                    const reasoning = result.reasoning || '';
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ query: qText, movies, reasoning }));
                } catch (err) {
                    console.error('[TorrentService] AI search error:', err.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            };

            if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const parsed = JSON.parse(body || '{}');
                        handleAi(parsed.prompt || parsed.q || query);
                    } catch (e) {
                        handleAi(query);
                    }
                });
            } else {
                handleAi(query);
            }
            return;
        }

        // Unified Catalog Search & Filtering (Movies + Series)
        if ((pathname === '/api/movies' || pathname === '/api/catalog') && req.method === 'GET') {
            const type = urlObj.searchParams.get('type') || 'movie';
            const q = urlObj.searchParams.get('q') || '';
            const genre = urlObj.searchParams.get('genre') || 'all';
            const year = urlObj.searchParams.get('year') || 'all';
            const sort = urlObj.searchParams.get('sort') || 'trending';
            const limit = parseInt(urlObj.searchParams.get('limit'), 10) || 40;
            const offset = parseInt(urlObj.searchParams.get('offset'), 10) || 0;

            if (type === 'series') {
                try {
                    let seriesUrl;
                    const cleanQ = q.trim();
                    if (cleanQ.length > 0) {
                        seriesUrl = `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(cleanQ)}.json`;
                    } else if (genre && genre !== 'all') {
                        seriesUrl = `https://v3-cinemeta.strem.io/catalog/series/top/genre=${encodeURIComponent(genre)}.json`;
                    } else {
                        seriesUrl = 'https://cinemeta-catalogs.strem.io/top/catalog/series/top.json';
                    }

                    console.log(`[TorrentService] Buscando catálogo de séries em: ${seriesUrl}`);
                    const cinemeta = await fetchJson(seriesUrl);
                    let metas = (cinemeta?.metas || []).map(m => ({
                        id: m.imdb_id || m.id,
                        imdb_id: m.imdb_id || m.id,
                        title: m.name,
                        name: m.name,
                        year: m.releaseInfo || m.year,
                        poster: m.poster,
                        backdrop: m.background || m.poster,
                        description: m.description,
                        genres: Array.isArray(m.genres) ? m.genres.join(', ') : (m.genres || 'Série'),
                        rating: m.imdbRating || (m.popularities?.moviedb ? (m.popularities.moviedb / 10).toFixed(1) : '8.0'),
                        type: 'series',
                        isSeries: true
                    }));

                    const total = metas.length;
                    if (offset > 0 || metas.length > limit) {
                        metas = metas.slice(offset, offset + limit);
                    }

                    await markLocalMoviesInList(metas);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        movies: metas,
                        total,
                        limit,
                        offset,
                        type: 'series'
                    }));
                    return;
                } catch (e) {
                    console.error('[TorrentService] Erro ao buscar séries:', e.message);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ movies: [], total: 0, limit, offset, type: 'series', error: e.message }));
                    return;
                }
            }

            const results = searchCatalog({ q, genre, year, sort, limit, offset });

            // If empty and search query provided, try live search
            if (results.movies.length === 0 && q.trim().length > 1) {
                try {
                    const searchUrl = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`;
                    const cinemeta = await fetchJson(searchUrl);
                    if (cinemeta?.metas && Array.isArray(cinemeta.metas)) {
                        cinemeta.metas.forEach(m => upsertMovie(m));
                        // Re-query
                        const freshResults = searchCatalog({ q, genre, year, sort, limit, offset });
                        await markLocalMoviesInList(freshResults.movies);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify(freshResults));
                        return;
                    }
                } catch (e) {
                    // Fall through to existing results
                }
            }

            await markLocalMoviesInList(results.movies);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(results));
            return;
        }

        // Metadados de Séries (Temporadas e Episódios)
        if (pathname === '/api/series/meta' && req.method === 'GET') {
            const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('imdbId');
            if (!id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Parameter id is required' }));
                return;
            }
            try {
                const metaUrl = `https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(id)}.json`;
                console.log(`[TorrentService] Buscando temporadas/episódios da série: ${id}`);
                const data = await fetchJson(metaUrl);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(data));
                return;
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
        }

        // Trending Movies (Backward-compatible, powered by SQLite)
        if (pathname === '/api/movies/trending' && req.method === 'GET') {
            const genre = urlObj.searchParams.get('genre') || 'all';
            const year = urlObj.searchParams.get('year') || 'all';
            const sort = urlObj.searchParams.get('sort') || 'trending';

            const results = searchCatalog({ genre, year, sort, limit: 50, offset: 0 });
            await markLocalMoviesInList(results.movies);

            // If database still seeding and has few movies, fetch live Cinemeta
            if (results.movies.length < 5) {
                try {
                    const cinemeta = await fetchJson('https://cinemeta-catalogs.strem.io/top/catalog/movie/top.json');
                    const movies = (cinemeta.metas || []).map(m => {
                        upsertMovie(m);
                        return {
                            imdb_id: m.imdb_id,
                            name: m.name,
                            year: m.releaseInfo || m.year,
                            poster: m.poster,
                            description: m.description,
                            genres: m.genres || [],
                            rating: m.imdbRating || (m.popularities?.moviedb ? (m.popularities.moviedb / 10).toFixed(1) : null)
                        };
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ movies }));
                    return;
                } catch (err) {}
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ movies: results.movies }));
            return;
        }

        // Search Movies (FTS5 + Live Fallback)
        if (pathname === '/api/movies/search' && req.method === 'GET') {
            const query = urlObj.searchParams.get('q');
            if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Query parameter q is required' }));
                return;
            }

            const results = searchCatalog({ q: query, limit: 40 });

            if (results.movies.length < 5) {
                try {
                    const searchUrl = `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`;
                    const cinemeta = await fetchJson(searchUrl);
                    if (cinemeta?.metas) {
                        cinemeta.metas.forEach(m => upsertMovie(m));
                        const fresh = searchCatalog({ q: query, limit: 40 });
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ movies: fresh.movies }));
                        return;
                    }
                } catch (err) {}
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ movies: results.movies }));
            return;
        }

        // Trigger manual catalog sync
        if (pathname === '/api/movies/sync' && req.method === 'POST') {
            seedCatalog(SAVE_PATH).catch(console.error);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Sincronização de catálogo iniciada' }));
            return;
        }

        // Search Torrents for a Movie or Series
        if ((pathname === '/api/torrents/search' || pathname === '/api/torrents') && req.method === 'GET') {
            const imdb = urlObj.searchParams.get('imdb') || urlObj.searchParams.get('imdbId');
            const titleParam = (urlObj.searchParams.get('title') || '').trim();
            const type = urlObj.searchParams.get('type') || 'movie';
            const season = urlObj.searchParams.get('season');
            const episode = urlObj.searchParams.get('episode');
            if (!imdb) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Parameter imdb is required' }));
                return;
            }

            try {
                const isSeries = type === 'series' || (season !== null && episode !== null);
                const sNum = parseInt(season, 10) || 1;
                const eNum = parseInt(episode, 10) || 1;
                const streamPath = isSeries ? `series/${imdb}:${sNum}:${eNum}` : `movie/${imdb}`;

                console.log(`[TorrentService] Buscando torrents no Torrentio (PT-BR) para: ${streamPath}`);
                const [allStreamsRes, ptStreamsRes, brProvidersRes] = await Promise.allSettled([
                    fetchJson(`https://torrentio.strem.fun/stream/${streamPath}.json`),
                    fetchJson(`https://torrentio.strem.fun/language=portuguese/stream/${streamPath}.json`),
                    fetchJson(`https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,comando,bludv|language=portuguese/stream/${streamPath}.json`)
                ]);

                if (allStreamsRes.status === 'rejected') {
                    console.warn(`[TorrentService] Torrentio (geral) falhou: ${allStreamsRes.reason?.message}`);
                }
                if (ptStreamsRes.status === 'rejected') {
                    console.warn(`[TorrentService] Torrentio (PT) falhou: ${ptStreamsRes.reason?.message}`);
                }

                function isTorrentPortuguese(s) {
                    const name = s.name || '';
                    const title = s.title || '';
                    const filename = s.behaviorHints?.filename || '';
                    const full = `${name} ${title} ${filename}`;

                    // Rastreadores ou tags brasileiras inequívocas
                    const isBrTracker = /⚙️\s*(Comando|BluDV|Lapumia|Vizer|MegaFilmes|BaixarFilme|ThePirateFilmes|StarckFilmes)/i.test(full);
                    const hasPtFlag = /🇧🇷|🇵🇹/.test(full);
                    const hasPtWord = /dublado|áudio dublado|audio dublado|nacional|portuguese|português|portugues|brazilian|brasil|\bpt-br\b|\bptbr\b|\bpt-pt\b|\blegenda\b|\blegendado\b/i.test(full);

                    // Se tiver 'dual' ou 'dual audio', só vale se tiver indicação de português (bandeira ou palavra PT) ou tracker BR
                    const isDualAudio = /dual[\s\-\.]*audio|dual[\s\-\.]*áudio|\bdual\b/i.test(full);
                    if (isDualAudio && (hasPtFlag || hasPtWord || isBrTracker)) {
                        return { isPt: true, isDubbed: true };
                    }

                    if (isBrTracker) {
                        return { isPt: true, isDubbed: /dublado|dual/i.test(full) };
                    }

                    // Se tiver indicador explícito de PT
                    if (hasPtFlag || hasPtWord) {
                        // Excluir falsos positivos de línguas que não têm áudio/legenda PT
                        if (/hindi|telugu|tamil|rutracker/i.test(full) && !hasPtFlag && !/dublado/i.test(full)) {
                            return { isPt: false, isDubbed: false };
                        }
                        const isDubbed = /dublado|áudio dublado|audio dublado|nacional/i.test(full) || isDualAudio;
                        return { isPt: true, isDubbed };
                    }

                    return { isPt: false, isDubbed: false };
                }

                const streamMap = new Map();

                const processStreams = (streams) => {
                    if (!Array.isArray(streams)) return;
                    for (const s of streams) {
                        if (!s.infoHash) continue;
                        const key = s.infoHash.toLowerCase();
                        if (streamMap.has(key)) continue;

                        const { isPt, isDubbed } = isTorrentPortuguese(s);
                        // Filtro estrito: Se for exclusivamente gringo/inglês, nem aparece!
                        if (!isPt) continue;

                        const fullText = `${s.name || ''} ${s.title || ''}`;
                        const seedsMatch = s.title?.match(/👤\s*(\d+)/);
                        const seeders = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;

                        const sizeMatch = s.title?.match(/💾\s*([\d\.]+\s*[GMK]B)/i);
                        const size = sizeMatch ? sizeMatch[1] : '';

                        const providerMatch = s.title?.match(/⚙️\s*([^\n\r]+)/);
                        const provider = providerMatch ? providerMatch[1].trim() : 'Torrentio';

                        const firstLine = (s.title || '').split('\n')[0].trim();
                        const filename = s.behaviorHints?.filename || firstLine;

                        let quality = 'HD';
                        if (/4k|2160p/i.test(fullText)) quality = '4K UHD';
                        else if (/1080p/i.test(fullText)) quality = '1080p Full HD';
                        else if (/720p/i.test(fullText)) quality = '720p HD';

                        const audio = isDubbed ? '🇧🇷 Dublado / Dual Áudio' : '🇧🇷 Legenda PT-BR';

                        // Extrair trackers fornecidos pelo Torrentio nas fontes (se existirem)
                        const streamTrackers = [];
                        if (Array.isArray(s.sources)) {
                            s.sources.forEach(src => {
                                if (typeof src === 'string' && src.startsWith('tracker:')) {
                                    streamTrackers.push(src.replace(/^tracker:/, ''));
                                }
                            });
                        }

                        const magnetUri = buildMagnet(key, filename, streamTrackers);

                        streamMap.set(key, {
                            infoHash: key,
                            quality,
                            audio,
                            isPortuguese: true,
                            isDubbed,
                            seeders,
                            size,
                            provider,
                            filename,
                            magnetUri,
                            rawName: s.name,
                            rawTitle: s.title
                        });
                    }
                };

                if (brProvidersRes.status === 'fulfilled' && brProvidersRes.value?.streams) {
                    processStreams(brProvidersRes.value.streams);
                }
                if (ptStreamsRes.status === 'fulfilled' && ptStreamsRes.value?.streams) {
                    processStreams(ptStreamsRes.value.streams);
                }
                if (allStreamsRes.status === 'fulfilled' && allStreamsRes.value?.streams) {
                    processStreams(allStreamsRes.value.streams);
                }

                const torrents = Array.from(streamMap.values()).sort((a, b) => {
                    // 1. Dublado / Dual Áudio sempre no topo absoluto
                    if (a.isDubbed && !b.isDubbed) return -1;
                    if (!a.isDubbed && b.isDubbed) return 1;
                    // 2. Mais seeders primeiro
                    return b.seeders - a.seeders;
                });

                // Verifica se o filme já existe salvo na pasta D:\filmes
                let localFile = null;
                try {
                    const localMovies = await getLocalLibrary(SAVE_PATH, false);
                    const found = localMovies.find(l => (imdb && l.imdbId === imdb) || (titleParam && l.cleanName.toLowerCase() === titleParam.toLowerCase()));
                    if (found) {
                        localFile = {
                            title: found.title,
                            quality: found.quality,
                            sizeFormatted: found.sizeFormatted,
                            streamUrl: found.streamUrl,
                            format: found.format,
                            videoPath: found.videoPath
                        };
                    }
                } catch {
                    // Fallback local check
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    torrents,
                    isLocal: Boolean(localFile),
                    localFile
                }));
            } catch (err) {
                console.error('[TorrentService] Torrent search error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Get local movies library (from D:\filmes with posters and metadata)
        if (pathname === '/api/local-movies' && req.method === 'GET') {
            try {
                const force = urlObj.searchParams.get('force') === 'true';
                const movies = await getLocalLibrary(SAVE_PATH, force);
                const totalBytes = movies.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
                const grouped = groupMediaLibrary(movies);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    movies,
                    count: movies.length,
                    totalSize: formatBytes(totalBytes),
                    franchises: grouped.franchises,
                    series: grouped.series,
                    standaloneMovies: grouped.standaloneMovies,
                    savePath: SAVE_PATH
                }));
            } catch (err) {
                console.error('[TorrentService] Local movies error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Rescan local movies library
        if (pathname === '/api/local-movies/rescan' && req.method === 'POST') {
            try {
                const movies = await getLocalLibrary(SAVE_PATH, true);
                refreshJellyfinLibrary();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    count: movies.length,
                    message: 'Biblioteca local re-escaneada e atualizada com sucesso!'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Stream local file with HTTP Range (206 Partial Content)
        if (pathname === '/api/local/stream' && req.method === 'GET') {
            const filePath = urlObj.searchParams.get('file');
            if (!filePath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'file query parameter is required' }));
                return;
            }
            try {
                streamLocalVideo(filePath, req, res);
            } catch (err) {
                console.error('[TorrentService] Local stream error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // List active / completed downloads
        if (pathname === '/api/downloads' && req.method === 'GET') {
            const list = Array.from(downloadsRegistry.values()).map(meta => {
                const torrent = getActiveTorrent(meta.id);
                if (torrent) {
                    return {
                        id: meta.id,
                        imdbId: meta.imdbId,
                        title: meta.title,
                        quality: meta.quality,
                        name: torrent.name || meta.title,
                        progress: (torrent.progress * 100).toFixed(1),
                        downloadSpeed: formatBytes(torrent.downloadSpeed) + '/s',
                        uploadSpeed: formatBytes(torrent.uploadSpeed) + '/s',
                        downloaded: formatBytes(torrent.downloaded),
                        total: formatBytes(torrent.length),
                        numPeers: torrent.numPeers,
                        timeRemaining: formatTime(torrent.timeRemaining),
                        status: torrent.done ? 'completed' : 'downloading',
                        canPlay: Boolean(torrent.ready),
                        streamUrl: `/api/stream/${meta.id}?magnet=${encodeURIComponent(meta.magnet || torrent.magnetURI || '')}&title=${encodeURIComponent(meta.title)}`,
                        magnet: meta.magnet || torrent.magnetURI || '',
                        destinationPath: meta.destinationPath || `D:\\filmes\\${meta.title}`,
                        category: meta.category || 'movie',
                        groupName: meta.groupName || null,
                        createdAt: meta.createdAt
                    };
                }
                return {
                    id: meta.id,
                    imdbId: meta.imdbId,
                    title: meta.title,
                    quality: meta.quality,
                    name: meta.title,
                    progress: meta.progress || (meta.status === 'completed' ? 100 : 0),
                    downloadSpeed: '0 B/s',
                    uploadSpeed: '0 B/s',
                    downloaded: meta.downloaded || (meta.status === 'completed' ? 'Concluído' : '0 B'),
                    total: meta.total || '',
                    numPeers: 0,
                    timeRemaining: meta.status === 'completed' ? 'Concluído' : 'Pausado',
                    status: meta.status || 'downloading',
                    canPlay: meta.status === 'completed',
                    streamUrl: `/api/stream/${meta.id}?magnet=${encodeURIComponent(meta.magnet || '')}&title=${encodeURIComponent(meta.title)}`,
                    magnet: meta.magnet || '',
                    destinationPath: meta.destinationPath || `D:\\filmes\\${meta.title}`,
                    category: meta.category || 'movie',
                    groupName: meta.groupName || null,
                    createdAt: meta.createdAt
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ downloads: list }));
            return;
        }

        // Torrent Streaming Status (Stremio style)
        if (pathname.startsWith('/api/stream/') && pathname.endsWith('/status') && req.method === 'GET') {
            const infoHash = pathname.replace('/api/stream/', '').replace('/status', '').trim().toLowerCase();
            const torrent = getActiveTorrent(infoHash);
            if (!torrent) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Torrent not active' }));
                return;
            }

            const videoFile = selectBestVideoFile(torrent.files);
            const downloadedBytes = torrent.downloaded || 0;
            // Libera canPlay com 1MB baixado, progresso > 0.05% ou se o arquivo já tem metadados prontos
            const canPlay = downloadedBytes > 1024 * 1024 || torrent.progress > 0.005 || Boolean(videoFile && torrent.ready);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                ready: torrent.ready,
                name: torrent.name,
                fileName: videoFile?.name || '',
                fileLength: videoFile?.length || 0,
                progress: (torrent.progress * 100).toFixed(1),
                downloadSpeed: formatBytes(torrent.downloadSpeed) + '/s',
                numPeers: torrent.numPeers,
                canPlay,
                downloaded: formatBytes(downloadedBytes),
                total: formatBytes(torrent.length)
            }));
            return;
        }

        // Live Torrent Streaming endpoint (Range / 206 Partial Content com fallback de transcode)
        if (pathname.startsWith('/api/stream/') && req.method === 'GET') {
            const infoHash = pathname.replace('/api/stream/', '').trim().toLowerCase();
            let torrent = getActiveTorrent(infoHash);

            if (!torrent) {
                const magnet = urlObj.searchParams.get('magnet');
                const title = urlObj.searchParams.get('title') || 'Streaming Torrent';
                if (!magnet) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Torrent not found. Please provide magnet parameter.' }));
                    return;
                }

                console.log(`[Streaming] Iniciando streaming do torrent "${title}" (Hash: ${infoHash})`);
                const metaItem = {
                    id: infoHash,
                    title: title,
                    quality: 'Streaming',
                    status: 'downloading',
                    createdAt: new Date().toISOString()
                };
                downloadsRegistry.set(infoHash, metaItem);
                persistDownloads();

                torrent = client.add(magnet, { path: SAVE_PATH });

                torrent.on('wire', () => {
                    // Log silencioso ou debug
                });
                torrent.on('warning', (w) => {
                    console.warn(`[Streaming] WebTorrent warning (${infoHash}):`, w.message);
                });
                torrent.on('error', (err) => {
                    console.error(`[Streaming] WebTorrent error (${infoHash}):`, err.message);
                });

                torrent.on('done', () => {
                    console.log(`[Streaming] 🎉 Stream completely downloaded: "${torrent.name}"!`);
                    metaItem.status = 'completed';
                    metaItem.progress = 100;
                    metaItem.downloaded = formatBytes(torrent.length);
                    metaItem.total = formatBytes(torrent.length);
                    persistDownloads();
                    scanLocalMovies(SAVE_PATH);
                    refreshJellyfinLibrary();
                });
            }

            const streamFile = (file) => {
                if (!file) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Nenhum arquivo de vídeo encontrado no torrent' }));
                    return;
                }

                // Prioriza as primeiras e últimas peças para o cabeçalho/índice do vídeo (moov atom / seek index)
                prioritizeVideoForStreaming(torrent, file);

                const total = file.length;
                let contentType = 'video/mp4';
                if (file.name.endsWith('.mkv')) contentType = 'video/x-matroska';
                else if (file.name.endsWith('.webm')) contentType = 'video/webm';
                else if (file.name.endsWith('.avi')) contentType = 'video/x-msvideo';

                const range = req.headers.range;

                if (!range) {
                    res.writeHead(200, {
                        'Content-Length': total,
                        'Content-Type': contentType,
                        'Accept-Ranges': 'bytes'
                    });
                    const stream = file.createReadStream();
                    stream.pipe(res);
                    req.on('close', () => {
                        if (stream && typeof stream.destroy === 'function') stream.destroy();
                    });
                    stream.on('error', (err) => {
                        console.error('[Streaming] Stream error:', err.message);
                        if (!res.headersSent) res.writeHead(500);
                        res.end();
                    });
                    return;
                }

                // Parsing e validação robusta de HTTP Range
                const matches = range.match(/bytes=(\d*)-(\d*)/);
                if (!matches) {
                    res.writeHead(416, { 'Content-Range': `bytes */${total}` });
                    res.end();
                    return;
                }

                let start;
                let end;

                if (matches[1] === '') {
                    // Suffix range: bytes=-500 (últimos 500 bytes)
                    const suffix = parseInt(matches[2], 10);
                    start = Math.max(0, total - suffix);
                    end = total - 1;
                } else if (matches[2] === '') {
                    // Range aberto: bytes=500- (do byte 500 até o final)
                    start = parseInt(matches[1], 10);
                    end = total - 1;
                } else {
                    start = parseInt(matches[1], 10);
                    end = parseInt(matches[2], 10);
                }

                // Validação de limites
                if (isNaN(start) || isNaN(end) || start > end || start >= total) {
                    res.writeHead(416, { 'Content-Range': `bytes */${total}` });
                    res.end();
                    return;
                }

                end = Math.min(end, total - 1);
                const chunkSize = (end - start) + 1;

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${total}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': contentType
                });

                const stream = file.createReadStream({ start, end });
                stream.pipe(res);

                req.on('close', () => {
                    if (stream && typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });

                stream.on('error', (err) => {
                    console.warn(`[Streaming] Range stream error (${start}-${end}):`, err.message);
                    if (stream && typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });
            };

            if (torrent.ready && torrent.files && torrent.files.length > 0) {
                const videoFile = selectBestVideoFile(torrent.files);
                streamFile(videoFile);
            } else {
                torrent.once('ready', () => {
                    const videoFile = selectBestVideoFile(torrent.files);
                    streamFile(videoFile);
                });
            }
            return;
        }

        // Start a download
        if (pathname === '/api/downloads/start' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { magnet, imdbId, title, quality, filename } = data;
                    if (!magnet) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'magnet URL is required' }));
                        return;
                    }

                    const hashMatch = magnet.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
                    const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;

                    if (!infoHash) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid magnet link' }));
                        return;
                    }

                    const existingTorrent = getActiveTorrent(infoHash);
                    if (existingTorrent) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Download already active', id: infoHash }));
                        return;
                    }

                    const org = getOrganizedDownloadPath(SAVE_PATH, title, filename);
                    try {
                        if (!fs.existsSync(org.targetPath)) {
                            fs.mkdirSync(org.targetPath, { recursive: true });
                        }
                    } catch (e) {
                        console.warn('[TorrentService] Could not create target directory:', e.message);
                    }

                    console.log(`[TorrentService] Starting organized download: "${title || filename}" into ${org.targetPath} (${org.category}: ${org.groupName || 'filme'})`);

                    const metaItem = {
                        id: infoHash,
                        imdbId: imdbId || '',
                        title: title || filename || 'Filme',
                        quality: quality || '1080p',
                        magnet: magnet,
                        category: org.category,
                        groupName: org.groupName,
                        destinationPath: org.displayPath,
                        savePath: org.targetPath,
                        status: 'downloading',
                        createdAt: new Date().toISOString()
                    };
                    downloadsRegistry.set(infoHash, metaItem);
                    persistDownloads();

                    const torrent = client.add(magnet, { path: org.targetPath }, (t) => {
                        console.log(`[TorrentService] Torrent ready: "${t.name}" (${formatBytes(t.length)})`);
                        const video = selectBestVideoFile(t.files);
                        if (video) {
                            prioritizeVideoForStreaming(t, video);
                        }
                    });

                    torrent.on('warning', (w) => {
                        console.warn(`[TorrentService] Torrent warning on "${title}":`, w.message);
                    });

                    torrent.on('done', () => {
                        console.log(`[TorrentService] 🎉 Download COMPLETED: "${torrent.name}"!`);
                        const item = downloadsRegistry.get(infoHash);
                        if (item) {
                            item.status = 'completed';
                            item.progress = 100;
                            item.downloaded = formatBytes(torrent.length);
                            item.total = formatBytes(torrent.length);
                            item.completedAt = new Date().toISOString();
                            persistDownloads();
                        }
                        scanLocalMovies(SAVE_PATH);
                        refreshJellyfinLibrary();
                    });

                    torrent.on('error', (err) => {
                        console.error(`[TorrentService] Torrent error on "${title}":`, err.message);
                        const item = downloadsRegistry.get(infoHash);
                        if (item) {
                            item.status = 'error';
                            persistDownloads();
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Download iniciado com sucesso',
                        id: infoHash,
                        title: title || filename
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Cancel / delete download
        if (pathname.startsWith('/api/downloads/') && req.method === 'DELETE') {
            const id = pathname.replace('/api/downloads/', '').trim().toLowerCase();
            const torrent = getActiveTorrent(id);
            if (torrent) {
                torrent.destroy(() => {
                    console.log(`[TorrentService] Torrent stopped: ${id}`);
                });
            }
            downloadsRegistry.delete(id);
            persistDownloads();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Download removido' }));
            return;
        }

        // Launch in qBittorrent directly
        if (pathname === '/api/qbittorrent/open' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { magnet } = data;
                    if (!magnet) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'magnet parameter is required' }));
                        return;
                    }

                    const qbtExe = 'C:\\Program Files\\qBittorrent\\qbittorrent.exe';
                    if (fs.existsSync(qbtExe)) {
                        spawn(qbtExe, [magnet], { detached: true, stdio: 'ignore' }).unref();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Enviado para o qBittorrent com sucesso!' }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'qBittorrent não encontrado em ' + qbtExe }));
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // 404 for unknown routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    } catch (globalErr) {
        console.error('[TorrentService] Unhandled server error:', globalErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: globalErr.message }));
    }
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 MatheusFlix Torrent & Discovery Service iniciado!`);
    console.log(`📡 Porta: http://localhost:${PORT}`);
    console.log(`📁 Pasta de Destino: ${SAVE_PATH}`);
    console.log(`🍿 Jellyfin Server: ${JELLYFIN_URL}`);
    console.log(`=======================================================`);

    // Start background catalog seeding
    seedCatalog(SAVE_PATH).catch(err => {
        console.warn('[TorrentService] Background seeding error:', err.message);
    });
});
