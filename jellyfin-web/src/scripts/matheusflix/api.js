/**
 * MatheusFlix API Client
 * Comunicação com o backend de torrents, catálogo SQLite, Cinemeta e arquivos locais.
 */

// Determina o host da API:
// Se estiver rodando dentro da Smart TV Samsung (onde protocolo e file:// ou sem hostname),
// conecta diretamente no IP do computador do servidor (192.168.15.9).
// Caso acesse pelo navegador web no PC ou celular, usa o IP da barra de endereços.
const SERVER_PC_IP = '192.168.15.9';
const API_HOST = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.protocol !== 'file:')
    ? window.location.hostname
    : SERVER_PC_IP;
export const API_BASE = `http://${API_HOST}:8085/api`;

export async function fetchLocalMovies(force = false) {
    const res = await fetch(`${API_BASE}/local-movies${force ? '?force=true' : ''}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function rescanLocalMovies() {
    const res = await fetch(`${API_BASE}/local-movies/rescan`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchCatalog({ type = 'movie', q = '', genre = 'all', year = 'all', sort = 'trending', limit = 60, offset = 0 } = {}) {
    /* eslint-disable-next-line compat/compat */
    const params = new URLSearchParams({
        type,
        q,
        genre,
        year,
        sort,
        limit: String(limit),
        offset: String(offset)
    });
    const res = await fetch(`${API_BASE}/catalog?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchSeriesMeta(imdbId) {
    const res = await fetch(`${API_BASE}/series/meta?id=${encodeURIComponent(imdbId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchGenres() {
    const res = await fetch(`${API_BASE}/genres`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function searchTorrents(imdbId, title, options = {}) {
    /* eslint-disable-next-line compat/compat */
    const params = new URLSearchParams();
    if (imdbId) params.set('imdbId', imdbId);
    if (title) params.set('title', title);
    if (options.type) params.set('type', options.type);
    if (options.season != null) params.set('season', String(options.season));
    if (options.episode != null) params.set('episode', String(options.episode));

    const res = await fetch(`${API_BASE}/torrents?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function startDownload(meta) {
    const res = await fetch(`${API_BASE}/downloads/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchDownloads() {
    const res = await fetch(`${API_BASE}/downloads`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function cancelDownload(id, deleteFiles = true) {
    const res = await fetch(`${API_BASE}/downloads/${id}?deleteFiles=${deleteFiles ? 'true' : 'false'}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function openInQbittorrent(magnet) {
    const res = await fetch(`${API_BASE}/qbittorrent/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function askAi(prompt) {
    const res = await fetch(`${API_BASE}/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function getStreamStatus(infoHash) {
    const res = await fetch(`${API_BASE}/stream/${infoHash}/status`);
    if (!res.ok) return null;
    return res.json();
}

export function getCurrentUserId() {
    return (window.ApiClient && window.ApiClient.getCurrentUserId()) || 'default';
}

export async function fetchUserFavorites() {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/favorites?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function checkIsFavorite(movieId) {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/favorites/check?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}`);
    if (!res.ok) return { favorite: false };
    return res.json();
}

export async function toggleFavorite(movie) {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, movie })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function saveWatchProgress({ movieId, title, poster, position, duration }) {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, movieId, title, poster, position, duration })
    });
    if (!res.ok) return null;
    return res.json();
}

export async function fetchWatchHistory() {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/history?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return { history: [] };
    return res.json();
}

export async function fetchUserProfiles() {
    const res = await fetch(`${API_BASE}/user/profiles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function createUserProfile(name) {
    const res = await fetch(`${API_BASE}/user/profiles/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function switchUserProfile(profile) {
    const apiClient = window.ApiClient;
    if (!apiClient) throw new Error('ApiClient não inicializado');

    // Autenticação direta e sem senha no backend
    const res = await fetch(`${API_BASE}/user/profiles/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, id: profile.id })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.accessToken && data.userId) {
        apiClient.setAuthenticationInfo(data.accessToken, data.userId);
        if (window.Dashboard?.onServerChanged) {
            window.Dashboard.onServerChanged(data.userId, data.accessToken, apiClient);
        }
    }
    return data;
}

export async function deleteLocalMovie(filePath) {
    const res = await fetch(`${API_BASE}/local/file`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function renameLocalMovie(filePath, newTitle) {
    const res = await fetch(`${API_BASE}/local/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, newTitle })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function renameDownload(id, newTitle) {
    const res = await fetch(`${API_BASE}/downloads/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newTitle })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function fetchSavePath() {
    const res = await fetch(`${API_BASE}/settings/save-path`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function updateSavePath(savePath) {
    const res = await fetch(`${API_BASE}/settings/save-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savePath })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function deleteWatchHistory(movieId) {
    const userId = getCurrentUserId();
    const res = await fetch(`${API_BASE}/user/history?userId=${encodeURIComponent(userId)}&movieId=${encodeURIComponent(movieId)}`, {
        method: 'DELETE'
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function fetchTrendingMovies() {
    const res = await fetch(`${API_BASE}/movies/trending`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function searchCatalogMovies(query) {
    const res = await fetch(`${API_BASE}/movies/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchSeasonTorrents(imdbId, season, title = '') {
    /* eslint-disable-next-line compat/compat */
    const params = new URLSearchParams({
        imdb: imdbId,
        season: String(season),
        title
    });
    const res = await fetch(`${API_BASE}/series/season-torrents?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function downloadSeason({ imdbId, seriesName, season, magnet, quality, episodes }) {
    const res = await fetch(`${API_BASE}/series/download-season`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imdbId, seriesName, season, magnet, quality, episodes })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}


