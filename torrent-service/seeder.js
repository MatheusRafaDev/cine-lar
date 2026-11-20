import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { upsertMovie, syncLocalMoviesInDb, getDb } from './db.js';
import { fetchPtBrMetadata } from './tmdbHelper.js';
import { getLocalLibrary } from './localScanner.js';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 CinelarTV/2.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(12000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

const SEED_GENRES = [
    'Action',
    'Sci-Fi',
    'Animation',
    'Comedy',
    'Horror',
    'Adventure',
    'Thriller',
    'Drama',
    'Romance',
    'Crime',
    'Fantasy',
    'Family',
    'Western'
];

export async function seedCatalog(savePath = 'D:\\filmes') {
    const db = getDb();
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM movies').get()?.count || 0;
    console.log(`[Seeder] Catálogo inicial contém ${currentCount} filmes.`);

    // 1. Fetch general top trending movies
    try {
        console.log('[Seeder] Baixando lançamentos e filmes em alta...');
        const topData = await fetchJson('https://cinemeta-catalogs.strem.io/top/catalog/movie/top.json');
        if (topData?.metas) {
            topData.metas.forEach(m => upsertMovie(m));
            console.log(`[Seeder] Inseridos ${topData.metas.length} filmes em alta.`);
        }
    } catch (e) {
        console.warn('[Seeder] Erro ao buscar filmes em alta:', e.message);
    }

    // 2. Fetch each genre in sequence
    for (const genre of SEED_GENRES) {
        try {
            const url = `https://cinemeta-catalogs.strem.io/top/catalog/movie/top/genre=${genre}.json`;
            const data = await fetchJson(url);
            if (data?.metas && Array.isArray(data.metas)) {
                let inserted = 0;
                data.metas.forEach(m => {
                    if (m && m.imdb_id) {
                        upsertMovie(m);
                        inserted++;
                    }
                });
                console.log(`[Seeder] Gênero "${genre}": ${inserted} filmes sincronizados no banco.`);
            }
        } catch (err) {
            console.warn(`[Seeder] Falha ao sincronizar gênero ${genre}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 350));
    }

    // 3. Scan and enrich local movies
    await scanLocalMovies(savePath);

    const finalCount = db.prepare('SELECT COUNT(*) as count FROM movies').get()?.count || 0;
    console.log(`[Seeder] Catalogo do MatheusFlix atualizado! Total: ${finalCount} filmes indexados.`);
}

export async function scanLocalMovies(savePath = 'D:\\filmes') {
    try {
        console.log('[LocalScanner] Varrimento preciso da pasta local:', savePath);
        const localMovies = await getLocalLibrary(savePath, true);
        syncLocalMoviesInDb(localMovies);
        console.log(`[LocalScanner] Biblioteca local sincronizada com sucesso: ${localMovies.length} títulos reais.`);
        return localMovies;
    } catch (e) {
        console.warn('[LocalScanner] Erro ao sincronizar biblioteca local:', e.message);
        return [];
    }
}
