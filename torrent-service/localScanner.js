import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { spawn, execFileSync } from 'child_process';
import { upsertMovie, getDb, translateGenres, getLocalMediaByPath, upsertLocalMedia, pruneDeletedLocalMedia, deleteLocalMediaRecord } from './db.js';
import { detectFranchise, detectSeries } from './organizer.js';
import { fetchPtBrMetadata, searchPtBrMovie } from './tmdbHelper.js';

// Localizar ffmpeg e ffprobe para suporte a reprodução e detecção precisa de metadados
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

const FFPROBE_CANDIDATES = [
    process.env.FFPROBE_PATH,
    'C:\\Program Files\\Jellyfin\\Server\\ffprobe.exe',
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'ffprobe'
].filter(Boolean);

let RESOLVED_FFPROBE = null;
for (const p of FFPROBE_CANDIDATES) {
    if (p === 'ffprobe') {
        RESOLVED_FFPROBE = 'ffprobe';
        break;
    }
    if (fs.existsSync(p)) {
        RESOLVED_FFPROBE = p;
        break;
    }
}

const mediaInfoCache = new Map();

export function getMediaInfo(filePath) {
    if (mediaInfoCache.has(filePath)) {
        return mediaInfoCache.get(filePath);
    }
    const defaultInfo = {
        duration: 0,
        videoCodec: '',
        audioCodec: '',
        width: 0,
        height: 0,
        quality: '1080p Full HD',
        isDirectPlayable: filePath.toLowerCase().endsWith('.mp4')
    };
    if (!RESOLVED_FFPROBE || !fs.existsSync(filePath)) return defaultInfo;

    try {
        const stdout = execFileSync(RESOLVED_FFPROBE, [
            '-v', 'error',
            '-show_entries', 'stream=index,codec_name,codec_type,width,height',
            '-show_entries', 'format=duration',
            '-of', 'json',
            filePath
        ], { timeout: 4000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

        const data = JSON.parse(stdout);
        const dur = parseFloat(data.format?.duration);
        const duration = (!isNaN(dur) && dur > 0) ? Math.round(dur) : 0;

        const vStream = (data.streams || []).find(s => s.codec_type === 'video');
        const aStream = (data.streams || []).find(s => s.codec_type === 'audio');

        const videoCodec = (vStream?.codec_name || '').toLowerCase();
        const audioCodec = (aStream?.codec_name || '').toLowerCase();
        const width = parseInt(vStream?.width, 10) || 0;
        const height = parseInt(vStream?.height, 10) || 0;

        let quality = '1080p Full HD';
        if (height >= 2160 || width >= 3840) quality = '4K UHD';
        else if (height >= 1080 || width >= 1920) quality = '1080p Full HD';
        else if (height >= 720 || width >= 1280) quality = '720p HD';
        else if (height > 0 && height < 720) quality = '480p SD';

        const isMp4 = filePath.toLowerCase().endsWith('.mp4');
        const isH264 = videoCodec === 'h264' || videoCodec === 'avc1';
        const isAac = audioCodec === 'aac' || audioCodec === 'mp4a';

        // Arquivo direto sem transcode apenas se for container MP4 com vídeo H264 e áudio AAC
        const isDirectPlayable = isMp4 && isH264 && isAac;

        const info = { duration, videoCodec, audioCodec, width, height, quality, isDirectPlayable };
        mediaInfoCache.set(filePath, info);
        return info;
    } catch {
        return defaultInfo;
    }
}

export function getVideoDuration(filePath) {
    return getMediaInfo(filePath).duration;
}

let localCache = null;
let lastScanTime = 0;
let inFlightScanPromise = null;

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 MatheusFlix/2.0' } }, (res) => {
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
        req.setTimeout(8000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

export function cleanMovieName(raw) {
    const yearMatch = raw.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    let name = raw.replace(/\.(mkv|mp4|avi|ts|mov)$/i, '');
    name = name.replace(/\(?www\.[^\)]+\)?/gi, '');
    name = name.replace(/\b(thepiratefilmes|bludv|wolverdonfilmes|totti9|andretpf|comandotorrents|cinecombo)\b/gi, '');
    name = name.replace(/\[ACESSE\.\.\.[^\]]+\]/gi, '');
    name = name.replace(/\((19\d\d|20\d\d)\)/g, '');
    name = name.replace(/\b(19\d\d|20\d\d)\b.*/, '');
    name = name.replace(/(\.|\_)/g, ' ');
    name = name.replace(/\[[^\]]+\]/g, ' ');
    name = name.replace(/\b(1080p|720p|2160p|4k|bluray|bdrip|dvdrip|web-dl|webrip|web|hdtv|dual|dualaudio|dublado|legendado|nacional|ac3|aac|x264|x265|hevc|h264|imax|open matte|fullhd|ch|edition|proper|remux|dts-hd|ma|5\.1|7\.1)\b.*/i, '');
    name = name.replace(/[\(\)\[\]\-]/g, ' ');
    name = name.replace(/\b(com|net|org|br)\b/gi, '');
    // Remove trailing "1" if like "Carros 1", "Toy Story 1"
    name = name.replace(/\b([A-Za-z]+)\s+1\b/i, '$1');
    name = name.replace(/\s+/g, ' ').trim();

    return { title: name, year };
}

export function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function collectLocalVideos(dir, maxDepth = 4, currentDepth = 0, downloadingPaths = []) {
    let items = [];
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return items;
    const resolvedDir = path.resolve(dir).toLowerCase();

    // Se este subdiretório específico for de um download ativo ainda em andamento, não lista na pasta local
    if (currentDepth > 0 && downloadingPaths && downloadingPaths.length > 0) {
        if (downloadingPaths.some(dp => dp && (resolvedDir === dp || resolvedDir.startsWith(dp + path.sep)))) {
            return items;
        }
    }

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const videoFiles = entries.filter(e => e.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(e.name));
        const srtFiles = entries.filter(e => e.isFile() && /\.(srt|vtt)$/i.test(e.name));

        // 1. Processa vídeos encontrados no diretório atual
        if (videoFiles.length > 0) {
            for (const vf of videoFiles) {
                const fullVideo = path.join(dir, vf.name);
                const resolvedVideo = path.resolve(fullVideo).toLowerCase();
                if (downloadingPaths && downloadingPaths.some(dp => resolvedVideo.startsWith(dp))) {
                    continue;
                }
                const base = vf.name.replace(/\.[^.]+$/, '');
                const srt = srtFiles.find(s => s.name.startsWith(base)) || srtFiles[0];
                let stat = null;
                try {
                    stat = fs.statSync(fullVideo);
                } catch {}
                if (stat) {
                    let folderName = path.basename(dir);
                    const parentDir = path.basename(path.dirname(dir));
                    const isGenericFolder = /^(filmes|matheusflix|cinelar|downloads|videos|movies|depois do filme|bonus|bônus|extras|curtas)$/i.test(folderName) ||
                        /\b(trilogia|colecao|coleção|collection|saga|pack)\b/i.test(folderName);
                    if (isGenericFolder || currentDepth === 0 || videoFiles.length > 1) {
                        folderName = vf.name.replace(/\.[^.]+$/, '');
                    } else if (/^(temporada|season|s\d+)/i.test(folderName) && parentDir && !/^(series|filmes|matheusflix|cinelar)$/i.test(parentDir)) {
                        folderName = `${parentDir} ${folderName}`;
                    }
                    items.push({
                        videoFile: fullVideo,
                        srtFile: srt ? path.join(dir, srt.name) : null,
                        folderName,
                        fileName: vf.name,
                        stat
                    });
                }
            }
        }

        // 2. Sempre pesquisa subdiretórios recursivamente até o limite de profundidade
        const subDirs = entries.filter(e => e.isDirectory());
        for (const sd of subDirs) {
            const fullSub = path.join(dir, sd.name);
            const resolvedSub = path.resolve(fullSub).toLowerCase();
            if (downloadingPaths && downloadingPaths.some(dp => resolvedSub.startsWith(dp))) {
                continue;
            }
            items = items.concat(collectLocalVideos(fullSub, maxDepth, currentDepth + 1, downloadingPaths));
        }
    } catch (e) {}
    return items;
}

export async function getLocalLibrary(savePath = 'D:\\filmes', force = false, downloadingPaths = []) {
    const now = Date.now();
    if (!force && localCache && (now - lastScanTime < 60000)) {
        return localCache;
    }

    if (!force && inFlightScanPromise) {
        return inFlightScanPromise;
    }

    inFlightScanPromise = (async () => {
        try {
            if (!fs.existsSync(savePath)) {
                localCache = [];
                lastScanTime = Date.now();
                return [];
            }

            const db = getDb();
            const results = [];
            const usedIds = new Set();
            const makeUniqueId = (baseId, fallbackPath) => {
                let candidate = baseId || `local_${encodeURIComponent(fallbackPath)}`;
                if (usedIds.has(candidate)) {
                    candidate = `${candidate}_${usedIds.size}`;
                }
                usedIds.add(candidate);
                return candidate;
            };
            const collected = collectLocalVideos(savePath, 4, 0, downloadingPaths);

            for (const item of collected) {
                const { videoFile, srtFile, stat, folderName, fileName } = item;
                const rawName = folderName || fileName;
                const { title: cleanName, year: detectedYear } = cleanMovieName(rawName);
                if (cleanName.length < 2) continue;

                // 0. VERIFICAÇÃO ULTRA-RÁPIDA EM SQLite: Se o arquivo já foi indexado e não mudou, carrega instantaneamente
                try {
                    const cached = getLocalMediaByPath(videoFile);
                    const isStaleGenericCache = cached && String(cached.clean_name || '').toLowerCase() !== String(cleanName || '').toLowerCase();
                    if (cached && !isStaleGenericCache && cached.file_size === stat.size && Math.abs(cached.mtime_ms - stat.mtimeMs) < 1000) {
                        const baseId = cached.imdb_id || `local_${encodeURIComponent(cached.clean_name || cached.title)}`;
                        results.push({
                            id: makeUniqueId(baseId, cached.file_path),
                            imdbId: cached.imdb_id || '',
                            title: cached.title,
                            originalTitle: cached.original_title || cached.title,
                            cleanName: cached.clean_name || cleanName,
                            rawName,
                            year: cached.year || detectedYear || '',
                            poster: cached.poster || '',
                            backdrop: cached.backdrop || cached.poster || '',
                            description: cached.description || 'Filme salvo na sua pasta local.',
                            genres: cached.genres || 'Cinema',
                            rating: cached.rating ? Number(cached.rating).toFixed(1) : '8.0',
                            quality: cached.quality || '1080p',
                            format: cached.format || 'MP4',
                            sizeBytes: cached.file_size,
                            sizeFormatted: formatBytes(cached.file_size),
                            duration: cached.duration || 0,
                            filePath: cached.file_path,
                            videoPath: cached.file_path,
                            srtPath: cached.srt_path || srtFile || null,
                            streamUrl: `/api/local/stream?file=${encodeURIComponent(cached.file_path)}`,
                            hasSubtitle: Boolean(cached.has_subtitle || srtFile),
                            isLocal: true,
                            folderName,
                            franchise: cached.franchise || null,
                            franchiseIcon: cached.franchise_icon || null,
                            isSeries: Boolean(cached.is_series),
                            seriesName: cached.series_name || null,
                            season: cached.season || null,
                            episode: cached.episode || null
                        });
                        continue;
                    }
                } catch (_) {}

                let movieData = null;

                // 1. OTIMIZACAO: Verificar se já temos metadados pelo nome limpo no banco
                try {
                    const row = db.prepare(`
                        SELECT * FROM movies 
                        WHERE title = ? COLLATE NOCASE OR original_title = ? COLLATE NOCASE
                        LIMIT 1
                    `).get(cleanName, cleanName);

                    if (row && row.imdb_id) {
                        movieData = {
                            imdb_id: row.imdb_id,
                            title: row.title || cleanName,
                            original_title: row.original_title || cleanName,
                            year: row.year || detectedYear,
                            genres: row.genres ? row.genres.split(', ') : [],
                            rating: row.rating || 8.0,
                            poster: row.poster || '',
                            backdrop: row.backdrop || row.poster || '',
                            description: row.description || 'Filme salvo na sua biblioteca local.'
                        };
                    }
                } catch (_) {}

                // 2. Se nao encontrou no banco local, busca na internet via Cinemeta
                if (!movieData) {
                    const seriesCheck = detectSeries(`${folderName} ${fileName}`);
                    const cinemetaType = seriesCheck.isSeries ? 'series' : 'movie';
                    const searchTitle = seriesCheck.isSeries ? (seriesCheck.seriesName || cleanName) : cleanName;

                    try {
                        let searchRes = await fetchJson(`https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(searchTitle)}.json`);
                        if ((!searchRes?.metas || searchRes.metas.length === 0) && cinemetaType === 'series') {
                            searchRes = await fetchJson(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(cleanName)}.json`);
                        }
                        if (searchRes?.metas && searchRes.metas.length > 0) {
                            let match = searchRes.metas[0];
                            if (detectedYear) {
                                const yearMatch = searchRes.metas.find(m => {
                                    const mYear = parseInt(m.releaseInfo || m.year, 10);
                                    return mYear === detectedYear || Math.abs(mYear - detectedYear) <= 1;
                                });
                                if (yearMatch) match = yearMatch;
                            }

                            let titleBr = '';
                            let descBr = '';
                            if (match.imdb_id) {
                                try {
                                    const existingRow = db.prepare('SELECT title, description FROM movies WHERE imdb_id = ?').get(match.imdb_id);
                                    if (existingRow && existingRow.title) {
                                        titleBr = existingRow.title;
                                        descBr = existingRow.description;
                                    }
                                } catch (e) {}
                            }
                            if (!titleBr && match.imdb_id) {
                                try {
                                    const tmdb = await fetchPtBrMetadata(match.imdb_id);
                                    if (tmdb?.titleBr) {
                                        titleBr = tmdb.titleBr;
                                        descBr = tmdb.overviewBr;
                                    }
                                } catch (e) {}
                            }

                            const finalTitle = titleBr || cleanName || match.name;
                            match.title = finalTitle;
                            match.original_title = match.name;
                            match.is_local = 1;
                            if (descBr) match.description = descBr;
                            upsertMovie(match);

                            movieData = {
                                imdb_id: match.imdb_id,
                                title: finalTitle,
                                original_title: match.name,
                                year: parseInt(match.releaseInfo || match.year, 10) || detectedYear,
                                genres: translateGenres(match.genres),
                                rating: parseFloat(match.imdbRating) || 8.0,
                                poster: match.poster || '',
                                backdrop: match.background || match.backdrop || '',
                                description: descBr || match.description || 'Filme salvo na sua biblioteca local.'
                            };
                        }
                    } catch (err) {}
                }

        // Fallback to SQLite DB if Cinemeta search failed or was rate-limited
        if (!movieData) {
            try {
                const row = db.prepare(`
                    SELECT * FROM movies 
                    WHERE (title LIKE ? OR original_title LIKE ?) 
                    LIMIT 1
                `).get(`%${cleanName}%`, `%${cleanName}%`);

                if (row) {
                    movieData = {
                        imdb_id: row.imdb_id,
                        title: row.title || cleanName,
                        original_title: row.original_title || row.title,
                        year: row.year || detectedYear,
                        genres: row.genres,
                        rating: row.rating,
                        poster: row.poster,
                        backdrop: row.backdrop,
                        description: row.description
                    };
                }
            } catch (e) {}
        }

        // Fallback 2: Busca direta no TMDB por nome em Português do Brasil
        if (!movieData) {
            try {
                const tmdbSearch = await searchPtBrMovie(cleanName, detectedYear);
                if (tmdbSearch) {
                    movieData = {
                        imdb_id: null,
                        title: tmdbSearch.titleBr,
                        original_title: tmdbSearch.originalTitle,
                        year: tmdbSearch.year || detectedYear,
                        genres: 'Cinema',
                        rating: tmdbSearch.rating || 8.0,
                        poster: tmdbSearch.poster,
                        backdrop: tmdbSearch.backdrop,
                        description: tmdbSearch.overviewBr || 'Filme salvo na sua pasta local.'
                    };
                }
            } catch (e) {}
        }

        // Detecção precisa de resolução a partir do mediaInfo / ffprobe
        const mediaInfo = getMediaInfo(videoFile);
        let quality = mediaInfo.quality || '1080p Full HD';
        if (!mediaInfo.width) {
            if (/2160p|4k/i.test(rawName)) quality = '4K UHD';
            else if (/720p/i.test(rawName)) quality = '720p HD';
            else if (/bluray|bdrip/i.test(rawName)) quality = '1080p BluRay';
            else if (/web-dl|webrip/i.test(rawName)) quality = '1080p Full HD';
        }

        const ext = path.extname(videoFile).replace('.', '').toUpperCase();

        const fullRaw = `${cleanName} ${rawName} ${folderName}`;
        const franchise = detectFranchise(fullRaw);
        const seriesInfo = detectSeries(fullRaw);

        const vidDuration = Math.round(getVideoDuration(videoFile));

        try {
            upsertLocalMedia({
                    filePath: videoFile,
                    fileName,
                    fileSize: stat.size,
                    mtimeMs: stat.mtimeMs,
                    cleanName,
                    imdbId: movieData?.imdb_id || '',
                    title: movieData?.title || cleanName,
                    originalTitle: movieData?.original_title || cleanName,
                    year: movieData?.year || detectedYear || null,
                    poster: movieData?.poster || '',
                    backdrop: movieData?.backdrop || '',
                    description: movieData?.description || 'Filme salvo na sua pasta local.',
                    genres: Array.isArray(movieData?.genres) ? movieData.genres.join(', ') : (movieData?.genres || 'Cinema'),
                    rating: movieData?.rating || 8.0,
                    quality,
                    format: ext,
                    duration: vidDuration,
                    hasSubtitle: Boolean(srtFile),
                    srtPath: srtFile || '',
                    franchise: franchise ? franchise.name : null,
                    franchiseIcon: franchise ? franchise.icon : null,
                    isSeries: seriesInfo.isSeries,
                    seriesName: seriesInfo.isSeries ? seriesInfo.seriesName : null,
                    season: seriesInfo.isSeries ? seriesInfo.season : null,
                    episode: seriesInfo.isSeries ? seriesInfo.episode : null
                });
            } catch (_) {}

            const baseId = movieData?.imdb_id || `local_${encodeURIComponent(cleanName)}`;
            results.push({
                id: makeUniqueId(baseId, videoFile),
                imdbId: movieData?.imdb_id || '',
                title: movieData?.title || cleanName,
                originalTitle: movieData?.original_title || cleanName,
                cleanName,
                rawName,
                year: movieData?.year || detectedYear || '',
                poster: movieData?.poster || '',
                backdrop: movieData?.backdrop || '',
                description: movieData?.description || 'Filme salvo na sua pasta local.',
                genres: movieData?.genres || 'Cinema',
                rating: movieData?.rating ? Number(movieData.rating).toFixed(1) : '8.0',
                quality,
                format: ext,
                sizeBytes: stat.size,
                sizeFormatted: formatBytes(stat.size),
                duration: vidDuration,
                filePath: videoFile,
                videoPath: videoFile,
                srtPath: srtFile,
                streamUrl: `/api/local/stream?file=${encodeURIComponent(videoFile)}`,
                hasSubtitle: !!srtFile,
                isLocal: true,
                folderName,
                franchise: franchise ? franchise.name : null,
                franchiseIcon: franchise ? franchise.icon : null,
                isSeries: seriesInfo.isSeries,
                seriesName: seriesInfo.isSeries ? seriesInfo.seriesName : null,
                season: seriesInfo.isSeries ? seriesInfo.season : null,
                episode: seriesInfo.isSeries ? seriesInfo.episode : null
            });
        }

        try {
            pruneDeletedLocalMedia(collected.map(c => c.videoFile));
        } catch (_) {}

            // Sort alphabetically by title
            results.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

            localCache = results;
            lastScanTime = Date.now();
            return results;
        } finally {
            inFlightScanPromise = null;
        }
    })();

    return inFlightScanPromise;
}

export function streamLocalVideo(filePath, req, res) {
    let targetFile = filePath;
    if (!fs.existsSync(targetFile)) {
        // Tenta encontrar caso o arquivo esteja em Cinelar, MatheusFlix ou direto no disco
        const baseName = path.basename(targetFile);
        const dirName = path.basename(path.dirname(targetFile));
        const candidates = [
            path.join('D:\\filmes', 'Cinelar', dirName, baseName),
            path.join('D:\\filmes', 'Cinelar', baseName),
            path.join('D:\\filmes', 'MatheusFlix', dirName, baseName),
            path.join('D:\\filmes', dirName, baseName),
            path.join('D:\\filmes', 'MatheusFlix', baseName),
            path.join('D:\\filmes', baseName),
            path.join('D:\\Cinelar', dirName, baseName),
            path.join('D:\\Cinelar', baseName),
            path.join('D:\\MatheusFlix', dirName, baseName),
            path.join('D:\\MatheusFlix', baseName)
        ];
        const found = candidates.find(c => fs.existsSync(c));
        if (found) {
            targetFile = found;
        } else {
            console.warn(`[LocalStream] Arquivo não encontrado: "${filePath}"`);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Local file not found' }));
            return;
        }
    }

    const stat = fs.statSync(targetFile);
    const total = stat.size;
    const mediaInfo = getMediaInfo(targetFile);
    const duration = mediaInfo.duration;

    // Trata requisições HEAD (verificação de mime/range pelo navegador)
    if (req.method === 'HEAD') {
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': total,
            'X-Media-Duration': String(duration),
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
        });
        res.end();
        return;
    }

    const urlObj = new URL(req.url, 'http://localhost:8085');
    const isTranscode = urlObj.searchParams.get('transcode') === '1';
    const startTimeParam = parseFloat(urlObj.searchParams.get('startTime') || urlObj.searchParams.get('t') || 0);

    const isMkvOrNonMp4 = /\.(mkv|avi|ts|mov|wmv|vob|flv)$/i.test(targetFile);
    // Tizen/Chromium HTML5 <video> exige container MP4 (enableMkvProgressive = false):
    // sempre remuxa MKV/AVI/TS ou audio AC3/EAC3 em tempo real com -c:v copy (zero perda de qualidade e <1% CPU)
    const needsFfmpegRemux = Boolean(RESOLVED_FFMPEG && (isMkvOrNonMp4 || isTranscode || !mediaInfo.isDirectPlayable || startTimeParam > 0));

    if (needsFfmpegRemux) {
        console.log(`[LocalStream] Remuxando vídeo com FFmpeg "${path.basename(targetFile)}" (start: ${startTimeParam}s, video: ${mediaInfo.videoCodec || 'h264'}, audio: ${mediaInfo.audioCodec || 'aac'})`);

        const args = [
            '-hide_banner',
            '-loglevel', 'error'
        ];

        if (startTimeParam > 0) {
            args.push('-ss', String(startTimeParam));
        }

        const isH264 = mediaInfo.videoCodec === 'h264' || mediaInfo.videoCodec === 'avc1';
        const isHevc = mediaInfo.videoCodec === 'hevc' || mediaInfo.videoCodec === 'h265';
        const isAac = mediaInfo.audioCodec === 'aac' || mediaInfo.audioCodec === 'mp4a';

        // Cópia direta do vídeo preservando 100% da qualidade original se for H.264 ou HEVC
        const canCopyVideo = isH264 || isHevc;
        const vArgs = canCopyVideo
            ? ['-c:v', 'copy', ...(isHevc ? ['-tag:v', 'hvc1'] : [])]
            : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-maxrate', '12M', '-bufsize', '24M'];

        const aArgs = isAac
            ? ['-c:a', 'copy']
            : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2'];

        args.push(
            '-i', targetFile,
            ...vArgs,
            ...aArgs,
            '-sn',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1'
        );

        const ffmpegProc = spawn(RESOLVED_FFMPEG, args, { stdio: ['ignore', 'pipe', 'ignore'] });

        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'none',
            'Cache-Control': 'no-cache, no-store',
            'X-Media-Duration': String(duration),
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
        });

        ffmpegProc.stdout.pipe(res);

        req.on('close', () => {
            try {
                ffmpegProc.kill('SIGKILL');
            } catch (e) {
                // Ignore kill errors
            }
        });

        ffmpegProc.on('error', (err) => {
            console.error('[LocalStream] FFmpeg remux error:', err.message);
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
        return;
    }

    // Direct HTTP Range streaming (para MP4 nativo e MKV na TV)
    let contentType = 'video/mp4';
    if (targetFile.endsWith('.webm')) contentType = 'video/webm';
    else if (targetFile.endsWith('.mkv')) contentType = 'video/mp4';
    else if (targetFile.endsWith('.avi')) contentType = 'video/x-msvideo';

    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, {
            'Content-Length': total,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'X-Media-Duration': String(duration),
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
        });
        const stream = fs.createReadStream(targetFile);
        stream.pipe(res);
        req.on('close', () => {
            if (stream && typeof stream.destroy === 'function') stream.destroy();
        });
        stream.on('error', (err) => {
            console.error('[LocalStream] Direct stream error:', err.message);
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
    } else {
        const matches = range.match(/bytes=(\d*)-(\d*)/);
        if (!matches) {
            res.writeHead(416, {
                'Content-Range': `bytes */${total}`,
                'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
            });
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

        if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
            res.writeHead(416, {
                'Content-Range': `bytes */${total}`,
                'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
            });
            res.end();
            return;
        }

        const chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'X-Media-Duration': String(duration),
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, X-Media-Duration'
        });
        const stream = fs.createReadStream(targetFile, { start, end });
        stream.pipe(res);
        req.on('close', () => {
            if (stream && typeof stream.destroy === 'function') stream.destroy();
        });
        stream.on('error', (err) => {
            console.error('[LocalStream] Range stream error:', err.message);
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
    }
}

export function invalidateLocalCache() {
    localCache = null;
    lastScanTime = 0;
}

export function removeFileFromLocalCache(targetPath) {
    if (!targetPath || !Array.isArray(localCache)) return;
    try {
        const norm = path.resolve(targetPath).toLowerCase();
        localCache = localCache.filter(m => {
            const vp = m.videoPath || m.filePath || '';
            if (!vp) return true;
            const resolvedVp = path.resolve(vp).toLowerCase();
            return resolvedVp !== norm && !resolvedVp.startsWith(norm + path.sep);
        });
    } catch (_) {}
}

export function deleteLocalFile(targetPath, baseDir = 'D:\\filmes') {
    removeFileFromLocalCache(targetPath);
    deleteLocalMediaRecord(targetPath);
    if (!fs.existsSync(targetPath)) return false;

    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
        fs.unlinkSync(targetPath);

        // Deletar legendas e arquivos associados correspondentes
        const baseName = targetPath.replace(/\.[^.]+$/, '');
        for (const ext of ['.srt', '.vtt', '.nfo', '.jpg', '.png']) {
            const extra = baseName + ext;
            if (fs.existsSync(extra)) {
                try { fs.unlinkSync(extra); } catch {}
            }
        }

        // Se o diretório pai for uma pasta específica do filme dentro da pasta base e estiver vazia, remove a pasta
        const parentDir = path.dirname(targetPath);
        const allowedBase = path.resolve(baseDir);
        if (path.resolve(parentDir) !== allowedBase && path.resolve(parentDir).startsWith(allowedBase)) {
            try {
                const remaining = fs.readdirSync(parentDir);
                if (remaining.length === 0 || remaining.every(f => /\.(srt|vtt|nfo|jpg|png|txt)$/i.test(f))) {
                    fs.rmSync(parentDir, { recursive: true, force: true });
                }
            } catch {}
        }
        return true;
    } else if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        return true;
    }
    return false;
}

export function renameLocalFile(targetPath, newName, baseDir = 'D:\\filmes') {
    if (!fs.existsSync(targetPath)) {
        throw new Error('Arquivo não encontrado no disco');
    }
    const cleanName = newName.replace(/[<>:"/\\|?*]/g, '').trim();
    if (!cleanName) {
        throw new Error('Novo nome inválido');
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isFile()) {
        throw new Error('O caminho fornecido não é um arquivo');
    }

    const ext = path.extname(targetPath);
    const parentDir = path.dirname(targetPath);
    const newFileName = cleanName.toLowerCase().endsWith(ext.toLowerCase()) ? cleanName : `${cleanName}${ext}`;
    const newFilePath = path.join(parentDir, newFileName);

    if (fs.existsSync(newFilePath) && newFilePath.toLowerCase() !== targetPath.toLowerCase()) {
        throw new Error('Já existe um arquivo com esse nome nesta pasta');
    }

    fs.renameSync(targetPath, newFilePath);

    // Renomear também legendas associadas (.srt, .vtt) se existirem
    const oldBase = targetPath.slice(0, -ext.length);
    const newBase = newFilePath.slice(0, -ext.length);
    for (const subExt of ['.srt', '.vtt', '.nfo']) {
        const oldSub = oldBase + subExt;
        const newSub = newBase + subExt;
        if (fs.existsSync(oldSub)) {
            try { fs.renameSync(oldSub, newSub); } catch {}
        }
    }

    return newFilePath;
}

