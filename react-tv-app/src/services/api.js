// Cinelar API Client - Conecta diretamente ao torrent-service local
const DEFAULT_HOST = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SERVER_HOST) || '192.168.15.9';
const DEFAULT_PORT = Number((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SERVER_PORT) || 8085);
const DEFAULT_API_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_TOKEN) || '';
const catalogCache = new Map();
const catalogInFlight = new Map();

function getCatalogCache(key, loader, ttlMs = 5 * 60 * 1000) {
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.time < ttlMs) {
    return Promise.resolve(cached.value);
  }
  if (catalogInFlight.has(key)) return catalogInFlight.get(key);

  const requestPromise = Promise.resolve().then(loader).then(value => {
    catalogCache.set(key, { time: Date.now(), value });
    catalogInFlight.delete(key);
    return value;
  }).catch(error => {
    catalogInFlight.delete(key);
    throw error;
  });
  catalogInFlight.set(key, requestPromise);
  return requestPromise;
}

function getStoredServerIp() {
  try {
    return localStorage.getItem('mf_server_ip') || '';
  } catch (_) {
    return '';
  }
}

function getApiToken() {
  try {
    return localStorage.getItem('mf_api_token') || DEFAULT_API_TOKEN || '';
  } catch (_) {
    return DEFAULT_API_TOKEN || '';
  }
}

export function getServerUrl() {
  const customAddress = getStoredServerIp().trim();
  if (customAddress) {
    const address = /^https?:\/\//i.test(customAddress)
      ? customAddress
      : `http://${customAddress}`;

    try {
      const url = new URL(address);
      if (!url.port) url.port = String(DEFAULT_PORT);
      return url.toString().replace(/\/$/, '');
    } catch (_) {
      // Mantém a tentativa de conexão para que a interface possa informar o erro ao usuário.
      return address.replace(/\/$/, '');
    }
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:${DEFAULT_PORT}`;
    }
    if (host && !host.startsWith('file')) {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }
  return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
}

export async function getServerStatus() {
  try {
    await request('/api/status');
    return true;
  } catch (_) {
    return false;
  }
}

export const API_BASE = `${getServerUrl()}/api`;

async function request(endpoint, options = {}) {
  const url = `${getServerUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getApiToken();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller?.signal,
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'X-Api-Token': token } : {}),
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Tempo limite da conexão excedido' : err.message;
    console.warn(`[API] Erro ao requisitar ${url}:`, message);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Normalizador consistente para qualquer item de filme ou série no app
export function normalizeMovie(item) {
  if (!item) return null;
  const id = item.imdb_id || item.imdbId || item.id || item.filePath || '';
  const isSeries = Boolean(item.isSeries || item.type === 'series' || (item.year && String(item.year).includes('–')));
  const resolvedFilePath = item.filePath || item.videoPath || item.localFile?.videoPath || '';
  const isLocal = Boolean(resolvedFilePath);
  const position = Number(item.position || item.position_seconds || 0);
  const duration = Number(item.duration || item.duration_seconds || 0);
  const progress = item.progress !== undefined && item.progress !== null
    ? Number(item.progress)
    : (duration > 0 && position > 0 ? Math.min(100, Math.round((position / duration) * 100)) : null);

  const isCloud = Boolean(item.isCloud || item.source === 'Google Drive' || (item.streamUrl && (item.streamUrl.includes('drive.google.com') || item.streamUrl.includes('drive.usercontent.google.com'))));

  return {
    ...item,
    id,
    movieId: item.movieId || item.id || id,
    imdbId: item.imdb_id || item.imdbId || id,
    title: item.title || item.name || item.cleanName || 'Sem título',
    poster: item.poster || item.thumbnail || '',
    backdrop: item.backdrop || item.poster || item.thumbnail || '',
    year: item.year ? String(item.year) : '',
    rating: item.rating || item.imdbRating || null,
    imdbRating: item.rating || item.imdbRating || null,
    synopsis: item.description || item.synopsis || '',
    isLocal: isCloud ? false : isLocal,
    isCloud,
    filePath: resolvedFilePath,
    videoPath: resolvedFilePath,
    streamUrl: item.streamUrl || (resolvedFilePath ? `/api/local/stream?file=${encodeURIComponent(resolvedFilePath)}` : ''),
    infoHash: item.infoHash || null,
    quality: item.quality || (isCloud ? '1080p Nuvem' : ''),
    isSeries,
    type: isSeries ? 'series' : (item.type || 'movie'),
    season: item.season || null,
    episode: item.episode || null,
    episodeName: item.episodeName || '',
    position,
    duration,
    progress
  };
}

// 1. Obter catálogo de filmes por gênero ou geral
export async function getMovies({ genre = '', limit = 30, offset = 0 } = {}) {
  try {
    const key = `movies:${genre}:${limit}:${offset}`;
    return await getCatalogCache(key, async () => {
      let q = `?limit=${limit}&offset=${offset}`;
      if (genre && genre !== 'all') {
        q += `&genre=${encodeURIComponent(genre)}`;
      }
      const data = await request(`/api/movies${q}`);
      return (data.movies || []).map(normalizeMovie);
    });
  } catch (_) {
    return [];
  }
}

// 1.1 Obter catálogo de séries por gênero ou geral
export async function getSeries({ genre = '', limit = 30, offset = 0 } = {}) {
  try {
    const key = `series:${genre}:${limit}:${offset}`;
    return await getCatalogCache(key, async () => {
      let q = `?type=series&limit=${limit}&offset=${offset}`;
      if (genre && genre !== 'all') {
        q += `&genre=${encodeURIComponent(genre)}`;
      }
      const data = await request(`/api/movies${q}`);
      return (data.movies || []).map(item => normalizeMovie({ ...item, isSeries: true, type: 'series' }));
    });
  } catch (_) {
    return [];
  }
}

// 1.2 Obter metadados completos de uma série (temporadas e episódios)
export async function getSeriesMeta(imdbId) {
  if (!imdbId) return null;
  try {
    const data = await request(`/api/series/meta?imdbId=${encodeURIComponent(imdbId)}`);
    return data.meta || data || null;
  } catch (err) {
    console.warn('[API] Erro ao carregar meta da série:', err.message);
    return null;
  }
}

// 1.3 Obter streams de um episódio específico de uma série
export async function getEpisodeStreams({ imdbId, season = 1, episode = 1, title = '' }) {
  if (!imdbId) return [];
  try {
    const data = await request(`/api/torrents?imdbId=${encodeURIComponent(imdbId)}&type=series&season=${season}&episode=${episode}&title=${encodeURIComponent(title)}`);
    return (data.torrents || []).map(t => ({
      ...t,
      streamUrl: `/api/stream/${t.infoHash}?magnet=${encodeURIComponent(t.magnetUri || '')}`,
      magnet: t.magnetUri
    }));
  } catch (err) {
    console.warn('[API] Erro ao carregar torrents do episódio:', err.message);
    return [];
  }
}

// 2. Obter filmes em alta (Trending)
export async function getTrendingMovies() {
  try {
    return await getCatalogCache('trending:50', async () => {
      const data = await request('/api/movies/trending');
      return (data.movies || []).map(normalizeMovie);
    });
  } catch (_) {
    return [];
  }
}

// 3. Obter gêneros disponíveis
export async function getGenres() {
  try {
    return await getCatalogCache('genres', async () => {
      const data = await request('/api/genres');
      return data.genres || [];
    });
  } catch (_) {
    return [];
  }
}

// 4. Obter filmes locais da pasta D:\Filmes
export async function getLocalMovies() {
  try {
    const data = await request('/api/local-movies');
    const list = data.movies || [];
    return list.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

// Utilitários para formatação e limpeza de nomes de arquivos
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function cleanMovieFileName(raw) {
  if (!raw) return 'Sem título';
  let name = String(raw).replace(/\.(mp4|mkv|avi|webm|ts|mov)$/i, '');
  name = name.replace(/\(?www\.[^\)\s]+\)?/gi, ' ');
  name = name.replace(/\b[a-z0-9\-]+\.(com|net|org|tv|me)(\.br)?\b/gi, ' ');
  name = name.replace(/\[ACESSE\.\.\.[^\]]+\]/gi, '');
  name = name.replace(/\((19\d\d|20\d\d)\)/g, '');
  name = name.replace(/([a-zA-ZÀ-ÿ])(19\d\d|20\d\d)\b.*/, '$1');
  name = name.replace(/\b(19\d\d|20\d\d)\b.*/, '');
  name = name.replace(/(\.|\_)/g, ' ');
  name = name.replace(/\[[^\]]+\]/g, ' ');
  name = name.replace(/\b(1080p|720p|2160p|4k|bluray|bdrip|brrip|dvdrip|web-dl|webrip|web|hdtv|dual|dualaudio|dublado|legendado|nacional|ac3|eac3|aac|x264|x265|hevc|h264|imax|open matte|fullhd)\b.*/i, '');
  name = name.replace(/[\(\)\[\]\-]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name || raw;
}

export function extractYearFromName(raw) {
  if (!raw) return '';
  const match = String(raw).match(/(?:^|[^0-9])(19\d\d|20\d\d)\b/);
  return match ? match[1] : '';
}

// 4.1 Obter biblioteca local completa com franquias e filmes avulsos estruturados (com persistência offline no localStorage)
export async function getLocalLibraryData() {
  try {
    const data = await request('/api/local-movies');
    const movies = (data.movies || []).map(normalizeMovie);
    const franchises = (data.franchises || []).map(f => ({
      ...f,
      movies: (f.movies || []).map(normalizeMovie)
    }));
    const standaloneMovies = (data.standaloneMovies || []).map(normalizeMovie);
    const series = (data.series || []).map(s => ({
      ...s,
      episodes: (s.episodes || []).map(normalizeMovie)
    }));

    const result = {
      movies,
      franchises,
      standaloneMovies,
      series,
      count: data.count || movies.length,
      totalSize: data.totalSize || '',
      savePath: data.savePath || 'D:\\Filmes'
    };

    try {
      localStorage.setItem('mf_cached_local_library', JSON.stringify(result));
    } catch (_) {}

    return result;
  } catch (_) {
    // Modo Offline: Quando o PC estiver desligado, utiliza o último catálogo em cache para nunca deixar a TV vazia
    try {
      const cached = localStorage.getItem('mf_cached_local_library');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.movies) && parsed.movies.length > 0) {
          return {
            ...parsed,
            isOfflineCached: true
          };
        }
      }
    } catch (_) {}

    return {
      movies: [],
      franchises: [],
      standaloneMovies: [],
      series: [],
      count: 0,
      totalSize: '',
      savePath: 'D:\\Filmes'
    };
  }
}

// 4.2 Integração com Google Drive (Nuvem Cinelar)
export function getDriveConfig() {
  try {
    return {
      folderId: localStorage.getItem('mf_gdrive_folder_id') || '',
      apiKey: localStorage.getItem('mf_gdrive_api_key') || ''
    };
  } catch (_) {
    return { folderId: '', apiKey: '' };
  }
}

export function setDriveConfig({ folderId = '', apiKey = '' } = {}) {
  try {
    if (folderId !== undefined) {
      // Extrai o ID caso o usuário cole a URL inteira de compartilhamento do Drive
      let cleanId = folderId.trim();
      const match = cleanId.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (match) cleanId = match[1];
      localStorage.setItem('mf_gdrive_folder_id', cleanId);
    }
    if (apiKey !== undefined) {
      localStorage.setItem('mf_gdrive_api_key', apiKey.trim());
    }
  } catch (_) {}
}

export async function getDriveMovies() {
  const config = getDriveConfig();
  const folderId = config.folderId;
  const apiKey = config.apiKey;

  // 1. Se houver folderId configurado e apiKey, consulta diretamente a Google Drive API v3
  if (folderId && apiKey) {
    try {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,mimeType,webContentLink,thumbnailLink)&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const files = (data.files || []).filter(f => /\.(mp4|mkv|avi|webm|ts)$/i.test(f.name) || (f.mimeType && f.mimeType.startsWith('video/')));
        if (files.length > 0) {
          const cloudMovies = files.map(f => {
            const streamUrl = `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`;
            return normalizeMovie({
              id: `gdrive_${f.id}`,
              movieId: `gdrive_${f.id}`,
              title: cleanMovieFileName(f.name),
              year: extractYearFromName(f.name),
              poster: f.thumbnailLink || '',
              backdrop: '',
              sizeFormatted: formatBytes(Number(f.size || 0)),
              sizeBytes: Number(f.size || 0),
              format: (f.name.split('.').pop() || 'MP4').toUpperCase(),
              streamUrl,
              filePath: f.name,
              videoPath: streamUrl,
              isCloud: true,
              isLocal: false,
              source: 'Google Drive',
              synopsis: `Arquivo sincronizado no Google Drive (Cinelar). Tamanho: ${formatBytes(Number(f.size || 0))}`
            });
          });

          try {
            localStorage.setItem('mf_cached_gdrive_movies', JSON.stringify(cloudMovies));
          } catch (_) {}
          return cloudMovies;
        }
      }
    } catch (e) {
      console.warn('[GoogleDrive] Falha ao consultar Google Drive API:', e.message);
    }
  }

  // 2. Se o servidor local estiver online, busca a lista dos arquivos da pasta Cinelar (D:\filmes\Cinelar)
  try {
    const data = await request(`/api/gdrive/files${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`);
    if (data && Array.isArray(data.movies) && data.movies.length > 0) {
      const cloudMovies = data.movies.map(normalizeMovie);
      try {
        localStorage.setItem('mf_cached_gdrive_movies', JSON.stringify(cloudMovies));
      } catch (_) {}
      return cloudMovies;
    }
  } catch (_) {}

  // 3. Fallback inteligente: Se o servidor local estiver offline e houver filmes salvos na pasta Cinelar no cache local
  try {
    const localCached = localStorage.getItem('mf_cached_local_library');
    if (localCached) {
      const parsed = JSON.parse(localCached);
      if (parsed && Array.isArray(parsed.movies)) {
        const cinelarMovies = parsed.movies.filter(m => {
          const p = String(m.filePath || m.videoPath || '').toLowerCase();
          return p.includes('cinelar') || m.isCloud;
        });
        if (cinelarMovies.length > 0) {
          return cinelarMovies.map(m => normalizeMovie({
            ...m,
            isCloud: true,
            quality: 'Nuvem Cinelar'
          }));
        }
      }
    }
  } catch (_) {}

  // 4. Fallback para cache de nuvem gravado anteriormente
  try {
    const cached = localStorage.getItem('mf_cached_gdrive_movies');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeMovie);
      }
    }
  } catch (_) {}

  return [];
}

// 5. Obter torrents e detalhes do filme para reprodução
export async function getMovieDetails(movie) {
  if (!movie) return null;
  const normalized = normalizeMovie(movie);
  const imdbId = normalized.imdbId || normalized.id;
  const title = normalized.title;

  if (normalized.isLocal && normalized.filePath && !String(imdbId).startsWith('tt')) {
    return normalized;
  }

  try {
    const data = await request(`/api/torrents?imdbId=${encodeURIComponent(imdbId)}&title=${encodeURIComponent(title)}`);
    const streams = (data.torrents || []).map(t => ({
      ...t,
      streamUrl: `/api/stream/${t.infoHash}?magnet=${encodeURIComponent(t.magnetUri || '')}&title=${encodeURIComponent(title)}`,
      magnet: t.magnetUri
    }));

    const localFile = data.localFile || null;
    const localVideoPath = localFile?.videoPath || normalized.filePath || '';
    const localStreamUrl = localFile?.streamUrl || (localVideoPath ? `/api/local/stream?file=${encodeURIComponent(localVideoPath)}` : normalized.streamUrl);

    return {
      ...normalized,
      isLocal: Boolean(localVideoPath),
      localFile,
      filePath: localVideoPath,
      videoPath: localVideoPath,
      streamUrl: localStreamUrl,
      duration: localFile?.duration || normalized.duration || 0,
      streams
    };
  } catch (err) {
    console.warn('[API] Falha ao carregar torrents do filme:', err.message);
    return {
      ...normalized,
      streams: []
    };
  }
}

// 6. Buscar filmes por termo
export async function searchMovies(query) {
  if (!query || !query.trim()) return [];
  try {
    const data = await request(`/api/movies/search?q=${encodeURIComponent(query.trim())}`);
    const list = data.movies || data.results || [];
    return list.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

// 6.1 Descobrir capa automaticamente para títulos sem poster ou cujo poster falhou ao carregar
const posterResolveCache = new Map();
export async function resolveMoviePoster(movie) {
  if (!movie) return '';
  const title = (movie.cleanName || movie.title || movie.name || '').trim();
  const imdbId = (movie.imdbId || (String(movie.id || '').startsWith('tt') ? movie.id : '') || '').trim();
  const year = movie.year || '';
  if (!title && !imdbId) return '';

  const cacheKey = `${imdbId.toLowerCase()}|${title.toLowerCase()}|${year}`;
  if (posterResolveCache.has(cacheKey)) {
    return posterResolveCache.get(cacheKey);
  }

  const promise = request(
    `/api/movies/poster?imdbId=${encodeURIComponent(imdbId)}&title=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}`
  )
    .then(data => (data && data.poster ? data.poster : ''))
    .catch(() => '');

  posterResolveCache.set(cacheKey, promise);
  return promise;
}

// 7. Lista de downloads e telemetria de disco
export async function getDownloads() {
  try {
    const data = await request('/api/downloads');
    return data.downloads || [];
  } catch (_) {
    return [];
  }
}

export async function getDownloadsData() {
  try {
    const data = await request('/api/downloads');
    return {
      downloads: data.downloads || [],
      storage: data.storage || null,
      stats: data.stats || null
    };
  } catch (_) {
    return { downloads: [], storage: null, stats: null };
  }
}

export async function pauseDownload(id) {
  try {
    return await request(`/api/downloads/${encodeURIComponent(id)}/pause`, { method: 'POST' });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function resumeDownload(id) {
  try {
    return await request(`/api/downloads/${encodeURIComponent(id)}/resume`, { method: 'POST' });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 8. Iniciar download explícito
export async function startDownload(params) {
  try {
    return await request('/api/downloads/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 8.1 Buscar torrents de temporada completa (Season Packs)
export async function getSeasonTorrents({ imdbId, season = 1, title = '' } = {}) {
  if (!imdbId) return [];
  try {
    const data = await request(`/api/series/season-torrents?imdb=${encodeURIComponent(imdbId)}&season=${season}&title=${encodeURIComponent(title)}`);
    return data.seasonPacks || data.allStreams || [];
  } catch (err) {
    console.error('[API] Erro ao obter season packs:', err);
    return [];
  }
}

// 8.2 Iniciar download de temporada completa em pasta organizada
export async function downloadSeason(params) {
  try {
    return await request('/api/series/download-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 8.3 Iniciar download de todas as temporadas da série
export async function downloadAllSeries(params) {
  try {
    return await request('/api/series/download-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 9. Cancelar / Deletar download
export async function deleteDownload(infoHash, deleteFiles = false) {
  try {
    return await request(`/api/downloads/${encodeURIComponent(infoHash)}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE'
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 10. Status em tempo real do streaming (peers, velocidade, buffer)
export async function getStreamStatus(infoHash) {
  try {
    return await request(`/api/stream/${encodeURIComponent(infoHash)}/status`);
  } catch (_) {
    return null;
  }
}

// 11. Interromper streaming sob demanda
export async function stopStream(infoHash) {
  try {
    return await request(`/api/stream/${encodeURIComponent(infoHash)}/stop`, { method: 'POST' });
  } catch (_) {
    return { success: false };
  }
}

// Formata segundos em MM:SS ou Hh MMm para exibição limpa na TV
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 12. Gerenciador de Progresso com Cache em Memoria (Zero Lag na TV)
let _cachedWatchHistory = null;
let _cachedLookupMap = new Map();

function buildWatchLookupMap(history) {
  const map = new Map();
  for (const item of history) {
    if (!item) continue;
    if (item.id) map.set(String(item.id).toLowerCase().trim(), item);
    if (item.imdbId) map.set(String(item.imdbId).toLowerCase().trim(), item);
    if (item.movieId) map.set(String(item.movieId).toLowerCase().trim(), item);
    if (item.infoHash) map.set(String(item.infoHash).toLowerCase().trim(), item);
    if (item.filePath) map.set(String(item.filePath).toLowerCase().trim(), item);
    if (item.videoPath) map.set(String(item.videoPath).toLowerCase().trim(), item);
    if (item.title) map.set(String(item.title).toLowerCase().trim(), item);
  }
  return map;
}

export function getWatchHistory() {
  if (_cachedWatchHistory !== null) {
    return _cachedWatchHistory;
  }
  try {
    const raw = localStorage.getItem('mf_watch_history');
    const items = raw ? JSON.parse(raw) : [];
    _cachedWatchHistory = items
      .filter(item => item && (item.id || item.title || item.filePath))
      .map(normalizeMovie)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    _cachedLookupMap = buildWatchLookupMap(_cachedWatchHistory);
    return _cachedWatchHistory;
  } catch (_) {
    _cachedWatchHistory = [];
    _cachedLookupMap = new Map();
    return [];
  }
}

// Busca o progresso salvo de qualquer filme/serie em O(1) diretamente da memoria
export function getSavedProgress(movie) {
  if (!movie) return null;
  if (_cachedWatchHistory === null) {
    getWatchHistory();
  }

  const targetId = String(movie.id || movie.imdbId || movie.movieId || movie.infoHash || '').toLowerCase().trim();
  if (targetId && _cachedLookupMap.has(targetId)) {
    return _cachedLookupMap.get(targetId);
  }

  const targetPath = String(movie.filePath || movie.videoPath || '').toLowerCase().trim();
  if (targetPath && _cachedLookupMap.has(targetPath)) {
    return _cachedLookupMap.get(targetPath);
  }

  const targetTitle = String(movie.title || movie.name || movie.cleanName || '').toLowerCase().trim();
  if (targetTitle && _cachedLookupMap.has(targetTitle)) {
    return _cachedLookupMap.get(targetTitle);
  }

  // Fallback: busca por prefixo de título ou correspondência parcial de IDs (ex: série vs episódio)
  if (_cachedWatchHistory && _cachedWatchHistory.length > 0) {
    for (const item of _cachedWatchHistory) {
      if (!item) continue;
      if (targetId && (
        String(item.movieId || '').toLowerCase().trim() === targetId ||
        String(item.imdbId || '').toLowerCase().trim() === targetId ||
        String(item.id || '').toLowerCase().trim().startsWith(targetId)
      )) {
        return item;
      }
      if (targetTitle) {
        const itemTitle = String(item.title || item.name || '').toLowerCase().trim();
        if (itemTitle === targetTitle || itemTitle.startsWith(`${targetTitle} -`) || targetTitle.startsWith(`${itemTitle} -`)) {
          return item;
        }
      }
    }
  }

  return null;
}

export function isInWatchHistory(movie) {
  if (!movie) return false;
  return Boolean(getSavedProgress(movie));
}

export function saveWatchProgress({
  id,
  movieId,
  imdbId,
  title,
  poster,
  backdrop,
  position,
  duration,
  isLocal,
  filePath,
  streamUrl,
  infoHash,
  quality,
  isSeries,
  season,
  episode,
  episodeName,
  year
}) {
  if (!duration || position < 5) return;
  const effectiveId = id || movieId || imdbId || filePath || infoHash || title;
  if (!effectiveId) return;

  const completed = (position / duration) >= 0.92;

  try {
    const normEffectiveId = String(effectiveId).toLowerCase().trim();
    const normPath = filePath ? String(filePath).toLowerCase().trim() : '';
    const normTitle = title ? String(title).toLowerCase().trim() : '';

    let history = getWatchHistory().filter(item => {
      const iId = String(item.id || item.movieId || item.filePath || item.infoHash || item.title).toLowerCase().trim();
      const iPath = item.filePath ? String(item.filePath).toLowerCase().trim() : '';
      const iTitle = item.title ? String(item.title).toLowerCase().trim() : '';

      if (iId === normEffectiveId) return false;
      if (normPath && iPath && (iPath === normPath || iPath.endsWith(normPath) || normPath.endsWith(iPath))) return false;
      if (normTitle && iTitle && iTitle === normTitle) return false;
      return true;
    });

    if (!completed) {
      const itemToSave = {
        id: effectiveId,
        movieId: movieId || effectiveId,
        imdbId: imdbId || '',
        title: title || 'Video',
        poster: poster || '',
        backdrop: backdrop || poster || '',
        position: Math.floor(position),
        duration: Math.floor(duration),
        progress: Math.min(100, Math.round((position / duration) * 100)),
        isLocal: Boolean(isLocal || filePath),
        filePath: filePath || '',
        videoPath: filePath || '',
        streamUrl: streamUrl || '',
        infoHash: infoHash || null,
        quality: quality || '',
        isSeries: Boolean(isSeries),
        season: season || null,
        episode: episode || null,
        episodeName: episodeName || '',
        year: year || '',
        updatedAt: Date.now()
      };
      history.unshift(itemToSave);
    }

    const trimmed = history.slice(0, 25);
    _cachedWatchHistory = trimmed;
    _cachedLookupMap = buildWatchLookupMap(_cachedWatchHistory);

    try {
      localStorage.setItem('mf_watch_history', JSON.stringify(trimmed));
    } catch (_) {}

    // 2. Sincroniza em background com o banco de dados do servidor
    try {
      fetch(`${getServerUrl()}/api/user/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          movieId: effectiveId,
          title,
          poster,
          position: Math.floor(position),
          duration: Math.floor(duration)
        })
      }).catch(() => {});
    } catch (_) {}
  } catch (_) {}
}

export function clearWatchProgress(movieOrId) {
  if (!movieOrId) return;
  try {
    const targets = new Set();
    let targetTitle = '';
    let targetId = '';

    if (typeof movieOrId === 'object') {
      if (movieOrId.id) targets.add(String(movieOrId.id).toLowerCase().trim());
      if (movieOrId.movieId) targets.add(String(movieOrId.movieId).toLowerCase().trim());
      if (movieOrId.imdbId) targets.add(String(movieOrId.imdbId).toLowerCase().trim());
      if (movieOrId.filePath) targets.add(String(movieOrId.filePath).toLowerCase().trim());
      if (movieOrId.videoPath) targets.add(String(movieOrId.videoPath).toLowerCase().trim());
      if (movieOrId.infoHash) targets.add(String(movieOrId.infoHash).toLowerCase().trim());
      targetId = String(movieOrId.id || movieOrId.movieId || movieOrId.imdbId || '').toLowerCase().trim();
      targetTitle = String(movieOrId.title || movieOrId.name || movieOrId.cleanName || '').toLowerCase().trim();
      if (targetTitle) targets.add(targetTitle);
    } else {
      const s = String(movieOrId).toLowerCase().trim();
      targets.add(s);
      targetId = s;
    }

    const history = getWatchHistory().filter(item => {
      const ids = [item.id, item.movieId, item.imdbId, item.filePath, item.videoPath, item.infoHash, item.title]
        .filter(Boolean)
        .map(x => String(x).toLowerCase().trim());

      if (ids.some(id => targets.has(id))) return false;

      if (targetId && (
        String(item.movieId || '').toLowerCase().trim() === targetId ||
        String(item.imdbId || '').toLowerCase().trim() === targetId ||
        String(item.id || '').toLowerCase().trim().startsWith(targetId)
      )) {
        return false;
      }

      if (targetTitle) {
        const itemTitle = String(item.title || item.name || '').toLowerCase().trim();
        if (itemTitle === targetTitle || itemTitle.startsWith(`${targetTitle} -`) || targetTitle.startsWith(`${itemTitle} -`)) {
          return false;
        }
      }

      return true;
    });

    _cachedWatchHistory = history;
    _cachedLookupMap = buildWatchLookupMap(_cachedWatchHistory);

    try {
      localStorage.setItem('mf_watch_history', JSON.stringify(history));
    } catch (_) {}

    const primaryId = typeof movieOrId === 'object'
      ? (movieOrId.id || movieOrId.imdbId || movieOrId.movieId || movieOrId.filePath || movieOrId.title)
      : movieOrId;
    if (primaryId) {
      try {
        fetch(`${getServerUrl()}/api/user/history?movieId=${encodeURIComponent(primaryId)}&userId=default`, {
          method: 'DELETE'
        }).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}
}

export async function deleteLocalFile(filePath) {
  if (!filePath) return { success: false, error: 'Caminho do arquivo não fornecido' };
  try {
    return await request(`/api/local/file?path=${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 13. Minha Lista (Favoritos) com Cache em Memoria e Sincronizacao
let _cachedFavorites = null;
let _cachedFavoritesSet = new Set();

function buildFavoritesSet(favs) {
  const set = new Set();
  for (const f of favs) {
    if (!f) continue;
    if (f.id) set.add(String(f.id).toLowerCase().trim());
    if (f.imdbId) set.add(String(f.imdbId).toLowerCase().trim());
    if (f.movieId) set.add(String(f.movieId).toLowerCase().trim());
    if (f.filePath) set.add(String(f.filePath).toLowerCase().trim());
    if (f.videoPath) set.add(String(f.videoPath).toLowerCase().trim());
    if (f.title) set.add(String(f.title).toLowerCase().trim());
    if (f.cleanName) set.add(String(f.cleanName).toLowerCase().trim());
  }
  return set;
}

export function getFavorites() {
  if (_cachedFavorites !== null) {
    return _cachedFavorites;
  }
  try {
    const raw = localStorage.getItem('mf_favorites');
    const items = raw ? JSON.parse(raw) : [];
    _cachedFavorites = items.filter(Boolean).map(normalizeMovie);
    _cachedFavoritesSet = buildFavoritesSet(_cachedFavorites);
    return _cachedFavorites;
  } catch (_) {
    _cachedFavorites = [];
    _cachedFavoritesSet = new Set();
    return [];
  }
}

// Sincroniza favoritos com o servidor SQLite em background
export async function syncFavoritesWithServer() {
  try {
    const res = await request('/api/user/favorites?userId=default');
    if (res && Array.isArray(res.favorites)) {
      const serverFavs = res.favorites.map(normalizeMovie);
      const localFavs = getFavorites();
      const mergedMap = new Map();

      for (const f of serverFavs) {
        if (!f) continue;
        const key = String(f.id || f.imdbId || f.movieId || f.filePath || f.title).toLowerCase().trim();
        if (key) mergedMap.set(key, f);
      }
      for (const f of localFavs) {
        if (!f) continue;
        const key = String(f.id || f.imdbId || f.movieId || f.filePath || f.title).toLowerCase().trim();
        if (key) mergedMap.set(key, f);
      }

      const merged = Array.from(mergedMap.values());
      _cachedFavorites = merged;
      _cachedFavoritesSet = buildFavoritesSet(merged);
      try {
        localStorage.setItem('mf_favorites', JSON.stringify(merged));
      } catch (_) {}
      return merged;
    }
  } catch (_) {}
  return getFavorites();
}

export function toggleFavorite(movie) {
  if (!movie) return false;
  const norm = normalizeMovie(movie);
  if (!norm) return false;

  const targetId = String(norm.id || norm.imdbId || norm.movieId || norm.filePath || norm.title || '').toLowerCase().trim();
  const targetImdb = String(norm.imdbId || '').toLowerCase().trim();
  const targetPath = String(norm.filePath || norm.videoPath || '').toLowerCase().trim();
  const targetTitle = String(norm.title || norm.name || norm.cleanName || '').toLowerCase().trim();

  if (!targetId && !targetTitle) return false;

  try {
    const favs = [...getFavorites()];
    const idx = favs.findIndex(f => {
      if (!f) return false;
      const fId = String(f.id || f.movieId || '').toLowerCase().trim();
      const fImdb = String(f.imdbId || '').toLowerCase().trim();
      const fPath = String(f.filePath || f.videoPath || '').toLowerCase().trim();
      const fTitle = String(f.title || f.name || f.cleanName || '').toLowerCase().trim();

      if (targetId && fId && targetId === fId) return true;
      if (targetImdb && fImdb && targetImdb === fImdb) return true;
      if (targetPath && fPath && (targetPath === fPath || targetPath.endsWith(fPath) || fPath.endsWith(targetPath))) return true;
      if (targetTitle && fTitle && (targetTitle === fTitle || targetTitle.includes(fTitle) || fTitle.includes(targetTitle))) return true;
      return false;
    });

    let isFav = false;
    if (idx !== -1) {
      favs.splice(idx, 1);
      isFav = false;
    } else {
      favs.unshift(norm);
      isFav = true;
    }

    _cachedFavorites = favs;
    _cachedFavoritesSet = buildFavoritesSet(favs);

    try {
      localStorage.setItem('mf_favorites', JSON.stringify(favs));
    } catch (_) {}

    // Sincroniza em background com o servidor SQLite
    try {
      fetch(`${getServerUrl()}/api/user/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          movie: {
            id: norm.id || norm.imdbId || targetId,
            title: norm.title,
            poster: norm.poster,
            year: norm.year,
            rating: norm.imdbRating || norm.rating
          }
        })
      }).catch(() => {});
    } catch (_) {}

    return isFav;
  } catch (_) {
    return false;
  }
}

export function isFavorite(movieId, imdbId, title = '') {
  if (_cachedFavorites === null) {
    getFavorites();
  }
  if (movieId && _cachedFavoritesSet.has(String(movieId).toLowerCase().trim())) return true;
  if (imdbId && _cachedFavoritesSet.has(String(imdbId).toLowerCase().trim())) return true;
  if (title && _cachedFavoritesSet.has(String(title).toLowerCase().trim())) return true;
  return false;
}
