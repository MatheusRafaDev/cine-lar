import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { upsertMovie, getDb, translateGenres } from './db.js';
import { detectFranchise, detectSeries } from './organizer.js';
import { fetchPtBrMetadata, searchPtBrMovie } from './tmdbHelper.js';

// Localizar ffmpeg para suporte a reprodução e conversão de áudio instantânea
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

let localCache = null;
let lastScanTime = 0;

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
    name = name.replace(/\b(thepiratefilmes|bludv|wolverdonfilmes|totti9|andretpf|comandotorrents)\b/gi, '');
    name = name.replace(/\[ACESSE\.\.\.[^\]]+\]/gi, '');
    name = name.replace(/\((19\d\d|20\d\d)\)/g, '');
    name = name.replace(/\b(19\d\d|20\d\d)\b.*/, '');
    name = name.replace(/(\.|\_)/g, ' ');
    name = name.replace(/\[[^\]]+\]/g, ' ');
    name = name.replace(/\b(1080p|720p|2160p|4k|bluray|bdrip|web-dl|webrip|dual|dublado|nacional|ac3|aac|x264|x265|hevc|h264|imax|open matte|fullhd|ch|edition|proper|remux|dts-hd|ma|5\.1|7\.1)\b.*/i, '');
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

    // Se este diretório for de um download ativo ainda em andamento, não lista na pasta local
    if (downloadingPaths && downloadingPaths.length > 0) {
        if (downloadingPaths.some(dp => resolvedDir.startsWith(dp) || dp.startsWith(resolvedDir))) {
            return items;
        }
    }

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const videoFiles = entries.filter(e => e.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(e.name));
        const srtFiles = entries.filter(e => e.isFile() && /\.(srt|vtt)$/i.test(e.name));

        if (videoFiles.length > 0 && currentDepth > 0) {
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
                    items.push({
                        videoFile: fullVideo,
                        srtFile: srt ? path.join(dir, srt.name) : null,
                        folderName: path.basename(dir),
                        fileName: vf.name,
                        stat
                    });
                }
            }
        } else {
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                const resolvedFull = path.resolve(full).toLowerCase();
                if (downloadingPaths && downloadingPaths.some(dp => resolvedFull.startsWith(dp))) {
                    continue;
                }
                if (entry.isDirectory()) {
                    items = items.concat(collectLocalVideos(full, maxDepth, currentDepth + 1, downloadingPaths));
                } else if (entry.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(entry.name) && currentDepth === 0) {
                    let stat = null;
                    try {
                        stat = fs.statSync(full);
                    } catch {}
                    if (stat) {
                        items.push({
                            videoFile: full,
                            srtFile: null,
                            folderName: '',
                            fileName: entry.name,
                            stat
                        });
                    }
                }
            }
        }
    } catch (e) {}
    return items;
}

export async function getLocalLibrary(savePath = 'D:\\filmes', force = false, downloadingPaths = []) {
    const now = Date.now();
    if (!force && localCache && (now - lastScanTime < 60000)) {
        return localCache;
    }

    if (!fs.existsSync(savePath)) {
        return [];
    }

    const db = getDb();
    const results = [];
    const collected = collectLocalVideos(savePath, 4, 0, downloadingPaths);

    for (const item of collected) {
        const { videoFile, srtFile, stat, folderName, fileName } = item;
        const rawName = folderName || fileName;
        const { title: cleanName, year: detectedYear } = cleanMovieName(rawName);
        if (cleanName.length < 2) continue;

        let movieData = null;

        // Query Cinemeta with clean title
        try {
            const searchRes = await fetchJson(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(cleanName)}.json`);
            if (searchRes?.metas && searchRes.metas.length > 0) {
                // If year detected, find matching year meta, else fallback to top
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

        // Quality detection from filename/folder
        let quality = '1080p';
        if (/2160p|4k/i.test(rawName)) quality = '4K Ultra HD';
        else if (/720p/i.test(rawName)) quality = '720p HD';
        else if (/bluray|bdrip/i.test(rawName)) quality = '1080p BluRay';
        else if (/web-dl|webrip/i.test(rawName)) quality = '1080p WEB-DL';

        const ext = path.extname(videoFile).replace('.', '').toUpperCase();

        const fullRaw = `${cleanName} ${rawName} ${folderName}`;
        const franchise = detectFranchise(fullRaw);
        const seriesInfo = detectSeries(fullRaw);

        results.push({
            id: movieData?.imdb_id || `local_${encodeURIComponent(cleanName)}`,
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

    // Sort alphabetically by title
    results.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

    localCache = results;
    lastScanTime = now;
    return results;
}

export function streamLocalVideo(filePath, req, res) {
    let targetFile = filePath;
    if (!fs.existsSync(targetFile)) {
        // Tenta encontrar caso o arquivo tenha sido movido para MatheusFlix ou vice-versa
        const baseName = path.basename(targetFile);
        const dirName = path.basename(path.dirname(targetFile));
        const candidates = [
            path.join('D:\\filmes', 'MatheusFlix', dirName, baseName),
            path.join('D:\\filmes', dirName, baseName),
            path.join('D:\\filmes', 'MatheusFlix', baseName),
            path.join('D:\\filmes', baseName),
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

    // Trata requisições HEAD (verificação de mime/range pelo navegador)
    if (req.method === 'HEAD') {
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': total
        });
        res.end();
        return;
    }

    const urlObj = new URL(req.url, 'http://localhost:8085');
    const isTranscode = urlObj.searchParams.get('transcode') === '1';
    const isDirect = urlObj.searchParams.get('direct') === '1';
    const startTimeParam = parseFloat(urlObj.searchParams.get('startTime') || urlObj.searchParams.get('t') || 0);

    const isMkvOrNonMp4 = /\.(mkv|avi|ts|mov|wmv|vob|flv)$/i.test(targetFile);
    const needsFfmpegRemux = Boolean(RESOLVED_FFMPEG && !isDirect && (isMkvOrNonMp4 || isTranscode || startTimeParam > 0));

    if (needsFfmpegRemux) {
        // Remux ultrarrápido com FFmpeg para Fragmented MP4 (fMP4):
        // -c:v copy: 0% CPU, não reencoda o vídeo, inicia instantaneamente!
        // -c:a aac: converte o áudio (EAC3/AC3/DTS) para AAC estéreo compatível com qualquer navegador
        console.log(`[LocalStream] Remuxando vídeo com FFmpeg "${path.basename(targetFile)}" (start: ${startTimeParam}s)`);

        const args = [
            '-hide_banner',
            '-loglevel', 'error'
        ];

        if (startTimeParam > 0) {
            args.push('-ss', String(startTimeParam));
        }

        args.push(
            '-i', targetFile,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-sn',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1'
        );

        const ffmpegProc = spawn(RESOLVED_FFMPEG, args, { stdio: ['ignore', 'pipe', 'ignore'] });

        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'none',
            'Cache-Control': 'no-cache, no-store'
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

    // Direct HTTP Range streaming (para MP4 nativo)
    let contentType = 'video/mp4';
    if (targetFile.endsWith('.webm')) contentType = 'video/webm';
    else if (targetFile.endsWith('.mkv')) contentType = 'video/x-matroska';
    else if (targetFile.endsWith('.avi')) contentType = 'video/x-msvideo';

    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, {
            'Content-Length': total,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(targetFile).pipe(res);
    } else {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType
        });
        fs.createReadStream(targetFile, { start, end }).pipe(res);
    }
}

export function invalidateLocalCache() {
    localCache = null;
    lastScanTime = 0;
}

export function deleteLocalFile(targetPath) {
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

        // Se o diretório pai for uma pasta específica do filme dentro de D:\filmes e estiver vazia, remove a pasta
        const parentDir = path.dirname(targetPath);
        const allowedBase = path.resolve('D:\\filmes');
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

