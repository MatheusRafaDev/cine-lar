/**
 * MatheusFlix - utilitários compartilhados.
 * Normaliza os formatos diferentes que o backend devolve (catálogo, IA, pasta local, torrents).
 */

export const PLACEHOLDER_POSTER = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22450%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20fill%3D%22%231a1d26%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3C%2Fsvg%3E';

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Catálogo/IA usam `name`/`imdb_id`; a pasta local usa `title`/`imdbId`. */
export function normalizeMovie(m = {}) {
    const rating = Number(m.rating);
    return {
        ...m,
        title: m.title || m.name || m.original_title || 'Sem título',
        imdbId: m.imdbId || m.imdb_id || '',
        year: m.year || '',
        poster: m.poster || PLACEHOLDER_POSTER,
        backdrop: m.backdrop || m.poster || '',
        description: m.description || '',
        genres: m.genres || '',
        rating: Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '',
        reason: m.aiReason || m.reason || '',
        isLocal: Boolean(m.isLocal || m.is_local)
    };
}

/** Torrents do backend usam `magnetUri`/`filename`. */
export function normalizeStream(s = {}) {
    return {
        ...s,
        magnet: s.magnet || s.magnetUri || '',
        label: s.filename || (s.rawTitle || '').split('\n')[0] || s.rawName || 'Fonte',
        quality: s.quality || 'HD',
        size: s.size || '',
        seeders: Number(s.seeders) || 0
    };
}

