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

export const KNOWN_FRANCHISES = [
    { id: 'toy-story', name: 'Toy Story', icon: '🧸', keywords: ['toy story'] },
    { id: 'carros', name: 'Carros', icon: '🏎️', keywords: ['carros', 'cars'] },
    { id: 'homem-aranha', name: 'Homem-Aranha', icon: '🕷️', keywords: ['homem-aranha', 'homem aranha', 'spider-man', 'spider man'] },
    { id: 'guardioes-da-galaxia', name: 'Guardiões da Galáxia', icon: '🚀', keywords: ['guardioes da galaxia', 'guardiões da galáxia', 'guardians of the galaxy'] },
    { id: 'jogos-vorazes', name: 'Jogos Vorazes', icon: '🏹', keywords: ['jogos vorazes', 'hunger games'] },
    { id: 'batman', name: 'Batman', icon: '🦇', keywords: ['batman', 'dark knight'] },
    { id: 'anjos-da-lei', name: 'Anjos da Lei', icon: '👮', keywords: ['anjos da lei', '21 jump street', '22 jump street'] },
    { id: 'shrek', name: 'Shrek', icon: '🧅', keywords: ['shrek', 'gato de botas', 'puss in boots'] },
    { id: 'resident-evil', name: 'Resident Evil', icon: '☣️', keywords: ['resident evil'] },
    { id: 'patrulha-canina', name: 'Patrulha Canina', icon: '🐾', keywords: ['patrulha canina', 'paw patrol'] },
    { id: 'vingadores-marvel', name: 'Universo Marvel', icon: '🛡️', keywords: ['vingadores', 'avengers', 'iron man', 'homem de ferro', 'capitao america', 'capitão américa', 'captain america', 'thor', 'pantera negra', 'black panther', 'doutor estranho', 'doctor strange'] },
    { id: 'harry-potter', name: 'Harry Potter', icon: '⚡', keywords: ['harry potter', 'animais fantasticos', 'fantastic beasts'] },
    { id: 'senhor-dos-aneis', name: 'O Senhor dos Anéis', icon: '💍', keywords: ['senhor dos aneis', 'senhor dos anéis', 'lord of the rings', 'hobbit'] },
    { id: 'star-wars', name: 'Star Wars', icon: '⚔️', keywords: ['star wars'] },
    { id: 'velozes-e-furiosos', name: 'Velozes e Furiosos', icon: '🏎️💨', keywords: ['velozes e furiosos', 'fast and furious', 'fast & furious'] },
    { id: 'john-wick', name: 'John Wick', icon: '🎯', keywords: ['john wick'] },
    { id: 'missao-impossivel', name: 'Missão Impossível', icon: '🕶️', keywords: ['missao impossivel', 'missão impossível', 'mission impossible'] },
    { id: 'piratas-do-caribe', name: 'Piratas do Caribe', icon: '🏴‍☠️', keywords: ['piratas do caribe', 'pirates of the caribbean'] },
    { id: 'transformers', name: 'Transformers', icon: '🤖', keywords: ['transformers'] },
    { id: 'jurassic-park', name: 'Jurassic Park', icon: '🦖', keywords: ['jurassic park', 'jurassic world'] },
    { id: 'matrix', name: 'Matrix', icon: '🕶️', keywords: ['matrix'] },
    { id: 'planeta-dos-macacos', name: 'Planeta dos Macacos', icon: '🦧', keywords: ['planeta dos macacos', 'planet of the apes'] },
    { id: 'mad-max', name: 'Mad Max', icon: '🔥', keywords: ['mad max'] },
    { id: 'avatar', name: 'Avatar', icon: '🌊', keywords: ['avatar'] },
    { id: 'duna', name: 'Duna', icon: '🏜️', keywords: ['duna', 'dune'] },
    { id: 'invocacao-do-mal', name: 'Universo Invocação do Mal', icon: '🕯️', keywords: ['invocacao do mal', 'invocação do mal', 'conjuring', 'annabelle', 'a freira', 'the nun'] },
    { id: 'meu-malvado-favorito', name: 'Meu Malvado Favorito & Minions', icon: '🍌', keywords: ['meu malvado favorito', 'despicable me', 'minions'] },
    { id: 'como-treinar-o-seu-dragao', name: 'Como Treinar o Seu Dragão', icon: '🐉', keywords: ['como treinar o seu dragao', 'como treinar o seu dragão', 'how to train your dragon'] },
    { id: 'kung-fu-panda', name: 'Kung Fu Panda', icon: '🐼', keywords: ['kung fu panda'] },
    { id: 'era-do-gelo', name: 'A Era do Gelo', icon: '❄️', keywords: ['era do gelo', 'ice age'] },
    { id: 'os-incriveis', name: 'Os Incríveis', icon: '⚡', keywords: ['os incriveis', 'os incríveis', 'incredibles'] },
    { id: 'deadpool', name: 'Deadpool', icon: '⚔️', keywords: ['deadpool'] },
    { id: 'indiana-jones', name: 'Indiana Jones', icon: '🤠', keywords: ['indiana jones'] }
];

export function detectFranchise(raw) {
    if (!raw) return null;
    const lower = String(raw).toLowerCase();
    for (const f of KNOWN_FRANCHISES) {
        if (f.keywords.some((kw) => lower.includes(kw))) {
            return {
                id: f.id,
                name: f.name,
                icon: f.icon
            };
        }
    }
    return null;
}

export function detectSeries(name) {
    if (!name) return { isSeries: false };
    const str = String(name);
    const sMatch = (/\b[Ss](\d+)\b/).exec(str) || (/\btemporada\s*(\d+)\b/i).exec(str);
    const eMatch = (/\b[Ee](\d+)\b/).exec(str) || (/\bepisodio\s*(\d+)\b/i).exec(str);
    const xMatch = (/\b(\d+)x(\d+)\b/i).exec(str);

    let season = null;
    let episode = null;
    if (xMatch) {
        season = parseInt(xMatch[1], 10);
        episode = parseInt(xMatch[2], 10);
    } else {
        if (sMatch) {
            season = parseInt(sMatch[1], 10);
        }
        if (eMatch) {
            episode = parseInt(eMatch[1], 10);
        }
    }

    const hasKeyword = (/\b(serie|série|minisserie|minissérie|anime|temporada|season)\b/i).test(str);
    if (season !== null || episode !== null || hasKeyword) {
        const cleanSeriesName = str.split(/\b(s\d+|\d+x\d+|temporada|season)\b/i)[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || 'Série';
        return {
            isSeries: true,
            seriesName: cleanSeriesName,
            season: season || 1,
            episode: episode || 1
        };
    }
    return { isSeries: false };
}

/** Catálogo/IA usam `name`/`imdb_id`; a pasta local usa `title`/`imdbId`. */
export function normalizeMovie(m = {}) {
    const rating = Number(m.rating);
    const title = m.title || m.name || m.original_title || 'Sem título';
    const rawCheck = `${title} ${m.rawName || ''} ${m.folderName || ''}`;
    const franchise = m.franchise ? { name: m.franchise, icon: m.franchiseIcon || '🎬' } : detectFranchise(rawCheck);
    const seriesInfo = detectSeries(rawCheck);

    return {
        ...m,
        title,
        imdbId: m.imdbId || m.imdb_id || '',
        year: m.year || '',
        poster: m.poster || PLACEHOLDER_POSTER,
        backdrop: m.backdrop || m.poster || '',
        description: m.description || '',
        genres: m.genres || '',
        rating: Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '',
        reason: m.aiReason || m.reason || '',
        isLocal: Boolean(m.isLocal || m.is_local),
        franchise: franchise ? franchise.name : (m.franchise || null),
        franchiseIcon: franchise ? franchise.icon : (m.franchiseIcon || null),
        isSeries: Boolean(m.isSeries || seriesInfo.isSeries),
        seriesName: m.seriesName || (seriesInfo.isSeries ? seriesInfo.seriesName : null),
        season: m.season || (seriesInfo.isSeries ? seriesInfo.season : null),
        episode: m.episode || (seriesInfo.isSeries ? seriesInfo.episode : null)
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
        seeders: Number(s.seeders) || 0,
        isDubbed: Boolean(s.isDubbed),
        isPortuguese: Boolean(s.isPortuguese ?? true)
    };
}
