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

export async function fetchCatalog({ q = '', genre = 'all', year = 'all', sort = 'trending', limit = 60, offset = 0 } = {}) {
    /* eslint-disable-next-line compat/compat */
    const params = new URLSearchParams({
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

export async function fetchGenres() {
    const res = await fetch(`${API_BASE}/genres`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function searchTorrents(imdbId, title) {
    /* eslint-disable-next-line compat/compat */
    const params = new URLSearchParams();
    if (imdbId) params.set('imdbId', imdbId);
    if (title) params.set('title', title);

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
