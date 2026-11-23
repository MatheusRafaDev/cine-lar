import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import WebTorrent from 'webtorrent';
import { initDb, upsertMovie, searchCatalog, getGenresSummary, getUserFavorites, isUserFavorite, toggleUserFavorite, updateWatchProgress, getWatchHistory, deleteWatchHistory, getMovieById, getUserProfiles, createUserProfile } from './db.js';
import { seedCatalog, scanLocalMovies } from './seeder.js';
import { askAiMovieRecommendations } from './aiSearch.js';
import { getLocalLibrary, streamLocalVideo, deleteLocalFile, renameLocalFile, invalidateLocalCache, removeFileFromLocalCache, getMediaInfo } from './localScanner.js';
import { getOrganizedDownloadPath, groupMediaLibrary } from './organizer.js';
import { fetchPtBrMetadata, searchPtBrMovie } from './tmdbHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prevenção contra crash do processo do servidor por exceções assíncronas não tratadas
process.on('uncaughtException', (err) => {
    console.error('[TorrentService] Uncaught Exception interceptada:', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[TorrentService] Unhandled Rejection interceptada:', reason);
});

// Carregamento de variáveis de ambiente (.env)
if (typeof process.loadEnvFile === 'function') {
    const envPaths = [
        path.join(__dirname, '.env'),
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'torrent-service', '.env')
    ];
    for (const ep of envPaths) {
        if (fs.existsSync(ep)) {
            try {
                process.loadEnvFile(ep);
                break;
            } catch (_) {}
        }
    }
}

const PORT = process.env.PORT || 8085;
const HOST = process.env.HOST || '0.0.0.0';
const CONFIG_FILE = path.join(__dirname, 'config.json');
let SAVE_PATH = path.normalize(process.env.SAVE_PATH || 'D:\\Filmes');

try {
    if (fs.existsSync(CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (cfg.savePath) {
            SAVE_PATH = path.normalize(cfg.savePath);
        }
    }
} catch (e) {
    console.warn('[TorrentService] Could not load config.json:', e.message);
}

export function resolveGoogleDrivePath() {
    const preferredDrive = path.normalize('G:\\Meu Drive\\cinelar');
    try {
        if (!fs.existsSync(preferredDrive)) {
            fs.mkdirSync(preferredDrive, { recursive: true });
        }
        return preferredDrive;
    } catch (_) {}

    const candidates = [
        'G:\\Meu Drive\\cinelar',
        'G:\\Meu Drive\\Cinelar',
        path.join(SAVE_PATH, 'Cinelar')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    return path.join(SAVE_PATH, 'Cinelar');
}

let PLATFORM_DOWNLOAD_PATH = resolveGoogleDrivePath();
const MUTATION_API_TOKEN = (process.env.MUTATION_API_TOKEN || '').trim();

function getLocalIpAddress() {
    try {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal && (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.'))) {
                    return net.address;
                }
            }
        }
    } catch (_) {}
    return '127.0.0.1';
}

function isPathInsideBase(targetPath, basePath) {
    if (!targetPath || !basePath) return false;
    const base = path.resolve(basePath);
    const target = path.resolve(targetPath);
    const normBase = process.platform === 'win32' ? base.toLowerCase() : base;
    const normTarget = process.platform === 'win32' ? target.toLowerCase() : target;
    const relative = path.relative(normBase, normTarget);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isAllowedMediaPath(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath);
    if (SAVE_PATH && isPathInsideBase(resolved, SAVE_PATH)) return true;
    if (PLATFORM_DOWNLOAD_PATH && isPathInsideBase(resolved, PLATFORM_DOWNLOAD_PATH)) return true;
    return false;
}

function isTrustedMutationRequest(req) {
    if (MUTATION_API_TOKEN) {
        const headerToken = (req.headers['x-api-token'] || '').trim();
        const authHeader = (req.headers.authorization || '').trim();
        const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
        if (headerToken !== MUTATION_API_TOKEN && bearerToken !== MUTATION_API_TOKEN) {
            return false;
        }
    }

    const origin = req.headers.origin;
    // Aplicativos Tizen instalados normalmente enviam Origin "null" ou não enviam Origin.
    if (!origin || origin === 'null') return true;

    try {
        const originUrl = new URL(origin);
        const requestUrl = new URL(`http://${req.headers.host || `localhost:${PORT}`}`);
        if (originUrl.hostname === requestUrl.hostname) return true;
        if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1' || originUrl.hostname.startsWith('192.168.') || originUrl.hostname.startsWith('10.')) {
            return true;
        }

        const configuredOrigins = (process.env.ALLOWED_MUTATION_ORIGINS || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        return configuredOrigins.includes(origin);
    } catch (_) {
        return false;
    }
}

function rejectUntrustedMutation(req, res) {
    if (isTrustedMutationRequest(req)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origem não autorizada para alterar a biblioteca' }));
    return true;
}

// Initialize SQLite database
initDb();

// Ensure save path directories exist
try {
    if (!fs.existsSync(SAVE_PATH)) {
        fs.mkdirSync(SAVE_PATH, { recursive: true });
    }
    if (!fs.existsSync(PLATFORM_DOWNLOAD_PATH)) {
        fs.mkdirSync(PLATFORM_DOWNLOAD_PATH, { recursive: true });
    }
} catch (e) {
    console.warn(`[TorrentService] Could not verify save path "${SAVE_PATH}":`, e.message);
}

// Torrent Client
const client = new WebTorrent();
client.on('error', (err) => {
    console.error('[WebTorrent] Global error:', err.message);
});
client.on('torrent', (torrent) => {
    if (!torrent) return;
    torrent.on('error', (err) => {
        console.warn(`[WebTorrent] Torrent error interceptado (${torrent.name || torrent.infoHash || 'desconhecido'}):`, err?.message || err);
    });
    torrent.on('warning', (w) => {
        // Ignora avisos normais de trackers lentos/offline
    });
});

// Downloads registry: infoHash -> meta info
const downloadsRegistry = new Map();
const DOWNLOADS_FILE = path.join(__dirname, 'downloads.json');

// Load saved downloads history if available (apenas downloads permanentes, nunca streams temporarios)
try {
    if (fs.existsSync(DOWNLOADS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(DOWNLOADS_FILE, 'utf8'));
        if (Array.isArray(saved)) {
            saved.filter(item => item.quality !== 'Streaming').forEach(item => {
                // Preenche poster a partir do IMDb caso não exista salvo
                if (!item.poster && item.imdbId) {
                    try {
                        const local = getMovieById(item.imdbId);
                        if (local && local.poster) {
                            item.poster = local.poster;
                            item.backdrop = local.backdrop || local.poster;
                        } else if (item.imdbId.startsWith('tt')) {
                            item.poster = `https://images.metahub.space/poster/medium/${item.imdbId}/img`;
                            item.backdrop = `https://images.metahub.space/background/medium/${item.imdbId}/img`;
                        }
                    } catch (_) {}
                }
                downloadsRegistry.set(item.id, item);
            });
        }
    }
} catch (e) {
    console.warn('[TorrentService] Could not load downloads history:', e.message);
}

function persistDownloads() {
    try {
        const list = Array.from(downloadsRegistry.values())
            .filter(d => d.quality !== 'Streaming')
            .map(d => ({
                id: d.id,
                imdbId: d.imdbId || '',
                title: d.title || 'Download',
                quality: d.quality || '1080p',
                status: d.status || 'downloading',
                isPaused: Boolean(d.isPaused),
                poster: d.poster || '',
                backdrop: d.backdrop || '',
                overview: d.overview || '',
                year: d.year || '',
                category: d.category || 'movie',
                groupName: d.groupName || null,
                isSeries: Boolean(d.isSeries),
                seriesName: d.seriesName || null,
                season: d.season || null,
                episode: d.episode || null,
                destinationPath: d.destinationPath || '',
                savePath: d.savePath || '',
                magnet: d.magnet || '',
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

// Gerenciamento de streaming sob demanda e liberacao automatica de recursos em segundo plano
const activeStreamClients = new Map(); // infoHash -> count
const streamIdleTimers = new Map(); // infoHash -> timeoutId

function stopStreamingTorrent(infoHash) {
    if (streamIdleTimers.has(infoHash)) {
        clearTimeout(streamIdleTimers.get(infoHash));
        streamIdleTimers.delete(infoHash);
    }
    activeStreamClients.delete(infoHash);

    const meta = downloadsRegistry.get(infoHash);
    // Se o usuario solicitou download permanente (/api/downloads/start), mantem o torrent
    if (meta && meta.quality !== 'Streaming') {
        return;
    }

    const torrent = getActiveTorrent(infoHash);
    if (torrent) {
        console.log(`[Streaming] Encerrando torrent sob demanda inativo: "${torrent.name}" (${infoHash})`);
        try {
            torrent.destroy({ destroyStore: false }, () => {
                console.log(`[Streaming] Recursos do torrent liberados: ${infoHash}`);
            });
        } catch (err) {
            console.warn(`[Streaming] Erro ao liberar torrent:`, err.message);
        }
    }

    if (meta && meta.quality === 'Streaming') {
        downloadsRegistry.delete(infoHash);
    }
}

function getActiveDownloadingPaths() {
    const paths = [];
    const baseSave = path.resolve(SAVE_PATH).toLowerCase();
    const basePlatform = path.resolve(PLATFORM_DOWNLOAD_PATH).toLowerCase();
    for (const d of downloadsRegistry.values()) {
        if (d.status === 'downloading' && d.savePath) {
            const p = path.resolve(d.savePath).toLowerCase();
            if (p !== baseSave && p !== basePlatform) {
                paths.push(p);
            }
        }
    }
    return paths;
}

function cleanupCancelledDownload(item, torrent, saveBasePath = 'D:\\filmes') {
    const resolvedBase = path.resolve(saveBasePath).toLowerCase();
    const torrentName = torrent?.name || null;
    const torrentPath = torrent?.path || null;
    const torrentFiles = (torrent && Array.isArray(torrent.files))
        ? torrent.files.map(f => f.path).filter(Boolean)
        : [];

    const removePathsFromDisk = () => {
        // 1. Apagar pasta de destino específica se existir e for subpasta de SAVE_PATH
        if (item && item.savePath) {
            try {
                const resolvedSave = path.resolve(item.savePath);
                if (resolvedSave.toLowerCase().startsWith(resolvedBase) && resolvedSave.toLowerCase() !== resolvedBase) {
                    if (fs.existsSync(resolvedSave)) {
                        fs.rmSync(resolvedSave, { recursive: true, force: true });
                        console.log(`[TorrentService] Pasta do download cancelado removida: ${resolvedSave}`);
                    }

                    // Limpar pastas vazias antecedentes (ex: Franquias ou Series vazias)
                    let parent = path.dirname(resolvedSave);
                    while (parent.toLowerCase().startsWith(resolvedBase) && parent.toLowerCase() !== resolvedBase) {
                        try {
                            const remaining = fs.readdirSync(parent);
                            if (remaining.length === 0) {
                                fs.rmSync(parent, { recursive: true, force: true });
                                console.log(`[TorrentService] Pasta pai vazia removida: ${parent}`);
                                parent = path.dirname(parent);
                            } else {
                                break;
                            }
                        } catch {
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('[TorrentService] Erro ao remover savePath:', e.message);
            }
        }

        // 2. Apagar pasta ou arquivo criado com o nome do torrent
        if (torrentName) {
            const candidates = [
                path.join(saveBasePath, torrentName),
                item?.savePath ? path.join(item.savePath, torrentName) : null
            ].filter(Boolean);

            for (const cand of candidates) {
                try {
                    if (fs.existsSync(cand)) {
                        const resolvedCand = path.resolve(cand);
                        if (resolvedCand.toLowerCase().startsWith(resolvedBase) && resolvedCand.toLowerCase() !== resolvedBase) {
                            fs.rmSync(resolvedCand, { recursive: true, force: true });
                            console.log(`[TorrentService] Pasta/arquivo residual do torrent removido: ${resolvedCand}`);
                        }
                    }
                } catch {}
            }
        }

        // 3. Apagar arquivos individuais do torrent caso ainda existam
        for (const fRelPath of torrentFiles) {
            try {
                const targetFile = path.join(torrentPath || item?.savePath || saveBasePath, fRelPath);
                if (fs.existsSync(targetFile)) {
                    const resolvedTarget = path.resolve(targetFile);
                    if (resolvedTarget.toLowerCase().startsWith(resolvedBase) && resolvedTarget.toLowerCase() !== resolvedBase) {
                        fs.unlinkSync(resolvedTarget);
                        console.log(`[TorrentService] Arquivo residual removido: ${resolvedTarget}`);
                    }
                }
            } catch {}
        }
    };

    // Destruir torrent liberando chunks e fechar handles antes/depois de apagar do disco
    if (torrent) {
        try {
            if (typeof torrent.pause === 'function') torrent.pause();
            torrent.destroy({ destroyStore: true }, (err) => {
                if (err) console.warn('[TorrentService] destroyStore aviso:', err.message);
                else console.log('[TorrentService] Torrent destroyed com destroyStore.');
                removePathsFromDisk();
                setTimeout(removePathsFromDisk, 350);
            });
        } catch (e) {
            console.warn('[TorrentService] Falha ao destruir torrent:', e.message);
        }
    }

    removePathsFromDisk();
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
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(__dirname, 'bin', 'ffmpeg.exe'),
    'C:\\Program Files\\Jellyfin\\Server\\ffmpeg.exe',
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

        console.log(`[TorrentService] Pecas priorizadas para streaming imediato: ${startPiece}..${firstBatchEnd} e ${lastBatchStart}..${endPiece}`);
    } catch (e) {
        console.warn('[TorrentService] prioritizeVideoForStreaming warning:', e.message);
    }
}

function attachPermanentTorrentHandlers(torrent, infoHash) {
    if (!torrent || torrent._permanentHandlersAttached) return;
    torrent._permanentHandlersAttached = true;

    const onReady = () => {
        console.log(`[TorrentService] Torrent ready: "${torrent.name}" (${formatBytes(torrent.length)})`);
        const video = selectBestVideoFile(torrent.files);
        if (video) {
            prioritizeVideoForStreaming(torrent, video);
        }
    };

    if (torrent.ready) {
        onReady();
    } else {
        torrent.once('ready', onReady);
    }

    torrent.on('done', () => {
        console.log(`[TorrentService] Download COMPLETED: "${torrent.name}"!`);
        const item = downloadsRegistry.get(infoHash);
        if (item && item.quality !== 'Streaming') {
            item.status = 'completed';
            item.isPaused = false;
            item.progress = 100;
            item.downloaded = formatBytes(torrent.length);
            item.total = formatBytes(torrent.length);
            item.completedAt = new Date().toISOString();
            persistDownloads();
        }
        scanLocalMovies(SAVE_PATH);
    });

    torrent.on('error', (err) => {
        console.error(`[TorrentService] Torrent error (${infoHash}):`, err.message);
        const item = downloadsRegistry.get(infoHash);
        if (item) {
            item.status = 'error';
            item.error = err.message;
            if (err.message?.includes('ENOSPC') || err.code === 'ENOSPC' || err.message?.toLowerCase().includes('space')) {
                item.errorMessage = 'Espaço em disco insuficiente no destino selecionado.';
            } else {
                item.errorMessage = `Erro de transferência: ${err.message}`;
            }
            item.isPaused = true;
            persistDownloads();
        }
    });
}

function ensureTorrentRunningForDownload(metaItem) {
    if (!metaItem || !metaItem.id || metaItem.quality === 'Streaming') return null;
    const infoHash = String(metaItem.id).trim().toLowerCase();
    let torrent = getActiveTorrent(infoHash);
    if (torrent) {
        attachPermanentTorrentHandlers(torrent, infoHash);
        return torrent;
    }
    if (metaItem.status === 'downloading' && !metaItem.isPaused && metaItem.magnet) {
        const targetDir = metaItem.savePath || PLATFORM_DOWNLOAD_PATH;
        try {
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            console.log(`[TorrentService] Retomando download salvo "${metaItem.title}" (${infoHash}) em ${targetDir}`);
            torrent = client.add(metaItem.magnet, { path: targetDir });
            attachPermanentTorrentHandlers(torrent, infoHash);
            return torrent;
        } catch (e) {
            console.warn(`[TorrentService] Falha ao iniciar torrent salvo (${infoHash}):`, e.message);
        }
    }
    return null;
}

// Retoma automaticamente os downloads ativos carregados do downloads.json ao iniciar o servidor
setImmediate(() => {
    for (const item of downloadsRegistry.values()) {
        if (item && item.status === 'downloading' && !item.isPaused) {
            ensureTorrentRunningForDownload(item);
        }
    }
});

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

// Cache em memória de alta performance para chamadas externas (Cinemeta, Torrentio, Metadados)
const apiCache = new Map(); // url -> { data, expiresAt }

function getCachedJson(url) {
    const item = apiCache.get(url);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
        apiCache.delete(url);
        return null;
    }
    return item.data;
}

function setCachedJson(url, data, ttlMs = 30 * 60 * 1000) {
    if (apiCache.size > 800) {
        // Evicção dos 200 itens mais antigos
        const keys = Array.from(apiCache.keys()).slice(0, 200);
        keys.forEach(k => apiCache.delete(k));
    }
    apiCache.set(url, { data, expiresAt: Date.now() + ttlMs });
}

// HTTP request helper com cache transparente
function fetchJson(url, customTtl = 0) {
    let ttl = customTtl;
    if (ttl === 0) {
        if (url.includes('strem.io') || url.includes('cinemeta') || url.includes('metahub')) {
            ttl = 60 * 60 * 1000; // 1 hora de cache para catalogos e metadados
        } else if (url.includes('torrentio')) {
            ttl = 10 * 60 * 1000; // 10 minutos de cache para streams torrentio
        }
    }

    if (ttl > 0) {
        const cached = getCachedJson(url);
        if (cached) {
            return Promise.resolve(cached);
        }
    }

    return new Promise((resolve, reject) => {
        const clientLib = url.startsWith('https') ? https : http;
        const req = clientLib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 CinelarTV/2.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location, ttl).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (ttl > 0) {
                        setCachedJson(url, parsed, ttl);
                    }
                    resolve(parsed);
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

let cachedLocalSets = null;
let cachedLocalSetsTimestamp = 0;

export function invalidateLocalSetsCache() {
    cachedLocalSets = null;
    cachedLocalSetsTimestamp = 0;
}

/**
 * Cruza a lista de filmes do catálogo com a biblioteca local (D:\filmes)
 * garantindo que qualquer filme já baixado seja sinalizado com is_local: 1
 */
async function markLocalMoviesInList(movieList) {
    if (!movieList || !movieList.length) return;
    try {
        const now = Date.now();
        if (!cachedLocalSets || (now - cachedLocalSetsTimestamp > 60000)) {
            const localMovies = await getLocalLibrary(SAVE_PATH, false, getActiveDownloadingPaths());
            const localImdbSet = new Set(localMovies.map(m => m.imdbId).filter(Boolean));
            const localTitlesSet = new Set(
                localMovies.flatMap(m => [
                    (m.cleanName || '').toLowerCase().trim(),
                    (m.title || '').toLowerCase().trim(),
                    (m.originalTitle || m.original_title || '').toLowerCase().trim()
                ]).filter(Boolean)
            );
            cachedLocalSets = { localImdbSet, localTitlesSet };
            cachedLocalSetsTimestamp = now;
        }

        const { localImdbSet, localTitlesSet } = cachedLocalSets;

        movieList.forEach(m => {
            const id = m.imdb_id || m.imdbId || m.id;
            const title = (m.title || m.name || '').toLowerCase().trim();
            const origTitle = (m.original_title || '').toLowerCase().trim();
            const isLocal = Boolean(
                (id && localImdbSet.has(id)) ||
                (title && localTitlesSet.has(title)) ||
                (origTitle && localTitlesSet.has(origTitle))
            );
            m.is_local = isLocal ? 1 : 0;
            m.isLocal = isLocal;
        });
    } catch {
        movieList.forEach(m => {
            if (!m.isLocal) {
                m.is_local = 0;
                m.isLocal = false;
            }
        });
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Emby-Token, X-Api-Token');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:8085'}`);
    const pathname = urlObj.pathname;

    try {
        // Download Cinelar.wgt (ou MatheusFlix.wgt) for Smart TV
        if ((pathname === '/download/Cinelar.wgt' || pathname === '/download/MatheusFlix.wgt') && (req.method === 'GET' || req.method === 'HEAD')) {
            const wgtPath = [
                path.resolve(__dirname, '..', 'Cinelar.wgt'),
                path.resolve(__dirname, '..', 'MatheusFlix-signed.wgt'),
                path.resolve(__dirname, '..', 'MatheusFlix.wgt')
            ].find(p => fs.existsSync(p));

            if (wgtPath) {
                const stat = fs.statSync(wgtPath);
                res.writeHead(200, {
                    'Content-Type': 'application/vnd.tizen.wgt',
                    'Content-Length': stat.size,
                    'Content-Disposition': 'attachment; filename="Cinelar.wgt"',
                    'Access-Control-Allow-Origin': '*'
                });
                if (req.method === 'HEAD') {
                    res.end();
                    return;
                }
                const stream = fs.createReadStream(wgtPath);
                stream.pipe(res);
                return;
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Cinelar.wgt not found');
                return;
            }
        }

        // Endpoint de legendas locais (SRT/VTT com conversão automática WebVTT para Smart TV e Web)
        if (pathname === '/api/local/subtitle' && (req.method === 'GET' || req.method === 'HEAD')) {
            const queryFile = urlObj.searchParams.get('file') || urlObj.searchParams.get('path');
            if (!queryFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Parâmetro file é obrigatório' }));
                return;
            }

            let subPath = path.resolve(queryFile);
            if (!isAllowedMediaPath(subPath)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Acesso negado fora da pasta de mídia' }));
                return;
            }

            if (!/\.(srt|vtt)$/i.test(subPath)) {
                const baseName = subPath.replace(/\.[^.]+$/, '');
                const candidates = [
                    `${baseName}.srt`,
                    `${baseName}.pt.srt`,
                    `${baseName}.pt-br.srt`,
                    `${baseName}.vtt`,
                    path.join(path.dirname(subPath), 'subs.srt'),
                    path.join(path.dirname(subPath), 'subtitles.srt')
                ];
                const found = candidates.find(c => fs.existsSync(c));
                if (found) subPath = found;
            }

            if (!fs.existsSync(subPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Legenda não encontrada');
                return;
            }

            try {
                const content = fs.readFileSync(subPath, 'utf8');
                let vttContent = content;
                if (subPath.toLowerCase().endsWith('.srt')) {
                    vttContent = 'WEBVTT\n\n' + content
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                }

                const vttBuffer = Buffer.from(vttContent, 'utf8');
                res.writeHead(200, {
                    'Content-Type': 'text/vtt; charset=utf-8',
                    'Content-Length': vttBuffer.length,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=86400'
                });
                if (req.method === 'HEAD') {
                    res.end();
                    return;
                }
                res.end(vttBuffer);
                return;
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erro ao ler legenda: ' + err.message);
                return;
            }
        }

        // Status endpoint
        if (pathname === '/api/status' && req.method === 'GET') {
            let freeSpaceGB = null;
            try {
                if (fs.existsSync(SAVE_PATH)) {
                    const st = fs.statfsSync(SAVE_PATH);
                    freeSpaceGB = parseFloat(((st.bfree * st.bsize) / (1024 ** 3)).toFixed(1));
                }
            } catch (_) {}
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache'
            });
            res.end(JSON.stringify({
                status: 'online',
                savePath: SAVE_PATH,
                freeSpaceGB,
                activeTorrents: client.torrents.length,
                totalDownloads: downloadsRegistry.size,
                qbittorrentInstalled: fs.existsSync('C:\\Program Files\\qBittorrent\\qbittorrent.exe')
            }));
            return;
        }

        // Save Path settings endpoint
        if (pathname === '/api/settings/save-path' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ savePath: SAVE_PATH }));
            return;
        }

        if (pathname === '/api/settings/save-path' && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    let newPath = (data.savePath || '').trim();
                    if (!newPath) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: 'Caminho de pasta inválido.' }));
                        return;
                    }
                    newPath = path.normalize(newPath);
                    if (!fs.existsSync(newPath)) {
                        fs.mkdirSync(newPath, { recursive: true });
                    }
                    SAVE_PATH = newPath;
                    PLATFORM_DOWNLOAD_PATH = resolveGoogleDrivePath();
                    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ savePath: SAVE_PATH }, null, 2), 'utf8');
                    try {
                        invalidateLocalCache();
                        invalidateLocalSetsCache();
                        scanLocalMovies(SAVE_PATH);
                    } catch (_) {}
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, savePath: SAVE_PATH }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
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

        if (pathname === '/api/user/history' && req.method === 'DELETE') {
            const movieId = urlObj.searchParams.get('movieId');
            const userId = urlObj.searchParams.get('userId') || 'default';
            if (movieId) {
                deleteWatchHistory(userId, movieId);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: 'Filme removido de Continuar Assistindo' }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'movieId é obrigatório' }));
            }
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

        // Perfis de usuários estilo Netflix (Totalmente sem senhas, nativo no SQLite)
        if (pathname === '/api/user/profiles' && req.method === 'GET') {
            try {
                const profiles = getUserProfiles();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ profiles }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // Login direto de perfis no backend sem senhas
        if (pathname === '/api/user/profiles/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const name = (data.name || '').trim();
                    const profiles = getUserProfiles();
                    let profile = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
                    if (!profile) {
                        profile = createUserProfile(name || 'Principal');
                    }
                    console.log(`[TorrentService] Perfil ativo: "${profile.name}" (${profile.id})`);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        accessToken: `cinelar_${profile.id}`,
                        userId: profile.id,
                        user: { Id: profile.id, Name: profile.name },
                        serverId: 'cinelar_local'
                    }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
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
                    const profile = createUserProfile(name);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, profile }));
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
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, max-age=300'
            });
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
                    await markLocalMoviesInList(movies);
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
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Cache-Control': 'private, max-age=30'
                    });
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
                        res.writeHead(200, {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Cache-Control': 'private, max-age=120'
                        });
                        res.end(JSON.stringify(freshResults));
                        return;
                    }
                } catch (e) {
                    // Fall through to existing results
                }
            }

            await markLocalMoviesInList(results.movies);
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, max-age=120'
            });
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

        // Torrents para Temporada Completa (Season Packs)
        if (pathname === '/api/series/season-torrents' && req.method === 'GET') {
            const imdb = urlObj.searchParams.get('imdb') || urlObj.searchParams.get('imdbId');
            const season = urlObj.searchParams.get('season') || '1';
            const sNum = parseInt(season, 10) || 1;
            const titleParam = (urlObj.searchParams.get('title') || '').trim();

            if (!imdb) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Parameter imdb is required' }));
                return;
            }

            try {
                const streamPath = `series/${imdb}:${sNum}:1`;
                console.log(`[TorrentService] Buscando Season Packs e torrents para temporada ${sNum} da série: ${imdb}`);

                const [allStreamsRes, ptStreamsRes] = await Promise.allSettled([
                    fetchJson(`https://torrentio.strem.fun/stream/${streamPath}.json`),
                    fetchJson(`https://torrentio.strem.fun/language=portuguese/stream/${streamPath}.json`)
                ]);

                const streamsMap = new Map();
                const addStream = (s) => {
                    const hashMatch = (s.infoHash || s.url || '').match(/([a-fA-F0-9]{40})/i);
                    const hash = hashMatch ? hashMatch[1].toLowerCase() : (s.infoHash || '');
                    if (!hash || streamsMap.has(hash)) return;

                    const titleStr = s.title || '';
                    const nameStr = s.name || '';
                    const full = `${nameStr} ${titleStr}`;

                    const isSeasonPack = /(completa|complete|temporada[\s\.\-_]*\d+|season[\s\.\-_]*\d+|\bS\d+[\s\.\-_]*complete)/i.test(full)
                        || (/([0-9]+(\.[0-9]+)?\s*GB)/i.test(titleStr) && parseFloat(titleStr.match(/([0-9]+(\.[0-9]+)?)\s*GB/i)?.[1] || '0') > 3.5);

                    let quality = '1080p Full HD';
                    const isCam = /\b(cam|hdcam|camrip|telesync|ts|telecine|tc|screener|scr|dvdscr)\b/i.test(full);
                    if (isCam) quality = 'HDCAM (Cinema)';
                    else if (/4k|2160p|uhd/i.test(full)) quality = '4K UHD';
                    else if (/1080p|fhd/i.test(full)) quality = '1080p Full HD';
                    else if (/720p/i.test(full)) quality = '720p HD';
                    else if (/480p|sd/i.test(full)) quality = '480p SD';

                    const isPt = /dublado|dual|nacional|portuguese|português|brasil|pt-br/i.test(full) || /(?:\uD83C\uDDE7\uD83C\uDDF7|\uD83C\uDDF5\uD83C\uDDF9)/.test(full);

                    let magnet = '';
                    if (s.infoHash) {
                        magnet = `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(titleParam ? `${titleParam} S${String(sNum).padStart(2, '0')}` : 'Temporada')}`;
                    }

                    streamsMap.set(hash, {
                        id: hash,
                        infoHash: hash,
                        name: nameStr,
                        title: titleStr,
                        label: titleStr.split('\n')[0] || titleStr,
                        size: titleStr.match(/([0-9]+(\.[0-9]+)?\s*(GB|MB))/i)?.[0] || '',
                        quality,
                        magnet,
                        isPt,
                        isDubbed: /dublado|dual/i.test(full),
                        isSeasonPack
                    });
                };

                if (ptStreamsRes.status === 'fulfilled' && ptStreamsRes.value?.streams) {
                    ptStreamsRes.value.streams.forEach(addStream);
                }
                if (allStreamsRes.status === 'fulfilled' && allStreamsRes.value?.streams) {
                    allStreamsRes.value.streams.forEach(addStream);
                }

                const all = Array.from(streamsMap.values());
                const seasonPacks = all.filter(s => s.isSeasonPack);

                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'private, max-age=120'
                });
                res.end(JSON.stringify({
                    season: sNum,
                    seasonPacks: seasonPacks.length > 0 ? seasonPacks : all,
                    allStreams: all,
                    totalPacks: seasonPacks.length
                }));
                return;
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message, seasonPacks: [] }));
                return;
            }
        }

        // Iniciar Download de Temporada Completa em Pasta Organizada da Série
        if (pathname === '/api/series/download-season' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { imdbId, seriesName, season, magnet, quality, episodes, destination } = data;
                    const sNum = parseInt(season, 10) || 1;
                    const cleanSeries = (seriesName || 'Série').replace(/[\\/:*?"<>|]/g, '').trim();
                    const sStr = `Temporada ${String(sNum).padStart(2, '0')}`;
                    const isDriveTarget = destination === 'drive' || destination === 'gdrive';
                    const baseSeries = isDriveTarget ? path.join(PLATFORM_DOWNLOAD_PATH, 'Series') : path.join(SAVE_PATH, 'Series');
                    const targetPath = path.join(baseSeries, cleanSeries, sStr);

                    if (!fs.existsSync(targetPath)) {
                        fs.mkdirSync(targetPath, { recursive: true });
                    }

                    if (magnet) {
                        const hashMatch = magnet.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
                        const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;

                        if (!infoHash) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Invalid magnet link' }));
                            return;
                        }

                        const existing = getActiveTorrent(infoHash);
                        if (!existing) {
                            const metaItem = {
                                id: infoHash,
                                imdbId: imdbId || '',
                                title: `${cleanSeries} - Temporada ${sNum} Completa`,
                                quality: quality || '1080p',
                                magnet,
                                category: 'series',
                                groupName: cleanSeries,
                                isSeries: true,
                                seriesName: cleanSeries,
                                season: sNum,
                                destination: isDriveTarget ? 'drive' : 'local',
                                destinationPath: isDriveTarget ? `Cinelar\\Series\\${cleanSeries}\\${sStr}` : `Series\\${cleanSeries}\\${sStr}`,
                                savePath: targetPath,
                                savePath: targetPath,
                                status: 'downloading',
                                createdAt: new Date().toISOString()
                            };
                            downloadsRegistry.set(infoHash, metaItem);
                            persistDownloads();

                            client.add(magnet, { path: targetPath }, (t) => {
                                console.log(`[TorrentService] Season pack download iniciado: "${t.name}" (${formatBytes(t.length)})`);
                            });
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            success: true,
                            message: `Download da Temporada ${sNum} de ${cleanSeries} iniciado!`,
                            savePath: targetPath,
                            destinationPath: `Cinelar\\Series\\${cleanSeries}\\${sStr}`
                        }));
                        return;
                    }

                    // Download em lote de episódios individuais
                    let enqueued = 0;
                    if (Array.isArray(episodes) && episodes.length > 0) {
                        for (const ep of episodes) {
                            if (ep.magnet) {
                                const hashMatch = ep.magnet.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
                                const epHash = hashMatch ? hashMatch[1].toLowerCase() : null;
                                if (epHash && !getActiveTorrent(epHash)) {
                                    const epNum = ep.number || ep.episode || 1;
                                    const epTitle = `${cleanSeries} S${String(sNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
                                    const metaItem = {
                                        id: epHash,
                                        imdbId: imdbId || '',
                                        title: epTitle,
                                        quality: ep.quality || quality || '1080p',
                                        magnet: ep.magnet,
                                        category: 'series',
                                        groupName: cleanSeries,
                                        isSeries: true,
                                        seriesName: cleanSeries,
                                        season: sNum,
                                        episode: epNum,
                                        destinationPath: `Cinelar\\Series\\${cleanSeries}\\${sStr}`,
                                        savePath: targetPath,
                                        status: 'downloading',
                                        createdAt: new Date().toISOString()
                                    };
                                    downloadsRegistry.set(epHash, metaItem);
                                    client.add(ep.magnet, { path: targetPath });
                                    enqueued++;
                                }
                            }
                        }
                        persistDownloads();
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        enqueued,
                        message: `${enqueued} episódios da Temporada ${sNum} colocados para download!`,
                        savePath: targetPath,
                        destinationPath: `Cinelar\\Series\\${cleanSeries}\\${sStr}`
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Iniciar Download de Todas as Temporadas ou Todos os Episódios da Série
        if (pathname === '/api/series/download-all' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { imdbId, seriesName, preferredQuality, seasons, destination } = data;
                    if (!imdbId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'imdbId is required' }));
                        return;
                    }
                    const cleanSeries = (seriesName || 'Série').replace(/[\\/:*?"<>|]/g, '').trim();
                    const isDriveTarget = destination === 'drive' || destination === 'gdrive';
                    const baseSeries = isDriveTarget ? path.join(PLATFORM_DOWNLOAD_PATH, 'Series') : path.join(SAVE_PATH, 'Series');

                    let seasonsToDownload = Array.isArray(seasons) && seasons.length > 0 ? seasons : [];
                    if (seasonsToDownload.length === 0) {
                        const metaUrl = `https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(imdbId)}.json`;
                        const metaRes = await fetchJson(metaUrl);
                        const videos = metaRes?.meta?.videos || [];
                        const setS = new Set(videos.map(v => v.season).filter(s => s > 0));
                        seasonsToDownload = Array.from(setS).sort((a, b) => a - b);
                    }

                    if (seasonsToDownload.length === 0) {
                        seasonsToDownload = [1];
                    }

                    console.log(`[TorrentService] Iniciando download de todas as temporadas (${seasonsToDownload.join(', ')}) para série "${cleanSeries}" (${imdbId}) destino: ${isDriveTarget ? 'Google Drive' : 'Pasta Local'}`);

                    const queuedSeasons = [];
                    for (const sNum of seasonsToDownload) {
                        try {
                            const sStr = `Temporada ${String(sNum).padStart(2, '0')}`;
                            const targetPath = path.join(baseSeries, cleanSeries, sStr);
                            if (!fs.existsSync(targetPath)) {
                                fs.mkdirSync(targetPath, { recursive: true });
                            }

                            const streamPath = `series/${imdbId}:${sNum}:1`;
                            const [allStreamsRes, ptStreamsRes] = await Promise.allSettled([
                                fetchJson(`https://torrentio.strem.fun/stream/${streamPath}.json`),
                                fetchJson(`https://torrentio.strem.fun/language=portuguese/stream/${streamPath}.json`)
                            ]);

                            const streamsMap = new Map();
                            const addStream = (s) => {
                                const hashMatch = (s.infoHash || s.url || '').match(/([a-fA-F0-9]{40})/i);
                                const hash = hashMatch ? hashMatch[1].toLowerCase() : (s.infoHash || '');
                                if (!hash || streamsMap.has(hash)) return;

                                const titleStr = s.title || '';
                                const nameStr = s.name || '';
                                const full = `${nameStr} ${titleStr}`;

                                const isSeasonPack = /(completa|complete|temporada[\s\.\-_]*\d+|season[\s\.\-_]*\d+|\bS\d+[\s\.\-_]*complete)/i.test(full)
                                    || (/([0-9]+(\.[0-9]+)?\s*GB)/i.test(titleStr) && parseFloat(titleStr.match(/([0-9]+(\.[0-9]+)?)\s*GB/i)?.[1] || '0') > 3.5);

                                let quality = '1080p Full HD';
                                if (/4k|2160p|uhd/i.test(full)) quality = '4K UHD';
                                else if (/1080p|fhd/i.test(full)) quality = '1080p Full HD';
                                else if (/720p/i.test(full)) quality = '720p HD';
                                else if (/480p|sd/i.test(full)) quality = '480p SD';

                                const isPt = /dublado|dual|nacional|portuguese|português|brasil|pt-br/i.test(full);

                                streamsMap.set(hash, {
                                    id: hash,
                                    infoHash: hash,
                                    title: titleStr,
                                    quality,
                                    magnet: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(`${cleanSeries} S${String(sNum).padStart(2, '0')}`)}`,
                                    isPt,
                                    isSeasonPack
                                });
                            };

                            if (ptStreamsRes.status === 'fulfilled' && ptStreamsRes.value?.streams) {
                                ptStreamsRes.value.streams.forEach(addStream);
                            }
                            if (allStreamsRes.status === 'fulfilled' && allStreamsRes.value?.streams) {
                                allStreamsRes.value.streams.forEach(addStream);
                            }

                            const all = Array.from(streamsMap.values());
                            const pack = all.find(s => s.isSeasonPack && s.isPt) || all.find(s => s.isSeasonPack) || all[0];
                            if (pack && pack.infoHash) {
                                const existing = getActiveTorrent(pack.infoHash);
                                if (!existing) {
                                    const metaItem = {
                                        id: pack.infoHash,
                                        imdbId,
                                        title: `${cleanSeries} - Temporada ${sNum} Completa`,
                                        quality: pack.quality || preferredQuality || '1080p',
                                        magnet: pack.magnet,
                                        category: 'series',
                                        groupName: cleanSeries,
                                        isSeries: true,
                                        seriesName: cleanSeries,
                                        season: sNum,
                                        destination: isDriveTarget ? 'drive' : 'local',
                                        destinationPath: isDriveTarget ? `Cinelar\\Series\\${cleanSeries}\\${sStr}` : `Series\\${cleanSeries}\\${sStr}`,
                                        savePath: targetPath,
                                        saveLocation: isDriveTarget ? 'Google Drive (Cinelar)' : 'Pasta Local (D:\\Filmes)',
                                        status: 'downloading',
                                        createdAt: new Date().toISOString()
                                    };
                                    downloadsRegistry.set(pack.infoHash, metaItem);
                                    client.add(pack.magnet, { path: targetPath });
                                }
                                queuedSeasons.push({ season: sNum, infoHash: pack.infoHash, quality: pack.quality });
                            }
                        } catch (errSeason) {
                            console.error(`[TorrentService] Erro ao buscar torrents para temporada ${sNum}:`, errSeason.message);
                        }
                    }

                    persistDownloads();

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        seriesName: cleanSeries,
                        seasonsQueued: queuedSeasons.length,
                        details: queuedSeasons,
                        message: `${queuedSeasons.length} temporadas de "${cleanSeries}" foram adicionadas à fila de downloads!`
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
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
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Cache-Control': 'private, max-age=120'
                    });
                    res.end(JSON.stringify({ movies }));
                    return;
                } catch (err) {}
            }

            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, max-age=120'
            });
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
                        await markLocalMoviesInList(fresh.movies);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ movies: fresh.movies }));
                        return;
                    }
                } catch (err) {}
            }

            await markLocalMoviesInList(results.movies);
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

                    // Rastreadores ou tags brasileiras inequivocas
                    const isBrTracker = /(?:\u2699\uFE0F|\u2699)?\s*(Comando|BluDV|Lapumia|Vizer|MegaFilmes|BaixarFilme|ThePirateFilmes|StarckFilmes)/i.test(full);
                    const hasPtFlag = /(?:\uD83C\uDDE7\uD83C\uDDF7|\uD83C\uDDF5\uD83C\uDDF9)/.test(full);
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

                function isTorrentCam(fullText) {
                    return /\b(cam|hdcam|camrip|telesync|ts|telecine|tc|screener|scr|dvdscr)\b/i.test(fullText);
                }

                function detectTorrentQuality(fullText) {
                    if (isTorrentCam(fullText)) return 'HDCAM (Cinema)';
                    if (/\b(4k|2160p|uhd)\b/i.test(fullText)) return '4K UHD';
                    if (/\b(1080p|fhd|full[\s\-\.]*hd)\b/i.test(fullText)) return '1080p Full HD';
                    if (/\b(720p|hd)\b/i.test(fullText)) return '720p HD';
                    if (/\b(480p|sd|dvdrip)\b/i.test(fullText)) return '480p SD';
                    return '1080p Full HD';
                }

                function getTorrentStreamScore(s) {
                    let score = 0;
                    // 1. Prioridade máxima para Dublado / Dual Áudio
                    if (s.isDubbed) score += 10000;
                    else if (s.isPortuguese) score += 5000;

                    // 2. Penalidade drástica para CAM (gravação de cinema)
                    if (s.isCam) {
                        score -= 20000;
                    }

                    // 3. Resolução de imagem digital
                    if (s.quality === '1080p Full HD') score += 3000;
                    else if (s.quality === '4K UHD') score += 2800;
                    else if (s.quality === '720p HD') score += 1000;
                    else if (s.quality === '480p SD') score += 300;
                    else score += 1500;

                    // 4. Tipo de release (BluRay e WEB-DL têm bitrates superiores)
                    const text = `${s.filename || ''} ${s.rawTitle || ''}`.toLowerCase();
                    if (/bluray|remux|bdrip/i.test(text)) score += 500;
                    else if (/web-dl|webdl/i.test(text)) score += 400;
                    else if (/webrip/i.test(text)) score += 300;

                    // 5. Seeders para desempate entre torrents da mesma qualidade
                    score += Math.min(s.seeders || 0, 500);
                    return score;
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
                        const seedsMatch = s.title?.match(/(?:\uD83D\uDC64|[^\x00-\x7F])\s*(\d+)/);
                        const seeders = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;

                        const sizeMatch = s.title?.match(/(?:\uD83D\uDCBE|[^\x00-\x7F])\s*([\d\.]+\s*[GMK]B)/i);
                        const size = sizeMatch ? sizeMatch[1] : '';

                        const providerMatch = s.title?.match(/(?:\u2699\uFE0F|\u2699|[^\x00-\x7F])\s*([^\n\r]+)/);
                        const provider = providerMatch ? providerMatch[1].trim() : 'Torrentio';

                        const firstLine = (s.title || '').split('\n')[0].trim();
                        const filename = s.behaviorHints?.filename || firstLine;

                        const isCam = isTorrentCam(fullText);
                        const quality = detectTorrentQuality(fullText);

                        const audio = isDubbed ? 'Dublado / Dual Áudio' : 'Legenda PT-BR';

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
                            isCam,
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

                // Fallback essencial: Se não houver torrent com tag explícita PT-BR, inclui os melhores streams em áudio original/multilanguage
                if (streamMap.size === 0) {
                    const fallbackStreams = [
                        ...(allStreamsRes.status === 'fulfilled' && Array.isArray(allStreamsRes.value?.streams) ? allStreamsRes.value.streams : []),
                        ...(brProvidersRes.status === 'fulfilled' && Array.isArray(brProvidersRes.value?.streams) ? brProvidersRes.value.streams : [])
                    ];

                    for (const s of fallbackStreams) {
                        if (!s.infoHash) continue;
                        const key = s.infoHash.toLowerCase();
                        if (streamMap.has(key)) continue;

                        const fullText = `${s.name || ''} ${s.title || ''}`;
                        const seedsMatch = s.title?.match(/(?:\uD83D\uDC64|[^\x00-\x7F])\s*(\d+)/);
                        const seeders = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;
                        const sizeMatch = s.title?.match(/(?:\uD83D\uDCBE|[^\x00-\x7F])\s*([\d\.]+\s*[GMK]B)/i);
                        const size = sizeMatch ? sizeMatch[1] : '';
                        const providerMatch = s.title?.match(/(?:\u2699\uFE0F|\u2699|[^\x00-\x7F])\s*([^\n\r]+)/);
                        const provider = providerMatch ? providerMatch[1].trim() : 'Torrentio';
                        const firstLine = (s.title || '').split('\n')[0].trim();
                        const filename = s.behaviorHints?.filename || firstLine;

                        const isCam = isTorrentCam(fullText);
                        const quality = detectTorrentQuality(fullText);

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
                            audio: 'Áudio Original / Legenda',
                            isPortuguese: false,
                            isDubbed: false,
                            isCam,
                            seeders,
                            size,
                            provider,
                            filename,
                            magnetUri,
                            rawName: s.name,
                            rawTitle: s.title
                        });

                        // Limita fallback aos 15 melhores
                        if (streamMap.size >= 15) break;
                    }
                }

                const torrents = Array.from(streamMap.values()).sort((a, b) => {
                    return getTorrentStreamScore(b) - getTorrentStreamScore(a);
                });

                // Verifica se o filme já existe salvo na pasta D:\filmes
                let localFile = null;
                try {
                    const localMovies = await getLocalLibrary(SAVE_PATH, false, getActiveDownloadingPaths());
                    const found = localMovies.find(l => (imdb && l.imdbId === imdb) || (titleParam && l.cleanName.toLowerCase() === titleParam.toLowerCase()));
                    if (found) {
                        localFile = {
                            title: found.title,
                            quality: found.quality,
                            sizeFormatted: found.sizeFormatted,
                            streamUrl: found.streamUrl,
                            format: found.format,
                            videoPath: found.videoPath,
                            duration: found.duration || 0
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

        // Get local movies library (from D:\filmes and G:\Meu Drive\cinelar)
        if (pathname === '/api/local-movies' && req.method === 'GET') {
            try {
                const force = urlObj.searchParams.get('force') === 'true';
                let movies = await getLocalLibrary(SAVE_PATH, force, getActiveDownloadingPaths());

                // Se houver filmes na pasta mapeada do Google Drive (G:\Meu Drive\cinelar), unifica identificando origem
                if (PLATFORM_DOWNLOAD_PATH && fs.existsSync(PLATFORM_DOWNLOAD_PATH)) {
                    const normSave = path.resolve(SAVE_PATH).toLowerCase();
                    const normPlatform = path.resolve(PLATFORM_DOWNLOAD_PATH).toLowerCase();
                    if (normPlatform !== normSave && !normPlatform.startsWith(normSave + path.sep)) {
                        const driveItems = await getLocalLibrary(PLATFORM_DOWNLOAD_PATH, force, getActiveDownloadingPaths());
                        const taggedDriveItems = driveItems.map(m => ({
                            ...m,
                            isCloud: true,
                            isDrive: true,
                            storageLocation: 'drive',
                            source: 'Google Drive'
                        }));
                        movies = movies.concat(taggedDriveItems);
                    }
                }

                const totalBytes = movies.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
                const grouped = groupMediaLibrary(movies);

                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'private, max-age=15'
                });
                res.end(JSON.stringify({
                    movies,
                    count: movies.length,
                    totalSize: formatBytes(totalBytes),
                    franchises: grouped.franchises,
                    series: grouped.series,
                    standaloneMovies: grouped.standaloneMovies,
                    savePath: SAVE_PATH,
                    drivePath: PLATFORM_DOWNLOAD_PATH
                }));
            } catch (err) {
                console.error('[TorrentService] Local movies error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // Google Drive / Cloud synchronized movies strictly from G:\Meu Drive\cinelar
        if (pathname === '/api/gdrive/files' && req.method === 'GET') {
            try {
                const cinelarPath = PLATFORM_DOWNLOAD_PATH;
                let movies = [];
                if (fs.existsSync(cinelarPath)) {
                    movies = await getLocalLibrary(cinelarPath, false, getActiveDownloadingPaths());
                }
                // Se houver pasta Cinelar legada no D:\Filmes diferente da pasta mapeada atual, unifica
                const legacyCinelar = path.join(SAVE_PATH, 'Cinelar');
                if (fs.existsSync(legacyCinelar) && path.resolve(legacyCinelar).toLowerCase() !== path.resolve(cinelarPath).toLowerCase()) {
                    const legacyMovies = await getLocalLibrary(legacyCinelar, false, getActiveDownloadingPaths());
                    movies = movies.concat(legacyMovies);
                }
                const cloudMovies = movies.map(m => ({
                    ...m,
                    isCloud: true,
                    isDrive: true,
                    storageLocation: 'drive',
                    quality: 'Google Drive',
                    source: 'Google Drive'
                }));

                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'private, max-age=15'
                });
                res.end(JSON.stringify({
                    movies: cloudMovies,
                    count: cloudMovies.length,
                    syncPath: cinelarPath
                }));
            } catch (err) {
                console.error('[TorrentService] GDrive files error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message, movies: [] }));
            }
            return;
        }

        // Automatic poster discovery endpoint for any movie missing or failing cover art
        if (pathname === '/api/movies/poster' && req.method === 'GET') {
            try {
                const imdbId = (urlObj.searchParams.get('imdbId') || '').trim();
                const title = (urlObj.searchParams.get('title') || '').trim();
                const yearParam = parseInt(urlObj.searchParams.get('year'), 10) || null;

                let resolved = null;
                if (imdbId && imdbId.startsWith('tt')) {
                    resolved = await fetchPtBrMetadata(imdbId);
                }
                if ((!resolved || !resolved.poster) && title) {
                    resolved = await searchPtBrMovie(title, yearParam);
                }

                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600'
                });
                res.end(JSON.stringify({
                    poster: resolved?.poster || '',
                    backdrop: resolved?.backdrop || resolved?.poster || '',
                    title: resolved?.titleBr || title
                }));
            } catch (err) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ poster: '', backdrop: '' }));
            }
            return;
        }

        // Rescan local movies library
        if (pathname === '/api/local-movies/rescan' && req.method === 'POST') {
            try {
                const movies = await getLocalLibrary(SAVE_PATH, true, getActiveDownloadingPaths());
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
        if (pathname === '/api/local/stream' && (req.method === 'GET' || req.method === 'HEAD')) {
            const filePath = urlObj.searchParams.get('file');
            if (!filePath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'file query parameter is required' }));
                return;
            }
            if (!isAllowedMediaPath(filePath)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Acesso negado: arquivo fora da biblioteca local' }));
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

        // Delete local movie file from disk (ultra-responsivo: remove do cache em O(1) e libera torrents que travem o arquivo)
        if (pathname === '/api/local/file' && req.method === 'DELETE') {
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const filePath = data.path || urlObj.searchParams.get('path');
                    if (!filePath) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Parâmetro path é obrigatório' }));
                        return;
                    }

                    const targetPath = path.resolve(filePath);

                    if (!isAllowedMediaPath(targetPath)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Acesso negado: só é permitido excluir arquivos da pasta de filmes' }));
                        return;
                    }

                    // 1. Remove do cache em memória imediatamente em O(1) sem forçar re-scan lento do disco
                    removeFileFromLocalCache(filePath);
                    invalidateLocalSetsCache();

                    // 2. Se houver um download/torrent segurando este arquivo ou pasta, remove e fecha os handles
                    const targetDir = path.dirname(targetPath);
                    for (const [dlId, dlItem] of downloadsRegistry.entries()) {
                        const dlSave = dlItem?.savePath ? path.resolve(dlItem.savePath) : '';
                        if (dlSave && (isPathInsideBase(targetPath, dlSave) || isPathInsideBase(dlSave, targetDir))) {
                            const activeT = getActiveTorrent(dlId);
                            if (activeT) {
                                try { activeT.destroy({ destroyStore: true }); } catch (_) {}
                            }
                            downloadsRegistry.delete(dlId);
                            persistDownloads();
                        }
                    }

                    // 3. Responde 200 OK imediatamente e executa exclusão física + atualização do banco
                    const targetBase = (filePath.toLowerCase().startsWith('g:\\') || filePath.toLowerCase().includes('meu drive')) ? PLATFORM_DOWNLOAD_PATH : SAVE_PATH;
                    try {
                        deleteLocalFile(filePath, targetBase);
                    } catch (_) {
                        setTimeout(() => {
                            try { deleteLocalFile(filePath, targetBase); } catch (_) {}
                        }, 300);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: 'Arquivo excluído do computador com sucesso' }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Rename local movie / video file
        if (pathname === '/api/local/rename' && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const { filePath, newTitle } = data;
                    if (!filePath || !newTitle) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Parâmetros filePath e newTitle são obrigatórios' }));
                        return;
                    }

                    const targetPath = path.resolve(filePath);

                    if (!isAllowedMediaPath(targetPath)) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Acesso negado: só é permitido alterar arquivos da pasta de filmes' }));
                        return;
                    }

                    const targetBase = (PLATFORM_DOWNLOAD_PATH && isPathInsideBase(targetPath, PLATFORM_DOWNLOAD_PATH)) ? PLATFORM_DOWNLOAD_PATH : SAVE_PATH;
                    const newPath = renameLocalFile(filePath, newTitle, targetBase);
                    invalidateLocalCache();
                    invalidateLocalSetsCache();
                    scanLocalMovies(SAVE_PATH);
                    if (PLATFORM_DOWNLOAD_PATH && PLATFORM_DOWNLOAD_PATH !== SAVE_PATH) {
                        scanLocalMovies(PLATFORM_DOWNLOAD_PATH);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Arquivo renomeado com sucesso',
                        oldPath: filePath,
                        newPath
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // List active / completed downloads (exclui sessões temporárias de streaming online)
        if (pathname === '/api/downloads' && req.method === 'GET') {
            const list = Array.from(downloadsRegistry.values())
                .filter(meta => meta && meta.quality !== 'Streaming')
                .map(meta => {
                let torrent = getActiveTorrent(meta.id);
                if (!torrent && meta.status === 'downloading' && !meta.isPaused && meta.magnet) {
                    torrent = ensureTorrentRunningForDownload(meta);
                }
                let poster = meta.poster;
                let backdrop = meta.backdrop || meta.poster;
                if (!poster && meta.imdbId) {
                    try {
                        const local = getMovieById(meta.imdbId);
                        if (local && local.poster) {
                            poster = local.poster;
                            backdrop = local.backdrop || local.poster;
                        } else if (meta.imdbId.startsWith('tt')) {
                            poster = `https://images.metahub.space/poster/small/${meta.imdbId}/img`;
                            backdrop = `https://images.metahub.space/background/medium/${meta.imdbId}/img`;
                        }
                    } catch (_) {}
                }
                if (!poster && meta.title) {
                    try {
                        const found = searchCatalog(meta.title, { limit: 1 })?.[0];
                        if (found && found.poster) {
                            poster = found.poster;
                            backdrop = found.backdrop || found.poster;
                            meta.poster = poster;
                            meta.backdrop = backdrop;
                        }
                    } catch (_) {}
                }

                const isDone = Boolean(torrent?.done || meta.status === 'completed' || (meta.progress && meta.progress >= 100));
                const isPaused = Boolean(torrent?.paused || meta.isPaused || meta.status === 'paused');
                const hasError = Boolean(meta.status === 'error' || meta.errorMessage || meta.error);

                let stage = 'downloading';
                let stageLabel = 'Baixando';
                let stageMessage = '';

                if (hasError) {
                    stage = 'error';
                    stageLabel = 'Atenção';
                    stageMessage = meta.errorMessage || meta.error || 'Falha na gravação ou espaço em disco insuficiente.';
                } else if (isDone) {
                    stage = 'completed';
                    stageLabel = 'Concluído';
                    stageMessage = 'Download concluído e gravado no disco.';
                } else if (isPaused) {
                    stage = 'paused';
                    stageLabel = 'Pausado';
                    stageMessage = 'Download pausado. Clique em Retomar para continuar.';
                } else if (!torrent) {
                    stage = 'searching_peers';
                    stageLabel = 'Iniciando';
                    stageMessage = 'Preparando download e alocando recursos...';
                } else if (torrent.numPeers === 0 && (!torrent.downloaded || torrent.downloaded === 0)) {
                    stage = 'searching_peers';
                    stageLabel = 'Buscando Fontes';
                    stageMessage = 'Localizando sementes (peers/seeds) ativas na rede DHT...';
                } else if (torrent.numPeers > 0 && (!torrent.downloadSpeed || torrent.downloadSpeed === 0) && (!torrent.downloaded || torrent.downloaded === 0)) {
                    stage = 'connecting';
                    stageLabel = 'Conectando';
                    stageMessage = `Conectado a ${torrent.numPeers} semente(s). Negociando mapa de peças...`;
                } else {
                    stage = 'downloading';
                    stageLabel = 'Baixando';
                    const speedStr = formatBytes(torrent.downloadSpeed) + '/s';
                    stageMessage = `Baixando a ${speedStr} de ${torrent.numPeers} fonte(s) ativas.`;
                }

                const progressVal = isDone ? 100 : (torrent ? parseFloat((torrent.progress * 100).toFixed(1)) : (meta.progress || 0));
                const dlSpeed = (isDone || isPaused || !torrent) ? '0 B/s' : formatBytes(torrent.downloadSpeed) + '/s';
                const ulSpeed = (isDone || isPaused || !torrent) ? '0 B/s' : formatBytes(torrent.uploadSpeed) + '/s';
                const dlBytes = torrent ? torrent.downloaded : (meta.downloadedBytes || 0);
                const totBytes = torrent ? torrent.length : (meta.totalBytes || 0);
                const peers = (isPaused || !torrent) ? 0 : torrent.numPeers;
                const timeRem = isDone ? 'Concluído' : (isPaused ? 'Pausado' : (torrent ? formatTime(torrent.timeRemaining) : 'Calculando...'));
                const canPlay = Boolean(isDone || torrent?.ready || dlBytes > 1024 * 1024 || progressVal > 0.05);

                const isDriveTarget = meta.destination === 'drive' || String(meta.destinationPath || meta.savePath || '').toLowerCase().includes('cinelar') || String(meta.destinationPath || meta.savePath || '').toLowerCase().startsWith('g:\\');

                return {
                    id: meta.id,
                    infoHash: meta.id,
                    imdbId: meta.imdbId,
                    title: meta.title,
                    quality: meta.quality,
                    name: torrent?.name || meta.title,
                    poster: poster || '',
                    backdrop: backdrop || '',
                    overview: meta.overview || '',
                    year: meta.year || '',
                    progress: progressVal,
                    downloadSpeed: dlSpeed,
                    uploadSpeed: ulSpeed,
                    downloaded: torrent ? formatBytes(torrent.downloaded) : (meta.downloaded || (isDone ? 'Concluído' : '0 B')),
                    total: torrent ? formatBytes(torrent.length) : (meta.total || ''),
                    totalBytes: totBytes,
                    downloadedBytes: dlBytes,
                    numPeers: peers,
                    timeRemaining: timeRem,
                    status: hasError ? 'error' : (isDone ? 'completed' : (isPaused ? 'paused' : 'downloading')),
                    isPaused: isPaused,
                    stage: stage,
                    stageLabel: stageLabel,
                    stageMessage: stageMessage,
                    errorMessage: meta.errorMessage || meta.error || null,
                    canPlay: canPlay,
                    streamUrl: `/api/stream/${meta.id}?magnet=${encodeURIComponent(meta.magnet || torrent?.magnetURI || '')}&title=${encodeURIComponent(meta.title)}`,
                    magnet: meta.magnet || torrent?.magnetURI || '',
                    destination: isDriveTarget ? 'drive' : 'local',
                    destinationPath: meta.destinationPath || (isDriveTarget ? `Cinelar\\${meta.title}` : `Filmes\\${meta.title}`),
                    savePath: meta.savePath || (isDriveTarget ? PLATFORM_DOWNLOAD_PATH : SAVE_PATH),
                    saveLocation: isDriveTarget ? 'Google Drive (Cinelar)' : 'Pasta Local (D:\\Filmes)',
                    category: meta.category || 'movie',
                    groupName: meta.groupName || null,
                    season: meta.season || null,
                    episode: meta.episode || null,
                    isSeries: Boolean(meta.isSeries),
                    createdAt: meta.createdAt
                };
            });

            // Armazenamento em D:\Filmes (Local PC)
            let freeSpaceGB = null;
            let totalSpaceGB = null;
            let usedSpaceGB = null;
            try {
                if (fs.existsSync(SAVE_PATH)) {
                    const st = fs.statfsSync(SAVE_PATH);
                    freeSpaceGB = parseFloat(((st.bfree * st.bsize) / (1024 ** 3)).toFixed(1));
                    totalSpaceGB = parseFloat(((st.blocks * st.bsize) / (1024 ** 3)).toFixed(1));
                    usedSpaceGB = parseFloat((totalSpaceGB - freeSpaceGB).toFixed(1));
                }
            } catch (_) {}

            // Armazenamento em Google Drive (G:\Meu Drive\cinelar) se configurado
            let driveFreeGB = null;
            let driveTotalGB = null;
            let driveUsedGB = null;
            try {
                if (PLATFORM_DOWNLOAD_PATH && PLATFORM_DOWNLOAD_PATH !== SAVE_PATH && fs.existsSync(PLATFORM_DOWNLOAD_PATH)) {
                    const st = fs.statfsSync(PLATFORM_DOWNLOAD_PATH);
                    driveFreeGB = parseFloat(((st.bfree * st.bsize) / (1024 ** 3)).toFixed(1));
                    driveTotalGB = parseFloat(((st.blocks * st.bsize) / (1024 ** 3)).toFixed(1));
                    driveUsedGB = parseFloat((driveTotalGB - driveFreeGB).toFixed(1));
                }
            } catch (_) {}

            // Métricas agregadas
            let totalDownloadSpeedBytes = 0;
            let totalUploadSpeedBytes = 0;
            let activeCount = 0;
            let completedCount = 0;
            let pausedCount = 0;

            list.forEach(item => {
                if ((item.status === 'downloading' || item.stage === 'searching_peers' || item.stage === 'connecting' || item.stage === 'downloading') && !item.isPaused) {
                    activeCount++;
                    const t = getActiveTorrent(item.id);
                    if (t) {
                        totalDownloadSpeedBytes += t.downloadSpeed || 0;
                        totalUploadSpeedBytes += t.uploadSpeed || 0;
                    }
                } else if (item.status === 'completed' || item.stage === 'completed') {
                    completedCount++;
                } else if (item.status === 'paused' || item.isPaused) {
                    pausedCount++;
                }
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                downloads: list,
                storage: {
                    freeSpaceGB,
                    totalSpaceGB,
                    usedSpaceGB,
                    savePath: SAVE_PATH,
                    local: {
                        path: SAVE_PATH,
                        freeGB: freeSpaceGB,
                        totalGB: totalSpaceGB,
                        usedGB: usedSpaceGB
                    },
                    drive: PLATFORM_DOWNLOAD_PATH && PLATFORM_DOWNLOAD_PATH !== SAVE_PATH ? {
                        path: PLATFORM_DOWNLOAD_PATH,
                        freeGB: driveFreeGB,
                        totalGB: driveTotalGB,
                        usedGB: driveUsedGB,
                        isLowSpace: driveFreeGB !== null && driveFreeGB < 2.0
                    } : null
                },
                stats: {
                    activeCount,
                    completedCount,
                    pausedCount,
                    totalDownloads: list.length,
                    totalDownloadSpeed: formatBytes(totalDownloadSpeedBytes) + '/s',
                    totalUploadSpeed: formatBytes(totalUploadSpeedBytes) + '/s'
                }
            }));
            return;
        }

        // Torrent Streaming Status (Stremio style)
        if (pathname.startsWith('/api/stream/') && pathname.endsWith('/status') && req.method === 'GET') {
            const infoHash = pathname.replace('/api/stream/', '').replace('/status', '').trim().toLowerCase();
            const torrent = getActiveTorrent(infoHash);

            // Verifica se o arquivo já existe em disco
            const magnetParam = urlObj.searchParams.get('magnet') || '';
            let dnParam = urlObj.searchParams.get('dn') || '';
            if (!dnParam && magnetParam) {
                const dnMatch = magnetParam.match(/[?&]dn=([^&]+)/i);
                if (dnMatch) {
                    try { dnParam = decodeURIComponent(dnMatch[1]); } catch (_) { dnParam = dnMatch[1]; }
                }
            }
            const safeDn = dnParam ? path.basename(dnParam.trim()) : '';
            if (safeDn && safeDn !== '.' && safeDn !== '..') {
                const dnNoExt = safeDn.replace(/\.[^.]+$/, '');
                const candidates = [
                    path.join(PLATFORM_DOWNLOAD_PATH, safeDn),
                    path.join(PLATFORM_DOWNLOAD_PATH, dnNoExt, safeDn),
                    path.join(SAVE_PATH, safeDn),
                    path.join(SAVE_PATH, dnNoExt, safeDn)
                ].filter(cand => isAllowedMediaPath(cand));
                for (const cand of candidates) {
                    try {
                        if (fs.existsSync(cand) && fs.statSync(cand).isFile() && fs.statSync(cand).size > 1024 * 1024) {
                            const size = fs.statSync(cand).size;
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({
                                ready: true,
                                name: safeDn,
                                fileName: path.basename(cand),
                                fileLength: size,
                                progress: '100.0',
                                downloadSpeed: '100 MB/s',
                                numPeers: 1,
                                canPlay: true,
                                downloaded: formatBytes(size),
                                total: formatBytes(size)
                            }));
                            return;
                        }
                    } catch (_) {}
                }
            }

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

        // Interrompe streaming sob demanda
        if (pathname.startsWith('/api/stream/') && pathname.endsWith('/stop')) {
            const infoHash = pathname.replace('/api/stream/', '').replace('/stop', '').trim().toLowerCase();
            console.log(`[Streaming] Solicitacao para interromper streaming sob demanda: ${infoHash}`);
            stopStreamingTorrent(infoHash);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Streaming sob demanda encerrado.' }));
            return;
        }

        // Live Torrent Streaming endpoint (Range / 206 Partial Content com fallback de transcode)
        if (pathname.startsWith('/api/stream/') && (req.method === 'GET' || req.method === 'HEAD')) {
            const infoHash = pathname.replace('/api/stream/', '').trim().toLowerCase();
            let torrent = getActiveTorrent(infoHash);

            // Registra cliente de streaming ativo e cancela timer de inatividade
            if (streamIdleTimers.has(infoHash)) {
                clearTimeout(streamIdleTimers.get(infoHash));
                streamIdleTimers.delete(infoHash);
            }
            activeStreamClients.set(infoHash, (activeStreamClients.get(infoHash) || 0) + 1);

            const handleStreamDisconnect = () => {
                const count = (activeStreamClients.get(infoHash) || 1) - 1;
                if (count <= 0) {
                    activeStreamClients.delete(infoHash);
                    const meta = downloadsRegistry.get(infoHash);
                    if (!meta || meta.quality === 'Streaming') {
                        if (!streamIdleTimers.has(infoHash)) {
                            const timer = setTimeout(() => {
                                streamIdleTimers.delete(infoHash);
                                stopStreamingTorrent(infoHash);
                            }, 35000);
                            streamIdleTimers.set(infoHash, timer);
                        }
                    }
                } else {
                    activeStreamClients.set(infoHash, count);
                }
            };
            req.on('close', handleStreamDisconnect);

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

                torrent = client.add(magnet, { path: PLATFORM_DOWNLOAD_PATH });

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
                    console.log(`[Streaming] Stream completely downloaded: "${torrent.name}"!`);
                    if (metaItem.quality !== 'Streaming') {
                        metaItem.status = 'completed';
                        metaItem.progress = 100;
                        metaItem.downloaded = formatBytes(torrent.length);
                        metaItem.total = formatBytes(torrent.length);
                        persistDownloads();
                        scanLocalMovies(SAVE_PATH);
                    }
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
                if (file.name.endsWith('.webm')) contentType = 'video/webm';
                else if (file.name.endsWith('.avi')) contentType = 'video/x-msvideo';

                const isTranscode = urlObj.searchParams.get('transcode') === '1';
                const startTimeParam = parseFloat(urlObj.searchParams.get('startTime') || urlObj.searchParams.get('t') || 0);
                const isMkvOrIncompatible = /\.(mkv|avi|wmv|flv|mov|ts|vob)$/i.test(file.name);

                // Tizen/Chromium HTML5 <video> exige container MP4 para exibir o quadro de video (MKV puro toca apenas o audio!)
                if ((isTranscode || isMkvOrIncompatible) && RESOLVED_FFMPEG) {
                    // Tenta achar arquivo local no disco (inclusive em subpasta com o nome do release)
                    const baseNoExt = (file.name || '').replace(/\.[^.]+$/, '');
                    const dlMeta = downloadsRegistry.get(infoHash);
                    const possibleDiskPaths = [
                        file.path,
                        dlMeta?.savePath ? path.join(dlMeta.savePath, file.name) : null,
                        dlMeta?.savePath ? path.join(dlMeta.savePath, file.path) : null,
                        path.join(PLATFORM_DOWNLOAD_PATH, file.path),
                        path.join(PLATFORM_DOWNLOAD_PATH, file.name),
                        path.join(PLATFORM_DOWNLOAD_PATH, baseNoExt, file.name),
                        path.join(SAVE_PATH, file.path),
                        path.join(SAVE_PATH, file.name),
                        path.join(SAVE_PATH, baseNoExt, file.name)
                    ].filter(Boolean);
                    let diskFilePath = null;
                    for (const dp of possibleDiskPaths) {
                        try {
                            if (isAllowedMediaPath(dp) && fs.existsSync(dp) && fs.statSync(dp).isFile() && fs.statSync(dp).size > 1024 * 1024) {
                                diskFilePath = dp;
                                break;
                            }
                        } catch (_) {}
                    }

                    const mediaDur = diskFilePath ? (getMediaInfo(diskFilePath).duration || 0) : 0;

                    if (req.method === 'HEAD') {
                        res.writeHead(200, {
                            'Content-Type': 'video/mp4',
                            'Accept-Ranges': 'none',
                            'X-Media-Duration': String(mediaDur),
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
                        });
                        res.end();
                        return;
                    }

                    console.log(`[StreamingTranscode] Ativando remux/conversao em tempo real com FFmpeg para "${file.name}" (start: ${startTimeParam}s, dur: ${mediaDur}s)`);

                    const args = [
                        '-hide_banner',
                        '-loglevel', 'error',
                        '-fflags', '+genpts+discardcorrupt',
                        '-analyzeduration', '2000000',
                        '-probesize', '2000000'
                    ];

                    if (startTimeParam > 0 && diskFilePath) {
                        args.push('-ss', String(startTimeParam));
                    }

                    let ffmpegUsePipe = false;
                    if (diskFilePath) {
                        args.push('-i', diskFilePath);
                    } else {
                        ffmpegUsePipe = true;
                        args.push('-i', 'pipe:0');
                    }

                    // Preserva 100% da qualidade original copiando o stream de video (-c:v copy) para MP4/MKV/MOV
                    const isVideoCompatible = /\.(mp4|mkv|mov|m4v)$/i.test(file.name);
                    const vArgs = isVideoCompatible
                        ? ['-c:v', 'copy']
                        : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-maxrate', '12M', '-bufsize', '24M'];

                    // Audio: converte ou garante AAC 256k estereo compativel com qualquer TV
                    const isAudioAac = file.name.endsWith('.mp4');
                    const aArgs = isAudioAac
                        ? ['-c:a', 'copy']
                        : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2'];

                    args.push(
                        ...vArgs,
                        ...aArgs,
                        '-sn',
                        '-avoid_negative_ts', 'make_zero',
                        '-f', 'mp4',
                        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                        'pipe:1'
                    );

                    res.writeHead(200, {
                        'Content-Type': 'video/mp4',
                        'Accept-Ranges': 'none',
                        'Cache-Control': 'no-cache, no-store',
                        'X-Media-Duration': String(mediaDur),
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
                    });

                    const ffmpegProc = spawn(RESOLVED_FFMPEG, args, { stdio: [ffmpegUsePipe ? 'pipe' : 'ignore', 'pipe', 'ignore'] });

                    if (ffmpegUsePipe) {
                        const inStream = file.createReadStream();
                        inStream.pipe(ffmpegProc.stdin);
                        inStream.on('error', (err) => {
                            console.warn('[StreamingTranscode] InStream warning:', err.message);
                        });
                    }

                    ffmpegProc.stdout.pipe(res);

                    req.on('close', () => {
                        try {
                            ffmpegProc.kill('SIGKILL');
                        } catch (_) {}
                    });

                    ffmpegProc.on('error', (err) => {
                        console.error('[StreamingTranscode] FFmpeg proc error:', err.message);
                        if (!res.headersSent) res.writeHead(500);
                        res.end();
                    });

                    return;
                }

                if (req.method === 'HEAD') {
                    res.writeHead(200, {
                        'Content-Length': total,
                        'Content-Type': contentType,
                        'Accept-Ranges': 'bytes',
                        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
                    });
                    res.end();
                    return;
                }

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

            // 1. Verifica se já temos o arquivo em disco para tocar imediatamente sem esperar peers
            const magnetParam = urlObj.searchParams.get('magnet') || '';
            let dnParam = urlObj.searchParams.get('dn') || '';
            if (!dnParam && magnetParam) {
                const dnMatch = magnetParam.match(/[?&]dn=([^&]+)/i);
                if (dnMatch) {
                    try { dnParam = decodeURIComponent(dnMatch[1]); } catch (_) { dnParam = dnMatch[1]; }
                }
            }

            let foundLocalFile = null;
            const safeDn = dnParam ? path.basename(dnParam.trim()) : '';
            if (safeDn && safeDn !== '.' && safeDn !== '..') {
                const dnNoExt = safeDn.replace(/\.[^.]+$/, '');
                const candidates = [
                    path.join(PLATFORM_DOWNLOAD_PATH, safeDn),
                    path.join(PLATFORM_DOWNLOAD_PATH, dnNoExt, safeDn),
                    path.join(SAVE_PATH, safeDn),
                    path.join(SAVE_PATH, dnNoExt, safeDn)
                ].filter(cand => isAllowedMediaPath(cand));
                for (const cand of candidates) {
                    try {
                        if (fs.existsSync(cand) && fs.statSync(cand).isFile() && fs.statSync(cand).size > 1024 * 1024) {
                            foundLocalFile = {
                                path: cand,
                                name: path.basename(cand),
                                length: fs.statSync(cand).size,
                                createReadStream: (opts) => fs.createReadStream(cand, opts)
                            };
                            break;
                        }
                    } catch (_) {}
                }
            }

            if (foundLocalFile) {
                console.log(`[Streaming] Arquivo local detectado em disco para ${infoHash}: "${foundLocalFile.name}" (${(foundLocalFile.length / 1024 / 1024).toFixed(1)} MB)`);
                streamFile(foundLocalFile);
                return;
            }

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
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { magnet, imdbId, title, quality, filename, isSeries, seriesName, season, episode, overview, year } = data;
                    let poster = data.poster || '';
                    let backdrop = data.backdrop || poster;

                    if (!poster && imdbId) {
                        try {
                            const local = getMovieById(imdbId);
                            if (local && local.poster) {
                                poster = local.poster;
                                backdrop = local.backdrop || local.poster;
                            } else if (imdbId.startsWith('tt')) {
                                poster = `https://images.metahub.space/poster/medium/${imdbId}/img`;
                                backdrop = `https://images.metahub.space/background/medium/${imdbId}/img`;
                            }
                        } catch (_) {}
                    }

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

                    // Cancela qualquer timer de encerramento de stream temporário caso o usuário tenha clicado em Baixar
                    if (streamIdleTimers.has(infoHash)) {
                        clearTimeout(streamIdleTimers.get(infoHash));
                        streamIdleTimers.delete(infoHash);
                    }

                    const isDriveTarget = data.destination === 'drive' || data.destination === 'gdrive';
                    const baseFolder = isDriveTarget ? PLATFORM_DOWNLOAD_PATH : SAVE_PATH;
                    const org = getOrganizedDownloadPath(baseFolder, title, filename, { isSeries, seriesName, season, episode });
                    try {
                        if (!fs.existsSync(org.targetPath)) {
                            fs.mkdirSync(org.targetPath, { recursive: true });
                        }
                    } catch (e) {
                        console.warn('[TorrentService] Could not create target directory:', e.message);
                    }

                    if (!poster && title) {
                        try {
                            const found = searchCatalog(title, { limit: 1 })?.[0];
                            if (found && found.poster) {
                                poster = found.poster;
                                backdrop = found.backdrop || found.poster;
                            }
                        } catch (_) {}
                    }

                    console.log(`[TorrentService] Starting organized download: "${title || filename}" into ${org.targetPath} (Destino: ${isDriveTarget ? 'Google Drive' : 'Pasta Local'}, ${org.category}: ${org.groupName || 'filme'})`);

                    const existingMeta = downloadsRegistry.get(infoHash);
                    const existingTorrent = getActiveTorrent(infoHash);

                    const metaItem = {
                        id: infoHash,
                        imdbId: imdbId || existingMeta?.imdbId || '',
                        title: title || filename || existingMeta?.title || 'Filme',
                        quality: (quality && quality !== 'Streaming') ? quality : (existingMeta?.quality && existingMeta.quality !== 'Streaming' ? existingMeta.quality : '1080p Full HD'),
                        magnet: magnet,
                        poster: poster || existingMeta?.poster || '',
                        backdrop: backdrop || existingMeta?.backdrop || poster || '',
                        overview: overview || existingMeta?.overview || '',
                        year: year || existingMeta?.year || '',
                        category: org.category,
                        groupName: org.groupName,
                        isSeries: Boolean(isSeries || org.category === 'series'),
                        seriesName: seriesName || org.groupName,
                        season: season || null,
                        episode: episode || null,
                        destination: isDriveTarget ? 'drive' : 'local',
                        destinationPath: org.displayPath,
                        savePath: existingTorrent?.path || org.targetPath,
                        saveLocation: isDriveTarget ? 'Google Drive (Cinelar)' : 'Pasta Local (D:\\Filmes)',
                        status: existingTorrent?.done ? 'completed' : 'downloading',
                        progress: existingTorrent ? parseFloat((existingTorrent.progress * 100).toFixed(1)) : 0,
                        isPaused: false,
                        errorMessage: null,
                        error: null,
                        createdAt: existingMeta?.createdAt || new Date().toISOString()
                    };
                    downloadsRegistry.set(infoHash, metaItem);
                    persistDownloads();

                    if (existingTorrent) {
                        try {
                            if (existingTorrent.paused && typeof existingTorrent.resume === 'function') {
                                existingTorrent.resume();
                            }
                        } catch (_) {}
                        attachPermanentTorrentHandlers(existingTorrent, infoHash);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            success: true,
                            message: 'Download ativo vinculado com sucesso',
                            id: infoHash,
                            title: metaItem.title
                        }));
                        return;
                    }

                    const torrent = client.add(magnet, { path: org.targetPath });
                    attachPermanentTorrentHandlers(torrent, infoHash);

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

        // Pause download
        if (pathname.startsWith('/api/downloads/') && pathname.endsWith('/pause') && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            const id = pathname.replace('/api/downloads/', '').replace('/pause', '').trim().toLowerCase();
            const torrent = getActiveTorrent(id);
            if (torrent) {
                try {
                    torrent.pause();
                } catch (e) {
                    console.warn(`[TorrentService] Erro ao pausar torrent ${id}:`, e.message);
                }
            }
            const meta = downloadsRegistry.get(id);
            if (meta) {
                meta.status = 'paused';
                meta.isPaused = true;
                persistDownloads();
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Download pausado', id }));
            return;
        }

        // Resume download
        if (pathname.startsWith('/api/downloads/') && pathname.endsWith('/resume') && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            const id = pathname.replace('/api/downloads/', '').replace('/resume', '').trim().toLowerCase();
            let torrent = getActiveTorrent(id);
            const meta = downloadsRegistry.get(id);

            if (torrent) {
                try {
                    torrent.resume();
                } catch (e) {
                    console.warn(`[TorrentService] Erro ao retomar torrent ${id}:`, e.message);
                }
            } else if (meta && meta.magnet) {
                try {
                    torrent = client.add(meta.magnet, { path: meta.savePath || PLATFORM_DOWNLOAD_PATH }, (t) => {
                        console.log(`[TorrentService] Torrent retomado: "${t.name}"`);
                        const video = selectBestVideoFile(t.files);
                        if (video) {
                            prioritizeVideoForStreaming(t, video);
                        }
                    });
                    attachPermanentTorrentHandlers(torrent, id);
                } catch (e) {
                    console.warn(`[TorrentService] Erro ao re-adicionar torrent para retomada:`, e.message);
                }
            }

            if (meta) {
                meta.status = 'downloading';
                meta.isPaused = false;
                meta.errorMessage = null;
                meta.error = null;
                persistDownloads();
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Download retomado', id }));
            return;
        }

        // Cancel / delete download (ultra-responsivo: remove do registro e responde em <1ms, limpando disco em background)
        if (pathname.startsWith('/api/downloads/') && req.method === 'DELETE') {
            if (rejectUntrustedMutation(req, res)) return;
            const rawId = decodeURIComponent(pathname.replace('/api/downloads/', '')).trim();
            const id = rawId.toLowerCase();
            let targetKey = id;
            let item = downloadsRegistry.get(id);
            if (!item) {
                for (const [k, v] of downloadsRegistry.entries()) {
                    if (
                        String(v?.imdbId || '').toLowerCase() === id ||
                        String(v?.id || '').toLowerCase() === id ||
                        String(v?.title || '').toLowerCase() === id
                    ) {
                        targetKey = k;
                        item = v;
                        break;
                    }
                }
            }
            const torrent = getActiveTorrent(targetKey);
            const deleteFiles = urlObj.searchParams.get('deleteFiles') !== 'false';

            // Verifica também se corresponde a um filme local escaneado em D:\Filmes (ex: quando chamado via imdbId tt...)
            let matchedLocalFile = null;
            if (deleteFiles) {
                try {
                    const localList = getCachedLocalMovies(SAVE_PATH) || [];
                    matchedLocalFile = localList.find(m =>
                        String(m.imdbId || '').toLowerCase() === id ||
                        String(m.id || '').toLowerCase() === id ||
                        String(m.title || '').toLowerCase() === id ||
                        String(m.cleanName || '').toLowerCase() === id
                    ) || null;
                } catch (_) {}
            }

            console.log(`[TorrentService] Removendo download: ${id} ("${item?.title || matchedLocalFile?.title || torrent?.name || 'desconhecido'}"), deleteFiles=${deleteFiles}`);

            downloadsRegistry.delete(targetKey);
            persistDownloads();

            if (deleteFiles) {
                if (item?.savePath) removeFileFromLocalCache(item.savePath);
                if (matchedLocalFile?.filePath) removeFileFromLocalCache(matchedLocalFile.filePath);
                invalidateLocalSetsCache();
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                message: deleteFiles ? 'Download e arquivos excluídos do computador com sucesso' : 'Registro removido da lista'
            }));

            setImmediate(() => {
                if (deleteFiles) {
                    if (item || torrent) {
                        cleanupCancelledDownload(item, torrent, SAVE_PATH);
                    }
                    if (matchedLocalFile?.filePath && fs.existsSync(matchedLocalFile.filePath)) {
                        try {
                            fs.unlinkSync(matchedLocalFile.filePath);
                            const parentDir = path.dirname(matchedLocalFile.filePath);
                            if (parentDir && path.resolve(parentDir).toLowerCase() !== path.resolve(SAVE_PATH).toLowerCase()) {
                                const rem = fs.readdirSync(parentDir);
                                if (rem.length === 0) fs.rmdirSync(parentDir);
                            }
                        } catch (_) {}
                    }
                    scanLocalMovies(SAVE_PATH);
                } else if (torrent) {
                    try {
                        torrent.destroy({ destroyStore: false });
                    } catch (_) {}
                }
            });
            return;
        }

        // Rename download title
        if (pathname === '/api/downloads/rename' && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const { id, newTitle } = data;
                    if (!id || !newTitle) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Parâmetros id e newTitle são obrigatórios' }));
                        return;
                    }

                    const item = downloadsRegistry.get(id.toLowerCase());
                    if (!item) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Download não encontrado' }));
                        return;
                    }

                    item.title = newTitle.trim();
                    persistDownloads();

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Título do download alterado com sucesso',
                        id,
                        title: item.title
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // Launch in qBittorrent directly
        if (pathname === '/api/qbittorrent/open' && req.method === 'POST') {
            if (rejectUntrustedMutation(req, res)) return;
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const magnet = typeof data.magnet === 'string' ? data.magnet.trim() : '';
                    if (!magnet || !/^magnet:\?xt=urn:btih:/i.test(magnet)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Valid magnet parameter is required' }));
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

        // -----------------------------------------------------------------
        // Servidor Web Estático Cine Lar TV (react-tv-app/dist) com Gzip e Cache
        // -----------------------------------------------------------------
        if (req.method === 'GET' || req.method === 'HEAD') {
            const DIST_DIR = path.resolve(__dirname, '..', 'react-tv-app', 'dist');
            if (fs.existsSync(DIST_DIR)) {
                let reqPath = pathname;
                if (reqPath === '/' || !reqPath) reqPath = '/index.html';

                const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
                let filePath = path.join(DIST_DIR, safePath);

                // Rota SPA: se arquivo não existe e não tem extensão, entrega index.html
                if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                    if (!path.extname(safePath)) {
                        filePath = path.join(DIST_DIR, 'index.html');
                    }
                }

                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const ext = path.extname(filePath).toLowerCase();
                    const mimeTypes = {
                        '.html': 'text/html; charset=utf-8',
                        '.js': 'application/javascript; charset=utf-8',
                        '.css': 'text/css; charset=utf-8',
                        '.json': 'application/json; charset=utf-8',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.webp': 'image/webp',
                        '.svg': 'image/svg+xml',
                        '.ico': 'image/x-icon',
                        '.woff': 'font/woff',
                        '.woff2': 'font/woff2',
                        '.wgt': 'application/vnd.tizen.wgt'
                    };
                    const contentType = mimeTypes[ext] || 'application/octet-stream';

                    const headers = {
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    };

                    if (pathname.startsWith('/assets/')) {
                        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
                    } else if (ext === '.html') {
                        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                    } else {
                        headers['Cache-Control'] = 'public, max-age=86400';
                    }

                    const acceptEncoding = req.headers['accept-encoding'] || '';
                    const canGzip = /\bgzip\b/.test(acceptEncoding) && ['.html', '.js', '.css', '.json', '.svg'].includes(ext);

                    if (canGzip) {
                        headers['Content-Encoding'] = 'gzip';
                        res.writeHead(200, headers);
                        if (req.method === 'HEAD') {
                            res.end();
                            return;
                        }
                        const rawStream = fs.createReadStream(filePath);
                        const gzip = zlib.createGzip({ level: 6 });
                        rawStream.pipe(gzip).pipe(res);
                        return;
                    } else {
                        const stat = fs.statSync(filePath);
                        headers['Content-Length'] = stat.size;
                        res.writeHead(200, headers);
                        if (req.method === 'HEAD') {
                            res.end();
                            return;
                        }
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }
            }
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

server.listen(PORT, HOST, () => {
    const localIp = getLocalIpAddress();
    console.log(`=======================================================`);
    console.log(`Cine Lar TV - Servidor e Plataforma de Streaming`);
    console.log(`Local:             http://localhost:${PORT}`);
    console.log(`Smart TV / Rede:   http://${localIp}:${PORT}`);
    console.log(`Pasta de Midia:    ${SAVE_PATH}`);
    console.log(`=======================================================`);

    // Start background catalog seeding
    seedCatalog(SAVE_PATH).catch(err => {
        console.warn('[TorrentService] Background seeding error:', err.message);
    });
});
