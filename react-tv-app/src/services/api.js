// MatheusFlix API Client - Conecta diretamente ao torrent-service local
const DEFAULT_HOST = '192.168.15.9';
const DEFAULT_PORT = 8085;

function getStoredServerIp() {
  try {
    return localStorage.getItem('mf_server_ip') || '';
  } catch (_) {
    return '';
  }
}

export function getServerUrl() {
  const customIp = getStoredServerIp();
  if (customIp) {
    return customIp.startsWith('http') ? customIp : `http://${customIp}:${DEFAULT_PORT}`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('file')) {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }
  return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
}

export const API_BASE = `${getServerUrl()}/api`;

async function request(endpoint, options = {}) {
  const url = `${getServerUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[API] Erro ao requisitar ${url}:`, err.message);
    throw err;
  }
}

// Normalizador consistente para qualquer item de filme ou série no app
export function normalizeMovie(item) {
  if (!item) return null;
  const id = item.imdb_id || item.imdbId || item.id || item.filePath || '';
  const isSeries = Boolean(item.isSeries || item.type === 'series' || (item.year && String(item.year).includes('–')));
  const isLocal = Boolean(item.isLocal || item.is_local || item.videoPath || item.filePath);
  const position = Number(item.position || item.position_seconds || 0);
  const duration = Number(item.duration || item.duration_seconds || 0);
  const progress = item.progress !== undefined && item.progress !== null
    ? Number(item.progress)
    : (duration > 0 && position > 0 ? Math.min(100, Math.round((position / duration) * 100)) : null);

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
    isLocal,
    filePath: item.filePath || item.videoPath || '',
    videoPath: item.filePath || item.videoPath || '',
    streamUrl: item.streamUrl || '',
    infoHash: item.infoHash || null,
    quality: item.quality || '',
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
    let q = `?limit=${limit}&offset=${offset}`;
    if (genre && genre !== 'all') {
      q += `&genre=${encodeURIComponent(genre)}`;
    }
    const data = await request(`/api/movies${q}`);
    const list = data.movies || [];
    return list.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

// 1.1 Obter catálogo de séries por gênero ou geral
export async function getSeries({ genre = '', limit = 30, offset = 0 } = {}) {
  try {
    let q = `?type=series&limit=${limit}&offset=${offset}`;
    if (genre && genre !== 'all') {
      q += `&genre=${encodeURIComponent(genre)}`;
    }
    const data = await request(`/api/movies${q}`);
    const list = data.movies || [];
    return list.map(item => normalizeMovie({ ...item, isSeries: true, type: 'series' }));
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
    const data = await request('/api/movies/trending');
    const list = data.movies || [];
    return list.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

// 3. Obter gêneros disponíveis
export async function getGenres() {
  try {
    const data = await request('/api/genres');
    return data.genres || [];
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

// 4.1 Obter biblioteca local completa com franquias e filmes avulsos estruturados
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

    return {
      movies,
      franchises,
      standaloneMovies,
      series,
      count: data.count || movies.length,
      totalSize: data.totalSize || '',
      savePath: data.savePath || 'D:\\Filmes'
    };
  } catch (_) {
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

// 5. Obter torrents e detalhes do filme para reprodução
export async function getMovieDetails(movie) {
  if (!movie) return null;
  const normalized = normalizeMovie(movie);
  const imdbId = normalized.imdbId || normalized.id;
  const title = normalized.title;

  if (normalized.isLocal) {
    return normalized;
  }

  try {
    const data = await request(`/api/torrents?imdbId=${encodeURIComponent(imdbId)}&title=${encodeURIComponent(title)}`);
    const streams = (data.torrents || []).map(t => ({
      ...t,
      streamUrl: `/api/stream/${t.infoHash}?magnet=${encodeURIComponent(t.magnetUri || '')}&title=${encodeURIComponent(title)}`,
      magnet: t.magnetUri
    }));

    return {
      ...normalized,
      isLocal: data.isLocal || false,
      localFile: data.localFile || null,
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

// 7. Lista de downloads
export async function getDownloads() {
  try {
    const data = await request('/api/downloads');
    return data.downloads || [];
  } catch (_) {
    return [];
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

// 12. Gerenciador de Progresso (Continuar Assistindo)
export function getWatchHistory() {
  try {
    const raw = localStorage.getItem('mf_watch_history');
    const items = raw ? JSON.parse(raw) : [];
    return items
      .filter(item => item && (item.id || item.title || item.filePath))
      .map(normalizeMovie)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (_) {
    return [];
  }
}

// Busca o progresso salvo de qualquer filme/série por correspondência flexível (ID, IMDb, caminho ou título)
export function getSavedProgress(movie) {
  if (!movie) return null;
  try {
    const history = getWatchHistory();
    const targetId = String(movie.id || movie.imdbId || movie.movieId || '').toLowerCase().trim();
    const targetPath = String(movie.filePath || movie.videoPath || '').toLowerCase().trim();
    const targetTitle = String(movie.title || movie.name || movie.cleanName || '').toLowerCase().trim();

    return history.find(item => {
      if (!item) return false;
      const itemPath = String(item.filePath || item.videoPath || '').toLowerCase().trim();
      if (targetPath && itemPath && (itemPath === targetPath || itemPath.endsWith(targetPath) || targetPath.endsWith(itemPath))) {
        return true;
      }
      const itemId = String(item.id || '').toLowerCase().trim();
      const itemImdb = String(item.imdbId || '').toLowerCase().trim();
      const itemMovieId = String(item.movieId || '').toLowerCase().trim();
      const itemHash = String(item.infoHash || '').toLowerCase().trim();

      if (targetId && (targetId === itemId || targetId === itemImdb || targetId === itemMovieId || targetId === itemHash)) {
        return true;
      }
      const itemTitle = String(item.title || item.name || '').toLowerCase().trim();
      if (targetTitle && itemTitle && (targetTitle === itemTitle || targetTitle.includes(itemTitle) || itemTitle.includes(targetTitle))) {
        return true;
      }
      return false;
    }) || null;
  } catch (_) {
    return null;
  }
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
    // 1. Atualiza localStorage imediatamente (filtrando o item atual para reordenar no topo)
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
        title: title || 'Vídeo',
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

    localStorage.setItem('mf_watch_history', JSON.stringify(history.slice(0, 25)));

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

export function clearWatchProgress(id) {
  if (!id) return;
  try {
    const target = String(id).toLowerCase().trim();
    const history = getWatchHistory().filter(item => {
      const iId = String(item.id || item.movieId || item.filePath || item.infoHash || item.title).toLowerCase().trim();
      return iId !== target;
    });
    localStorage.setItem('mf_watch_history', JSON.stringify(history));

    // Sincroniza remoção no servidor
    try {
      fetch(`${getServerUrl()}/api/user/history?movieId=${encodeURIComponent(id)}&userId=default`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch (_) {}
  } catch (_) {}
}

// 13. Minha Lista (Favoritos)
export function getFavorites() {
  try {
    const raw = localStorage.getItem('mf_favorites');
    const items = raw ? JSON.parse(raw) : [];
    return items.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

export function toggleFavorite(movie) {
  if (!movie || !movie.id) return false;
  try {
    const favs = getFavorites();
    const idx = favs.findIndex(f => f.id === movie.id || (movie.imdbId && f.imdbId === movie.imdbId));
    let isFav = false;
    if (idx !== -1) {
      favs.splice(idx, 1);
      isFav = false;
    } else {
      favs.unshift(normalizeMovie(movie));
      isFav = true;
    }
    localStorage.setItem('mf_favorites', JSON.stringify(favs));
    return isFav;
  } catch (_) {
    return false;
  }
}

export function isFavorite(movieId, imdbId) {
  const favs = getFavorites();
  return favs.some(f => f.id === movieId || (imdbId && f.imdbId === imdbId));
}
