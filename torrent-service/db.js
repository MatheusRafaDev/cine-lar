import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'movies.db');

let db = null;

// Portuguese translation for movie genres
export const GENRE_MAP = {
    'Action': 'Ação',
    'Adventure': 'Aventura',
    'Animation': 'Animação',
    'Comedy': 'Comédia',
    'Crime': 'Crime',
    'Documentary': 'Documentário',
    'Drama': 'Drama',
    'Family': 'Família',
    'Fantasy': 'Fantasia',
    'Horror': 'Terror',
    'Mystery': 'Mistério',
    'Romance': 'Romance',
    'Sci-Fi': 'Ficção Científica',
    'Science Fiction': 'Ficção Científica',
    'Thriller': 'Suspense',
    'War': 'Guerra',
    'Western': 'Faroeste'
};

export const GENRE_LIST = [
    { id: 'all', name: 'Todos', icon: '' },
    { id: 'Action', name: 'Ação', icon: '' },
    { id: 'Sci-Fi', name: 'Ficção Científica', icon: '' },
    { id: 'Animation', name: 'Animação', icon: '' },
    { id: 'Comedy', name: 'Comédia', icon: '' },
    { id: 'Horror', name: 'Terror', icon: '' },
    { id: 'Adventure', name: 'Aventura', icon: '' },
    { id: 'Thriller', name: 'Suspense', icon: '' },
    { id: 'Drama', name: 'Drama', icon: '' },
    { id: 'Romance', name: 'Romance', icon: '' },
    { id: 'Crime', name: 'Crime', icon: '' },
    { id: 'Fantasy', name: 'Fantasia', icon: '' },
    { id: 'Family', name: 'Família', icon: '' },
    { id: 'Western', name: 'Faroeste', icon: '' }
];

export function getDb() {
    if (!db) {
        initDb();
    }
    return db;
}

export function initDb() {
    db = new DatabaseSync(DB_PATH);

    // 1. Pragmas de máxima performance: modo WAL, sincronização NORMAL, cache em RAM e mmap
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -8000;
        PRAGMA temp_store = MEMORY;
        PRAGMA mmap_size = 268435456;
    `);

    // 2. Tabela principal de filmes do catálogo
    db.exec(`
        CREATE TABLE IF NOT EXISTS movies (
            imdb_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            original_title TEXT,
            year INTEGER,
            release_date TEXT,
            genres TEXT,
            rating REAL,
            votes INTEGER,
            poster TEXT,
            backdrop TEXT,
            description TEXT,
            popularity REAL,
            is_local INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year DESC);
        CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating DESC);
        CREATE INDEX IF NOT EXISTS idx_movies_genres ON movies(genres);
        CREATE INDEX IF NOT EXISTS idx_movies_pop ON movies(popularity DESC);
        CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_movies_is_local ON movies(is_local);
    `);

    // 3. Tabela dedicada para indexação ultraleve da biblioteca local de arquivos físicos (D:\Filmes)
    db.exec(`
        CREATE TABLE IF NOT EXISTS local_media (
            file_path TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mtime_ms REAL NOT NULL,
            clean_name TEXT,
            imdb_id TEXT,
            title TEXT NOT NULL,
            original_title TEXT,
            year INTEGER,
            poster TEXT,
            backdrop TEXT,
            description TEXT,
            genres TEXT,
            rating REAL DEFAULT 8.0,
            quality TEXT,
            format TEXT,
            duration INTEGER DEFAULT 0,
            video_codec TEXT,
            audio_codec TEXT,
            is_direct_playable INTEGER DEFAULT 0,
            has_subtitle INTEGER DEFAULT 0,
            srt_path TEXT,
            franchise TEXT,
            franchise_icon TEXT,
            is_series INTEGER DEFAULT 0,
            series_name TEXT,
            season INTEGER,
            episode INTEGER,
            updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_local_media_title ON local_media(title COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_local_media_clean ON local_media(clean_name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_local_media_imdb ON local_media(imdb_id);
        CREATE INDEX IF NOT EXISTS idx_local_media_franchise ON local_media(franchise);
    `);

    // 4. Full Text Search (FTS5) para buscas instantâneas
    try {
        db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS movies_fts USING fts5(
                imdb_id UNINDEXED,
                title,
                original_title,
                description,
                genres
            );
        `);
    } catch (e) {
        console.warn('[Database] FTS5 initialization warning:', e.message);
    }

    // 5. Tabelas de usuário (Favoritos e Continuar Assistindo) com índices dedicados
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_favorites (
                user_id TEXT NOT NULL,
                movie_id TEXT NOT NULL,
                title TEXT,
                poster TEXT,
                year INTEGER,
                rating REAL,
                created_at TEXT,
                PRIMARY KEY (user_id, movie_id)
            );
            CREATE INDEX IF NOT EXISTS idx_user_fav_created ON user_favorites(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS watch_history (
                user_id TEXT NOT NULL,
                movie_id TEXT NOT NULL,
                title TEXT,
                poster TEXT,
                position_seconds REAL DEFAULT 0,
                duration_seconds REAL DEFAULT 0,
                completed INTEGER DEFAULT 0,
                updated_at TEXT,
                PRIMARY KEY (user_id, movie_id)
            );
            CREATE INDEX IF NOT EXISTS idx_watch_hist_updated ON watch_history(user_id, updated_at DESC);

            CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_admin INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
        `);
    } catch (e) {
        console.warn('[Database] User tables initialization warning:', e.message);
    }

    console.log(`[Database] SQLite inicializado com sucesso em "${DB_PATH}" (WAL + MemCache)!`);
    return db;
}

export function translateGenres(genresArr) {
    if (!genresArr) return '';
    const list = Array.isArray(genresArr) ? genresArr : String(genresArr).split(/[,\/]/);
    const translated = list.map(g => {
        const trimmed = g.trim();
        return GENRE_MAP[trimmed] || trimmed;
    }).filter(Boolean);
    return [...new Set(translated)].join(', ');
}

export function upsertMovie(movie) {
    if (!movie || !movie.imdb_id) return null;

    const database = getDb();
    const now = new Date().toISOString();

    const title = movie.title || movie.name || '';
    const originalTitle = movie.original_title || movie.original_name || movie.name || '';
    const year = parseInt(movie.releaseInfo || movie.year, 10) || null;
    const releaseDate = movie.release_date || (year ? `${year}-01-01` : null);
    const genres = translateGenres(movie.genres);
    const rating = parseFloat(movie.imdbRating || movie.rating) || null;
    const votes = parseInt(movie.votes, 10) || null;
    const poster = movie.poster || '';
    const backdrop = movie.backdrop || movie.background || '';
    const description = movie.description || movie.overview || '';
    const popularity = parseFloat(movie.popularity || movie.popularities?.moviedb || 0);
    const isLocal = movie.is_local ? 1 : 0;

    const stmt = database.prepare(`
        INSERT INTO movies (
            imdb_id, title, original_title, year, release_date, genres,
            rating, votes, poster, backdrop, description, popularity, is_local,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(imdb_id) DO UPDATE SET
            title = CASE 
                WHEN excluded.title != '' AND excluded.title != excluded.original_title THEN excluded.title
                WHEN movies.title != '' AND movies.title != movies.original_title THEN movies.title
                ELSE excluded.title
            END,
            original_title = CASE 
                WHEN excluded.original_title != '' THEN excluded.original_title 
                ELSE movies.original_title 
            END,
            year = COALESCE(excluded.year, movies.year),
            release_date = COALESCE(excluded.release_date, movies.release_date),
            genres = CASE WHEN excluded.genres != '' THEN excluded.genres ELSE movies.genres END,
            rating = COALESCE(excluded.rating, movies.rating),
            poster = CASE WHEN excluded.poster != '' THEN excluded.poster ELSE movies.poster END,
            description = CASE WHEN excluded.description != '' THEN excluded.description ELSE movies.description END,
            popularity = CASE WHEN excluded.popularity > 0 THEN excluded.popularity ELSE movies.popularity END,
            is_local = MAX(movies.is_local, excluded.is_local),
            updated_at = excluded.updated_at;
    `);

    stmt.run(
        movie.imdb_id, title, originalTitle, year, releaseDate, genres,
        rating, votes, poster, backdrop, description, popularity, isLocal,
        now, now
    );

    // Update FTS5 index
    try {
        const ftsDel = database.prepare('DELETE FROM movies_fts WHERE imdb_id = ?');
        ftsDel.run(movie.imdb_id);

        const ftsIns = database.prepare('INSERT INTO movies_fts (imdb_id, title, original_title, description, genres) VALUES (?, ?, ?, ?, ?)');
        ftsIns.run(movie.imdb_id, title, originalTitle, description, genres);
    } catch (e) {
        // FTS update failure shouldn't crash
    }

    return movie.imdb_id;
}

export function searchCatalog({ q = '', genre = 'all', year = null, sort = 'trending', limit = 40, offset = 0 } = {}) {
    const database = getDb();
    let whereClauses = [];
    let params = [];

    // Search query
    const cleanQuery = q.trim();
    if (cleanQuery) {
        try {
            // Check if FTS matches anything
            // Format query for prefix matching on each word: "dead*"
            const ftsQuery = cleanQuery.split(/\s+/).filter(Boolean).map(w => `${w.replace(/["'*]/g, '')}*`).join(' ');
            if (ftsQuery) {
                whereClauses.push(`imdb_id IN (SELECT imdb_id FROM movies_fts WHERE movies_fts MATCH ?)`);
                params.push(ftsQuery);
            }
        } catch (e) {
            // Fallback to LIKE
            whereClauses.push(`(title LIKE ? OR original_title LIKE ? OR description LIKE ?)`);
            const likeTerm = `%${cleanQuery}%`;
            params.push(likeTerm, likeTerm, likeTerm);
        }
    }

    // Genre filter
    if (genre && genre !== 'all') {
        const ptGenre = GENRE_MAP[genre] || genre;
        whereClauses.push(`(genres LIKE ? OR genres LIKE ?)`);
        params.push(`%${genre}%`, `%${ptGenre}%`);
    }

    // Year filter
    if (year && year !== 'all') {
        if (year === 'classic') {
            whereClauses.push(`year < 2010`);
        } else {
            const yr = parseInt(year, 10);
            if (!isNaN(yr)) {
                whereClauses.push(`year = ?`);
                params.push(yr);
            }
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sort order
    let orderSql = 'ORDER BY popularity DESC, year DESC';
    if (sort === 'rating') {
        orderSql = 'ORDER BY rating DESC, votes DESC, year DESC';
    } else if (sort === 'newest') {
        orderSql = 'ORDER BY year DESC, rating DESC';
    } else if (sort === 'alpha') {
        orderSql = 'ORDER BY title ASC';
    }

    // Count query
    const countStmt = database.prepare(`SELECT COUNT(*) as total FROM movies ${whereSql}`);
    const countRow = countStmt.get(...params);
    const total = countRow?.total || 0;

    // Data query
    const queryStmt = database.prepare(`
        SELECT imdb_id, title, title as name, original_title, year, release_date, genres,
               rating, poster, backdrop, description, popularity, is_local
        FROM movies
        ${whereSql}
        ${orderSql}
        LIMIT ? OFFSET ?
    `);

    const movies = queryStmt.all(...params, limit, offset);

    return {
        movies,
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1
    };
}

export function getGenresSummary() {
    const database = getDb();
    const countTotal = database.prepare('SELECT COUNT(*) as total FROM movies').get()?.total || 0;

    const result = GENRE_LIST.map(g => {
        if (g.id === 'all') {
            return { ...g, count: countTotal };
        }
        const ptGenre = GENRE_MAP[g.id] || g.id;
        const count = database.prepare(`
            SELECT COUNT(*) as cnt FROM movies 
            WHERE genres LIKE ? OR genres LIKE ?
        `).get(`%${g.id}%`, `%${ptGenre}%`)?.cnt || 0;

        return { ...g, count };
    });

    return result;
}

export function syncLocalMoviesInDb(localMovies = []) {
    const database = getDb();
    // 1. Zera todas as marcas de local para eliminar falsos-positivos
    database.exec('UPDATE movies SET is_local = 0');

    // 2. Marca estritamente os filmes validados fisicamente no disco
    const updateById = database.prepare('UPDATE movies SET is_local = 1 WHERE imdb_id = ?');
    const updateByTitle = database.prepare('UPDATE movies SET is_local = 1 WHERE LOWER(title) = LOWER(?) OR LOWER(original_title) = LOWER(?)');

    for (const m of localMovies) {
        const id = m.imdbId || m.imdb_id;
        if (id) {
            try {
                updateById.run(id);
            } catch (e) {}
        } else if (m.title && m.title.length > 2) {
            try {
                updateByTitle.run(m.title, m.originalTitle || m.title);
            } catch (e) {}
        }
    }
}

// User Favorites & Watch History functions (Netflix Style)
export function getUserFavorites(userId) {
    if (!userId) return [];
    const database = getDb();
    return database.prepare(`
        SELECT movie_id as id, movie_id as imdbId, title, poster, year, rating, created_at
        FROM user_favorites
        WHERE user_id = ?
        ORDER BY created_at DESC
    `).all(userId);
}

export function isUserFavorite(userId, movieId) {
    if (!userId || !movieId) return false;
    const database = getDb();
    const mid = String(movieId).trim();
    const row = database.prepare('SELECT 1 FROM user_favorites WHERE user_id = ? AND movie_id = ?').get(userId, mid);
    return Boolean(row);
}

export function toggleUserFavorite(userId, movie) {
    if (!userId || !movie) return { favorite: false };
    const database = getDb();
    const movieId = String(movie.id || movie.imdbId || movie.movieId || movie.filePath || movie.title || '').trim();
    if (!movieId) return { favorite: false };
    const exists = isUserFavorite(userId, movieId);

    if (exists) {
        database.prepare('DELETE FROM user_favorites WHERE user_id = ? AND movie_id = ?').run(userId, movieId);
        return { favorite: false };
    }

    const now = new Date().toISOString();
    database.prepare(`
        INSERT INTO user_favorites (user_id, movie_id, title, poster, year, rating, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        movieId,
        movie.title || '',
        movie.poster || '',
        parseInt(movie.year, 10) || null,
        parseFloat(movie.rating) || null,
        now
    );
    return { favorite: true };
}

export function updateWatchProgress(userId, movieId, title, poster, position, duration) {
    if (!userId || !movieId) return;
    const database = getDb();
    const now = new Date().toISOString();
    const completed = (duration > 0 && position / duration > 0.9) ? 1 : 0;

    database.prepare(`
        INSERT INTO watch_history (user_id, movie_id, title, poster, position_seconds, duration_seconds, completed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, movie_id) DO UPDATE SET
            title = excluded.title,
            poster = excluded.poster,
            position_seconds = excluded.position_seconds,
            duration_seconds = excluded.duration_seconds,
            completed = excluded.completed,
            updated_at = excluded.updated_at
    `).run(userId, movieId, title || '', poster || '', position || 0, duration || 0, completed, now);
}

export function getWatchHistory(userId) {
    if (!userId) return [];
    const database = getDb();
    return database.prepare(`
        SELECT 
            movie_id as id, 
            movie_id as movieId, 
            title, 
            poster, 
            position_seconds as position, 
            duration_seconds as duration, 
            position_seconds, 
            duration_seconds, 
            completed, 
            updated_at
        FROM watch_history
        WHERE user_id = ? AND completed = 0
        ORDER BY updated_at DESC
        LIMIT 20
    `).all(userId);
}

export function deleteWatchHistory(userId, movieId) {
    if (!userId || !movieId) return false;
    const database = getDb();
    const res = database.prepare(`
        DELETE FROM watch_history
        WHERE user_id = ? AND movie_id = ?
    `).run(userId, movieId);
    return res.changes > 0;
}

// Perfis de Usuário 100% Nativos (Sem dependência de serviços externos)
export function getUserProfiles() {
    const database = getDb();
    let rows = [];
    try {
        rows = database.prepare('SELECT id, name, is_admin FROM user_profiles ORDER BY created_at ASC').all();
    } catch (_) {}

    if (!rows || rows.length === 0) {
        const defaultId = 'cinelar_default';
        const defaultName = 'Principal';
        const now = new Date().toISOString();
        try {
            database.prepare('INSERT OR IGNORE INTO user_profiles (id, name, is_admin, created_at) VALUES (?, ?, 1, ?)').run(defaultId, defaultName, now);
        } catch (_) {}
        return [{ id: defaultId, name: defaultName, hasPassword: false, isAdmin: true }];
    }

    return rows.map(r => ({
        id: r.id,
        name: r.name,
        hasPassword: false,
        isAdmin: Boolean(r.is_admin)
    }));
}

export function createUserProfile(name) {
    if (!name || typeof name !== 'string') throw new Error('Nome de perfil inválido');
    const database = getDb();
    const cleanName = name.trim();
    const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();
    database.prepare('INSERT INTO user_profiles (id, name, is_admin, created_at) VALUES (?, ?, 0, ?)').run(id, cleanName, now);
    return { id, name: cleanName, hasPassword: false, isAdmin: false };
}

// 6. Gerenciamento Estruturado e Ultraleve da Tabela local_media
export function getLocalMediaByPath(filePath) {
    if (!filePath) return null;
    const database = getDb();
    return database.prepare('SELECT * FROM local_media WHERE file_path = ?').get(filePath) || null;
}

export function getAllLocalMedia() {
    const database = getDb();
    return database.prepare('SELECT * FROM local_media ORDER BY title COLLATE NOCASE ASC').all();
}

export function upsertLocalMedia(item) {
    if (!item || !item.filePath) return;
    const database = getDb();
    const now = new Date().toISOString();

    database.prepare(`
        INSERT INTO local_media (
            file_path, file_name, file_size, mtime_ms, clean_name, imdb_id,
            title, original_title, year, poster, backdrop, description,
            genres, rating, quality, format, duration, video_codec, audio_codec,
            is_direct_playable, has_subtitle, srt_path, franchise, franchise_icon,
            is_series, series_name, season, episode, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
        ON CONFLICT(file_path) DO UPDATE SET
            file_size = excluded.file_size,
            mtime_ms = excluded.mtime_ms,
            clean_name = excluded.clean_name,
            imdb_id = excluded.imdb_id,
            title = excluded.title,
            original_title = excluded.original_title,
            year = excluded.year,
            poster = excluded.poster,
            backdrop = excluded.backdrop,
            description = excluded.description,
            genres = excluded.genres,
            rating = excluded.rating,
            quality = excluded.quality,
            format = excluded.format,
            duration = excluded.duration,
            video_codec = excluded.video_codec,
            audio_codec = excluded.audio_codec,
            is_direct_playable = excluded.is_direct_playable,
            has_subtitle = excluded.has_subtitle,
            srt_path = excluded.srt_path,
            franchise = excluded.franchise,
            franchise_icon = excluded.franchise_icon,
            is_series = excluded.is_series,
            series_name = excluded.series_name,
            season = excluded.season,
            episode = excluded.episode,
            updated_at = excluded.updated_at
    `).run(
        item.filePath,
        item.fileName || path.basename(item.filePath),
        item.fileSize || 0,
        item.mtimeMs || 0,
        item.cleanName || '',
        item.imdbId || '',
        item.title || item.cleanName || 'Vídeo Local',
        item.originalTitle || item.title || '',
        item.year ? parseInt(item.year, 10) : null,
        item.poster || '',
        item.backdrop || item.poster || '',
        item.description || '',
        item.genres || 'Cinema',
        parseFloat(item.rating) || 8.0,
        item.quality || '1080p',
        item.format || 'MP4',
        item.duration || 0,
        item.videoCodec || '',
        item.audioCodec || '',
        item.isDirectPlayable ? 1 : 0,
        item.hasSubtitle ? 1 : 0,
        item.srtPath || '',
        item.franchise || null,
        item.franchiseIcon || null,
        item.isSeries ? 1 : 0,
        item.seriesName || null,
        item.season ? parseInt(item.season, 10) : null,
        item.episode ? parseInt(item.episode, 10) : null,
        now
    );
}

export function pruneDeletedLocalMedia(existingFilePaths = []) {
    if (!existingFilePaths || existingFilePaths.length === 0) return;
    const database = getDb();
    const rows = database.prepare('SELECT file_path FROM local_media').all();
    const existingSet = new Set(existingFilePaths.map(p => p.toLowerCase()));
    const delStmt = database.prepare('DELETE FROM local_media WHERE file_path = ?');
    for (const row of rows) {
        if (!existingSet.has(row.file_path.toLowerCase())) {
            delStmt.run(row.file_path);
        }
    }
}

export function deleteLocalMediaRecord(filePath) {
    if (!filePath) return;
    try {
        const database = getDb();
        database.prepare('DELETE FROM local_media WHERE file_path = ?').run(filePath);
    } catch (_) {}
}

export function getMovieById(imdbId) {
    if (!imdbId) return null;
    try {
        const database = getDb();
        const row = database.prepare('SELECT * FROM movies WHERE imdb_id = ?').get(imdbId);
        if (row) return row;
        const local = database.prepare('SELECT * FROM local_media WHERE imdb_id = ?').get(imdbId);
        return local || null;
    } catch (_) {
        return null;
    }
}



