import path from 'path';

export const KNOWN_FRANCHISES = [
    { id: 'toy-story', name: 'Toy Story', icon: 'smart_toy', regex: /toy[\s\-\.]*story/i },
    { id: 'carros', name: 'Carros', icon: 'directions_car', regex: /\b(carros|cars)\b/i },
    { id: 'homem-aranha', name: 'Homem-Aranha', icon: 'blur_on', regex: /(homem[\s\-\.]*aranha|spider[\s\-\.]*man)/i },
    { id: 'guardioes-da-galaxia', name: 'Guardiões da Galáxia', icon: 'rocket_launch', regex: /(guardi[õo]es[\s\-\.]*da[\s\-\.]*gal[áa]xia|guardians[\s\-\.]*of[\s\-\.]*the[\s\-\.]*galaxy)/i },
    { id: 'jogos-vorazes', name: 'Jogos Vorazes', icon: 'military_tech', regex: /(jogos[\s\-\.]*vorazes|hunger[\s\-\.]*games)/i },
    { id: 'batman', name: 'Batman', icon: 'dark_mode', regex: /\bbatman\b/i },
    { id: 'anjos-da-lei', name: 'Anjos da Lei', icon: 'local_police', regex: /(anjos[\s\-\.]*da[\s\-\.]*lei|21[\s\-\.]*jump[\s\-\.]*street|22[\s\-\.]*jump[\s\-\.]*street)/i },
    { id: 'shrek', name: 'Shrek', icon: 'eco', regex: /\b(shrek|gato[\s\-\.]*de[\s\-\.]*botas|puss[\s\-\.]*in[\s\-\.]*boots)\b/i },
    { id: 'resident-evil', name: 'Resident Evil', icon: 'warning', regex: /resident[\s\-\.]*evil/i },
    { id: 'patrulha-canina', name: 'Patrulha Canina', icon: 'pets', regex: /(patrulha[\s\-\.]*canina|paw[\s\-\.]*patrol)/i },
    { id: 'vingadores-marvel', name: 'Universo Marvel (MCU)', icon: 'shield', regex: /(vingadores|avengers|iron[\s\-\.]*man|homem[\s\-\.]*de[\s\-\.]*ferro|capit[ãa]o[\s\-\.]*am[ée]rica|captain[\s\-\.]*america|thor|pantera[\s\-\.]*negra|black[\s\-\.]*panther|doutor[\s\-\.]*estranho|doctor[\s\-\.]*strange)/i },
    { id: 'harry-potter', name: 'Harry Potter', icon: 'bolt', regex: /(harry[\s\-\.]*potter|animais[\s\-\.]*fant[áa]sticos|fantastic[\s\-\.]*beasts)/i },
    { id: 'senhor-dos-aneis', name: 'O Senhor dos Anéis', icon: 'filter_vintage', regex: /(senhor[\s\-\.]*dos[\s\-\.]*an[ée]is|lord[\s\-\.]*of[\s\-\.]*the[\s\-\.]*rings|hobbit)/i },
    { id: 'star-wars', name: 'Star Wars', icon: 'flare', regex: /star[\s\-\.]*wars/i },
    { id: 'velozes-e-furiosos', name: 'Velozes e Furiosos', icon: 'speed', regex: /(velozes[\s\-\.]*e[\s\-\.]*furiosos|fast[\s\-\.]*(and|&)?[\s\-\.]*furious)/i },
    { id: 'john-wick', name: 'John Wick', icon: 'adjust', regex: /john[\s\-\.]*wick/i },
    { id: 'missao-impossivel', name: 'Missão Impossível', icon: 'visibility_off', regex: /(miss[ãa]o[\s\-\.]*imposs[íi]vel|mission[\s\-\.]*impossible)/i },
    { id: 'piratas-do-caribe', name: 'Piratas do Caribe', icon: 'sailing', regex: /(piratas[\s\-\.]*do[\s\-\.]*caribe|pirates[\s\-\.]*of[\s\-\.]*the[\s\-\.]*caribbean)/i },
    { id: 'transformers', name: 'Transformers', icon: 'smart_toy', regex: /transformers/i },
    { id: 'jurassic-park', name: 'Jurassic Park', icon: 'nature', regex: /(jurassic[\s\-\.]*park|jurassic[\s\-\.]*world)/i },
    { id: 'matrix', name: 'Matrix', icon: 'terminal', regex: /\bmatrix\b/i },
    { id: 'planeta-dos-macacos', name: 'Planeta dos Macacos', icon: 'nature_people', regex: /(planeta[\s\-\.]*dos[\s\-\.]*macacos|planet[\s\-\.]*of[\s\-\.]*the[\s\-\.]*apes)/i },
    { id: 'mad-max', name: 'Mad Max', icon: 'local_fire_department', regex: /mad[\s\-\.]*max/i },
    { id: 'avatar', name: 'Avatar', icon: 'water_drop', regex: /\bavatar\b/i },
    { id: 'duna', name: 'Duna', icon: 'terrain', regex: /\bduna\b|\bdune\b/i },
    { id: 'invocacao-do-mal', name: 'Universo Invocação do Mal', icon: 'psychology', regex: /(invoca[çc][ãa]o[\s\-\.]*do[\s\-\.]*mal|conjuring|annabelle|a[\s\-\.]*freira|the[\s\-\.]*nun)/i },
    { id: 'meu-malvado-favorito', name: 'Meu Malvado Favorito & Minions', icon: 'mood', regex: /(meu[\s\-\.]*malvado[\s\-\.]*favorito|despicable[\s\-\.]*me|minions)/i },
    { id: 'como-treinar-o-seu-dragao', name: 'Como Treinar o Seu Dragão', icon: 'flight', regex: /(como[\s\-\.]*treinar[\s\-\.]*o[\s\-\.]*seu[\s\-\.]*drag[ãa]o|how[\s\-\.]*to[\s\-\.]*train[\s\-\.]*your[\s\-\.]*dragon)/i },
    { id: 'kung-fu-panda', name: 'Kung Fu Panda', icon: 'sports_kabaddi', regex: /kung[\s\-\.]*fu[\s\-\.]*panda/i },
    { id: 'era-do-gelo', name: 'A Era do Gelo', icon: 'ac_unit', regex: /(era[\s\-\.]*do[\s\-\.]*gelo|ice[\s\-\.]*age)/i },
    { id: 'os-incriveis', name: 'Os Incríveis', icon: 'flash_on', regex: /(os[\s\-\.]*incr[íi]veis|incredibles)/i },
    { id: 'deadpool', name: 'Deadpool', icon: 'sports_martial_arts', regex: /deadpool/i },
    { id: 'indiana-jones', name: 'Indiana Jones', icon: 'explore', regex: /indiana[\s\-\.]*jones/i }
];

export function detectFranchise(raw) {
    if (!raw) return null;
    const str = String(raw);
    for (const f of KNOWN_FRANCHISES) {
        if (f.regex.test(str)) {
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

    // S01E02, 1x02, Temporada 1, Season 1, etc.
    const sPattern = /\b(?:S(\d+)|temporada[\s\.\-_]*(\d+)|season[\s\.\-_]*(\d+)|T(\d+))\b/i;
    const ePattern = /\b(?:E(\d+)|epis[oó]dio[\s\.\-_]*(\d+)|episode[\s\.\-_]*(\d+)|EP(\d+))\b/i;
    const xPattern = /\b(\d+)x(\d+)\b/i;

    let season = null;
    let episode = null;

    const xMatch = str.match(xPattern);
    if (xMatch) {
        season = parseInt(xMatch[1], 10);
        episode = parseInt(xMatch[2], 10);
    } else {
        const sMatch = str.match(sPattern);
        const eMatch = str.match(ePattern);
        if (sMatch) {
            season = parseInt(sMatch[1] || sMatch[2] || sMatch[3] || sMatch[4], 10);
        }
        if (eMatch) {
            episode = parseInt(eMatch[1] || eMatch[2] || eMatch[3] || eMatch[4], 10);
        }
    }

    const hasSeriesKeyword = /\b(completa|complete|serie|série|minisserie|minissérie|anime|temporada|season)\b/i.test(str);

    if (season !== null || episode !== null || hasSeriesKeyword) {
        let seriesName = str
            .replace(/\bS\d+.*$/i, '')
            .replace(/\b\d+x\d+.*$/i, '')
            .replace(/\b(temporada|season)\b.*$/i, '')
            .replace(/\b(1080p|720p|2160p|4k|dual|dublado).*/i, '')
            .replace(/[\.\_\-]/g, ' ')
            .trim();
        if (!seriesName) seriesName = 'Série';
        return {
            isSeries: true,
            seriesName,
            season: season || 1,
            episode: episode || 1
        };
    }

    return { isSeries: false };
}

/**
 * Retorna o caminho de pasta específico e organizado para um download da plataforma.
 * - Séries: D:\filmes\MatheusFlix\Series\<Nome da Série>\Temporada XX
 * - Franquias: D:\filmes\MatheusFlix\Franquias\<Nome da Franquia>\<Nome do Filme>
 * - Filmes avulsos: D:\filmes\MatheusFlix\<Nome do Filme>
 */
export function getOrganizedDownloadPath(baseSavePath = path.join('D:\\filmes', 'MatheusFlix'), title = '', filename = '') {
    const raw = `${title} ${filename}`.trim();
    const seriesInfo = detectSeries(raw);

    if (seriesInfo.isSeries) {
        const cleanName = seriesInfo.seriesName
            .replace(/[\\/:*?"<>|]/g, '')
            .trim();
        const seasonStr = `Temporada ${String(seriesInfo.season).padStart(2, '0')}`;
        const targetPath = path.join(baseSavePath, 'Series', cleanName, seasonStr);
        return {
            targetPath,
            category: 'series',
            groupName: cleanName,
            icon: 'tv',
            displayPath: `MatheusFlix\\Series\\${cleanName}\\${seasonStr}`
        };
    }

    const franchise = detectFranchise(raw);
    if (franchise) {
        const cleanMovieName = (title || filename)
            .replace(/[\\/:*?"<>|]/g, '')
            .trim();
        const targetPath = path.join(baseSavePath, 'Franquias', franchise.name, cleanMovieName);
        return {
            targetPath,
            category: 'franchise',
            groupName: franchise.name,
            icon: franchise.icon || 'movie',
            displayPath: `MatheusFlix\\Franquias\\${franchise.name}\\${cleanMovieName}`
        };
    }

    const cleanMovieName = (title || filename)
        .replace(/[\\/:*?"<>|]/g, '')
        .trim();
    const targetPath = path.join(baseSavePath, cleanMovieName);
    return {
        targetPath,
        category: 'movie',
        groupName: null,
        icon: 'movie',
        displayPath: `MatheusFlix\\${cleanMovieName}`
    };
}

/**
 * Agrupa filmes por Franquia e por Série para a interface do MatheusFlix.
 */
export function groupMediaLibrary(movies = []) {
    const franchisesMap = new Map();
    const seriesMap = new Map();
    const standaloneMovies = [];

    for (const m of movies) {
        const raw = `${m.title} ${m.originalTitle || ''} ${m.rawName || ''} ${m.folderName || ''}`;

        if (m.isSeries || detectSeries(raw).isSeries) {
            const seriesInfo = detectSeries(raw);
            const name = m.seriesName || seriesInfo.seriesName || m.title;
            if (!seriesMap.has(name)) {
                seriesMap.set(name, {
                    name,
                    icon: '📺',
                    count: 0,
                    episodes: []
                });
            }
            const group = seriesMap.get(name);
            group.count++;
            group.episodes.push(m);
            continue;
        }

        const franchise = m.franchise ? { name: m.franchise, icon: m.franchiseIcon || '🎬' } : detectFranchise(raw);
        if (franchise) {
            if (!franchisesMap.has(franchise.name)) {
                franchisesMap.set(franchise.name, {
                    name: franchise.name,
                    icon: franchise.icon || '🎬',
                    count: 0,
                    movies: []
                });
            }
            const group = franchisesMap.get(franchise.name);
            group.count++;
            group.movies.push(m);
        } else {
            standaloneMovies.push(m);
        }
    }

    // Ordenar filmes de franquias por ano / título
    const franchises = Array.from(franchisesMap.values()).map(f => {
        f.movies.sort((a, b) => (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
        return f;
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

    const series = Array.from(seriesMap.values()).map(s => {
        s.episodes.sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 1) - (b.episode || 1));
        return s;
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

    return {
        franchises,
        series,
        standaloneMovies
    };
}
