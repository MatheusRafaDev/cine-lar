/**
 * MatheusFlix API Client
 * Comunicação com o backend de torrents, catálogo SQLite, Cinemeta e arquivos locais.
 */

// Usa o mesmo host da página: funciona tanto em localhost quanto acessando pelo IP da rede (TV, celular).
const API_HOST = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';
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

export async function cancelDownload(id) {
    const res = await fetch(`${API_BASE}/downloads/${id}`, { method: 'DELETE' });
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

export async function switchUserProfile(profile, explicitPassword = null) {
    const apiClient = window.ApiClient;
    if (!apiClient) throw new Error('ApiClient não inicializado');

    let pw = explicitPassword;
    if (pw === null) {
        if (profile.name === 'rafae') {
            pw = '10092004';
        } else if (!profile.hasPassword) {
            pw = '';
        }
    }

    if (pw === null && profile.hasPassword) {
        pw = window.prompt(`Digite a senha para o perfil "${profile.name}":`) || '';
    }

    const authRes = await apiClient.authenticateUserByName(profile.name, pw || '');
    if (window.Dashboard?.onServerChanged) {
        window.Dashboard.onServerChanged(authRes.User.Id, authRes.AccessToken, apiClient);
    }
    return authRes;
}
