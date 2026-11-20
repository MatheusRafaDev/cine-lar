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
  const id = item.imdb_id || item.imdbId || item.id || '';
  const isSeries = Boolean(item.isSeries || item.type === 'series' || (item.year && String(item.year).includes('–')));
  return {
    ...item,
    id,
    imdbId: id,
    title: item.title || item.name || item.cleanName || 'Sem título',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    year: item.year ? String(item.year) : '',
    rating: item.rating || item.imdbRating || null,
    imdbRating: item.rating || item.imdbRating || null,
    synopsis: item.description || item.synopsis || '',
    isLocal: Boolean(item.isLocal || item.is_local || item.videoPath || item.filePath),
    isSeries,
    type: isSeries ? 'series' : (item.type || 'movie'),
    streamUrl: item.streamUrl || ''
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
      streamUrl: `/api/stream/${t.infoHash}?magnet=${encodeURIComponent(t.magnetUri || '')}`,
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
export async function startDownload({ magnet, title, poster, imdbId }) {
  try {
    return await request('/api/downloads/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnet, title, poster, imdbId })
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

// 12. Gerenciador de Progresso (Continuar Assistindo)
export function getWatchHistory() {
  try {
    const raw = localStorage.getItem('mf_watch_history');
    const items = raw ? JSON.parse(raw) : [];
    return items.map(normalizeMovie);
  } catch (_) {
    return [];
  }
}

export function saveWatchProgress({ id, title, poster, backdrop, position, duration, imdbId }) {
  if (!id || !duration || position <= 5) return;
  try {
    const history = getWatchHistory().filter(item => item.id !== id);
    const completed = (position / duration) >= 0.90;

    if (!completed) {
      history.unshift({
        id,
        imdbId: imdbId || id,
        title,
        poster,
        backdrop,
        position: Math.floor(position),
        duration: Math.floor(duration),
        progress: Math.min(100, Math.round((position / duration) * 100)),
        updatedAt: Date.now()
      });
    }

    localStorage.setItem('mf_watch_history', JSON.stringify(history.slice(0, 20)));
  } catch (_) {}
}

export function clearWatchProgress(id) {
  try {
    const history = getWatchHistory().filter(item => item.id !== id);
    localStorage.setItem('mf_watch_history', JSON.stringify(history));
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
