import fs from 'fs';
import path from 'path';
import { getDb, updateLocalMediaPath, getLocalMediaByPath } from './db.js';
import { getLocalLibrary, invalidateLocalCache } from './localScanner.js';
import { cleanMovieName } from './localScanner.js';

/**
 * Sanitiza strings para nomes de pastas e arquivos no Windows.
 * Substitui dois pontos por traço e remove caracteres proibidos: < > : " / \ | ? *
 */
export function sanitizeFsName(str) {
    if (!str) return '';
    return str
        .replace(/:/g, ' -')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Verifica se um arquivo é considerado lixo/propaganda de tracker de torrent.
 */
export function isJunkFile(fileName) {
    if (!fileName) return false;
    const lower = fileName.toLowerCase().trim();

    // 1. Atalhos de sites e links
    if (lower.endsWith('.url') || lower.endsWith('.lnk') || lower.endsWith('.torrent')) {
        return true;
    }

    // 2. Arquivos de texto informativos de trackers
    if (lower.endsWith('.txt')) {
        if (/^(leia|leia\s*importante|important|readme|read\s*me|fan\s*page|visite|acesse|downloaded\s*from|info)/i.test(lower) ||
            /\b(thepiratefilmes|bludv|wolverdonfilmes|totti9|andretpf|comandotorrents|cinecombo)\b/i.test(lower) ||
            /\.com|\.net|\.org|\.me|\.tv/i.test(lower)) {
            return true;
        }
    }

    // 3. Imagens de propaganda e banners de sites
    if (/\.(png|jpg|jpeg|bmp|gif)$/i.test(lower)) {
        if (/\b(thepiratefilmes|bludv|wolverdonfilmes|totti9|andretpf|comandotorrents|acesse|banner|classifica[çc][ãa]o|filmesbluraytorrent)\b/i.test(lower) ||
            /^vlcsnap-/i.test(lower) ||
            /^screenshot/i.test(lower)) {
            return true;
        }
    }

    return false;
}

/**
 * Analisa a biblioteca local e gera um plano detalhado de organização sem alterar nada.
 */
export async function analyzeLibrary(basePath = 'D:\\Filmes') {
    const normBase = path.resolve(basePath);
    if (!fs.existsSync(normBase)) {
        throw new Error(`Pasta base "${basePath}" não foi encontrada.`);
    }

    const junkFiles = [];
    const brokenLinks = [];
    const looseFiles = [];
    const folderRenames = [];
    const fileRenames = [];
    const collectionRenames = [];

    // Carrega metadados salvos do banco SQLite para obter os nomes oficiais corretos
    const db = getDb();
    const mediaRows = db.prepare('SELECT file_path, title, year, clean_name, original_title FROM local_media').all();
    const mediaMap = new Map();
    for (const row of mediaRows) {
        mediaMap.set(row.file_path.toLowerCase(), row);
    }

    const entries = fs.readdirSync(normBase, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(normBase, entry.name);

        // 1. Verifica junctions / symlinks quebrados na raiz
        if (entry.isSymbolicLink() || entry.isDirectory()) {
            let targetExists = false;
            try {
                targetExists = fs.existsSync(fullPath);
            } catch (_) {}

            if (!targetExists) {
                brokenLinks.push({
                    path: fullPath,
                    name: entry.name,
                    reason: 'Atalho ou pasta corrompida / não acessível'
                });
                continue;
            }
        }

        // 2. Arquivos de vídeo soltos na raiz (devem ter sua própria pasta)
        if (entry.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(entry.name)) {
            let stat = null;
            try { stat = fs.statSync(fullPath); } catch {}
            if (stat && stat.size >= 120 * 1024 * 1024) {
                const row = mediaMap.get(fullPath.toLowerCase());
                let title = row?.title;
                let year = row?.year;
                if (!title) {
                    const parsed = cleanMovieName(entry.name);
                    title = parsed.title;
                    year = parsed.year;
                }
                const cleanFolder = sanitizeFsName(year ? `${title} (${year})` : title);
                const ext = path.extname(entry.name);
                const cleanFile = `${cleanFolder}${ext}`;

                looseFiles.push({
                    currentPath: fullPath,
                    currentName: entry.name,
                    targetFolder: path.join(normBase, cleanFolder),
                    targetFilePath: path.join(normBase, cleanFolder, cleanFile),
                    title,
                    year
                });
                continue;
            }
        }

        // 3. Arquivos de lixo na raiz
        if (entry.isFile() && isJunkFile(entry.name)) {
            junkFiles.push({
                path: fullPath,
                name: entry.name,
                parent: normBase
            });
            continue;
        }

        // 4. Pastas de filmes ou coleções
        if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('$')) {
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });

            // Identifica arquivos de lixo dentro da pasta
            for (const sub of subEntries) {
                const subPath = path.join(fullPath, sub.name);
                if (sub.isFile() && isJunkFile(sub.name)) {
                    junkFiles.push({
                        path: subPath,
                        name: sub.name,
                        parent: fullPath
                    });
                }
            }

            // Identifica se é uma coleção com subpastas (ex: Trilogia Shrek)
            const subDirs = subEntries.filter(s => s.isDirectory() && !s.name.startsWith('.'));
            if (subDirs.length > 0 && /\b(trilogia|colecao|coleção|collection|saga|pack)\b/i.test(entry.name)) {
                // Pasta de Franquia / Coleção
                let cleanCollectionName = entry.name
                    .replace(/\(?www\.[^\)\s]+\)?/gi, ' ')
                    .replace(/\b[a-z0-9\-]+\.(com|net|org|tv|me)(\.br)?\b/gi, ' ')
                    .replace(/\b(trilogia|colecao|coleção|collection|saga|pack)\s*/gi, '')
                    .replace(/\b(19\d\d|20\d\d)\s*-\s*(19\d\d|20\d\d)/g, '')
                    .replace(/\[[^\]]+\]/g, '')
                    .replace(/\b(1080p|720p|4k|bluray|web-dl|dual|dublado).*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                const targetCollectionFolder = sanitizeFsName(`${cleanCollectionName} - Coleção`);
                if (targetCollectionFolder && targetCollectionFolder.toLowerCase() !== entry.name.toLowerCase()) {
                    collectionRenames.push({
                        currentPath: fullPath,
                        currentName: entry.name,
                        targetPath: path.join(normBase, targetCollectionFolder),
                        targetName: targetCollectionFolder
                    });
                }

                // Analisa os filmes dentro de cada subpasta da coleção
                for (const subDir of subDirs) {
                    const subDirPath = path.join(fullPath, subDir.name);
                    const movieFiles = fs.readdirSync(subDirPath, { withFileTypes: true })
                        .filter(f => f.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(f.name));

                    if (movieFiles.length === 1) {
                        const mFile = movieFiles[0];
                        const fullVideo = path.join(subDirPath, mFile.name);
                        const row = mediaMap.get(fullVideo.toLowerCase());
                        let title = row?.title;
                        let year = row?.year;
                        if (!title) {
                            const parsed = cleanMovieName(subDir.name);
                            title = parsed.title;
                            year = parsed.year;
                        }
                        const cleanSubFolder = sanitizeFsName(year ? `${title} (${year})` : title);
                        const ext = path.extname(mFile.name);
                        const cleanFileName = `${cleanSubFolder}${ext}`;

                        if (cleanSubFolder.toLowerCase() !== subDir.name.toLowerCase()) {
                            folderRenames.push({
                                currentPath: subDirPath,
                                currentName: subDir.name,
                                targetPath: path.join(fullPath, cleanSubFolder),
                                targetName: cleanSubFolder,
                                title,
                                year
                            });
                        }
                        if (cleanFileName.toLowerCase() !== mFile.name.toLowerCase()) {
                            fileRenames.push({
                                currentPath: fullVideo,
                                currentName: mFile.name,
                                targetName: cleanFileName,
                                folderPath: subDirPath
                            });
                        }
                    }
                }
                continue;
            }

            // Pasta individual de um filme
            const videoFiles = subEntries.filter(s => s.isFile() && /\.(mp4|mkv|avi|webm|ts)$/i.test(s.name));
            if (videoFiles.length === 1) {
                const vf = videoFiles[0];
                const fullVideo = path.join(fullPath, vf.name);
                const row = mediaMap.get(fullVideo.toLowerCase());
                let title = row?.title;
                let year = row?.year;
                if (!title) {
                    const parsed = cleanMovieName(entry.name);
                    title = parsed.title;
                    year = parsed.year;
                }

                const cleanFolder = sanitizeFsName(year ? `${title} (${year})` : title);
                const ext = path.extname(vf.name);
                const cleanFile = `${cleanFolder}${ext}`;

                if (cleanFolder.toLowerCase() !== entry.name.toLowerCase()) {
                    folderRenames.push({
                        currentPath: fullPath,
                        currentName: entry.name,
                        targetPath: path.join(normBase, cleanFolder),
                        targetName: cleanFolder,
                        title,
                        year
                    });
                }

                if (cleanFile.toLowerCase() !== vf.name.toLowerCase()) {
                    fileRenames.push({
                        currentPath: fullVideo,
                        currentName: vf.name,
                        targetName: cleanFile,
                        folderPath: fullPath
                    });
                }
            }
        }
    }

    return {
        basePath: normBase,
        summary: {
            brokenLinksCount: brokenLinks.length,
            junkFilesCount: junkFiles.length,
            looseFilesCount: looseFiles.length,
            foldersToRenameCount: folderRenames.length + collectionRenames.length,
            filesToRenameCount: fileRenames.length
        },
        brokenLinks,
        junkFiles,
        looseFiles,
        folderRenames,
        collectionRenames,
        fileRenames
    };
}

/**
 * Executa de forma segura e atômica o plano de organização.
 */
export async function executeOrganization(basePath = 'D:\\Filmes', options = {}) {
    const analysis = await analyzeLibrary(basePath);
    const results = {
        deletedBrokenLinks: 0,
        deletedJunkFiles: 0,
        organizedLooseFiles: 0,
        renamedFolders: 0,
        renamedFiles: 0,
        errors: []
    };

    // 1. Remove atalhos e junctions corrompidas / quebradas
    for (const bl of analysis.brokenLinks) {
        try {
            if (fs.existsSync(bl.path) || fs.lstatSync(bl.path).isSymbolicLink()) {
                fs.rmSync(bl.path, { recursive: true, force: true });
                results.deletedBrokenLinks++;
            }
        } catch (e) {
            results.errors.push(`Falha ao remover atalho quebrado ${bl.name}: ${e.message}`);
        }
    }

    // 2. Remove arquivos de propaganda (.url, .txt de trackers, banners)
    for (const jf of analysis.junkFiles) {
        try {
            if (fs.existsSync(jf.path)) {
                fs.unlinkSync(jf.path);
                results.deletedJunkFiles++;
            }
        } catch (e) {
            results.errors.push(`Falha ao excluir arquivo de propaganda ${jf.name}: ${e.message}`);
        }
    }

    // 3. Organiza arquivos soltos da raiz em suas respectivas pastas
    for (const lf of analysis.looseFiles) {
        try {
            if (!fs.existsSync(lf.targetFolder)) {
                fs.mkdirSync(lf.targetFolder, { recursive: true });
            }
            if (fs.existsSync(lf.currentPath)) {
                fs.renameSync(lf.currentPath, lf.targetFilePath);
                updateLocalMediaPath(lf.currentPath, lf.targetFilePath);
                results.organizedLooseFiles++;

                // Move legenda correspondente se houver na raiz
                const currentBase = lf.currentName.replace(/\.[^.]+$/, '');
                const srtCandidates = fs.readdirSync(analysis.basePath)
                    .filter(f => f.startsWith(currentBase) && /\.(srt|vtt)$/i.test(f));
                for (const srt of srtCandidates) {
                    const oldSrtPath = path.join(analysis.basePath, srt);
                    const newSrtPath = path.join(lf.targetFolder, `${sanitizeFsName(lf.title || 'Filme')}.pt-BR.srt`);
                    fs.renameSync(oldSrtPath, newSrtPath);
                    updateLocalMediaPath(lf.targetFilePath, lf.targetFilePath, newSrtPath);
                }
            }
        } catch (e) {
            results.errors.push(`Falha ao mover arquivo solto ${lf.currentName}: ${e.message}`);
        }
    }

    // 4. Renomeia arquivos de vídeo e legendas dentro das pastas
    for (const fr of analysis.fileRenames) {
        try {
            const dir = fr.folderPath;
            const newFilePath = path.join(dir, fr.targetName);
            if (fs.existsSync(fr.currentPath) && fr.currentPath.toLowerCase() !== newFilePath.toLowerCase()) {
                fs.renameSync(fr.currentPath, newFilePath);
                updateLocalMediaPath(fr.currentPath, newFilePath);
                results.renamedFiles++;

                // Renomeia também a legenda correspondente se existir
                const currentBase = fr.currentName.replace(/\.[^.]+$/, '');
                const srtFiles = fs.readdirSync(dir).filter(f => f.startsWith(currentBase) && /\.(srt|vtt)$/i.test(f));
                for (const srt of srtFiles) {
                    const oldSrt = path.join(dir, srt);
                    const cleanBase = fr.targetName.replace(/\.[^.]+$/, '');
                    const newSrt = path.join(dir, `${cleanBase}.pt-BR.srt`);
                    if (oldSrt.toLowerCase() !== newSrt.toLowerCase()) {
                        fs.renameSync(oldSrt, newSrt);
                        updateLocalMediaPath(newFilePath, newFilePath, newSrt);
                    }
                }
            }
        } catch (e) {
            results.errors.push(`Falha ao renomear arquivo ${fr.currentName}: ${e.message}`);
        }
    }

    // 5. Renomeia pastas para o padrão limpo "Nome do Filme (Ano)"
    for (const fdr of analysis.folderRenames) {
        try {
            if (fs.existsSync(fdr.currentPath) && fdr.currentPath.toLowerCase() !== fdr.targetPath.toLowerCase()) {
                fs.renameSync(fdr.currentPath, fdr.targetPath);
                results.renamedFolders++;

                // Atualiza referências no banco SQLite para todos os vídeos dentro da pasta renomeada
                const database = getDb();
                const rows = database.prepare('SELECT file_path FROM local_media WHERE file_path LIKE ?').all(`${fdr.currentPath}%`);
                for (const r of rows) {
                    const updatedPath = r.file_path.replace(fdr.currentPath, fdr.targetPath);
                    updateLocalMediaPath(r.file_path, updatedPath);
                }
            }
        } catch (e) {
            results.errors.push(`Falha ao renomear pasta ${fdr.currentName}: ${e.message}`);
        }
    }

    // 6. Renomeia pastas de coleções / franquias
    for (const col of analysis.collectionRenames) {
        try {
            if (fs.existsSync(col.currentPath) && col.currentPath.toLowerCase() !== col.targetPath.toLowerCase()) {
                fs.renameSync(col.currentPath, col.targetPath);
                results.renamedFolders++;

                const database = getDb();
                const rows = database.prepare('SELECT file_path FROM local_media WHERE file_path LIKE ?').all(`${col.currentPath}%`);
                for (const r of rows) {
                    const updatedPath = r.file_path.replace(col.currentPath, col.targetPath);
                    updateLocalMediaPath(r.file_path, updatedPath);
                }
            }
        } catch (e) {
            results.errors.push(`Falha ao renomear coleção ${col.currentName}: ${e.message}`);
        }
    }

    // 7. Força rescan completo do scanner e invalida cache em memória
    invalidateLocalCache(analysis.basePath);
    await getLocalLibrary(analysis.basePath, true);

    return results;
}
