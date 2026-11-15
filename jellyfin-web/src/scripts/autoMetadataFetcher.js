/**
 * MatheusFlix - Auto Metadata & Cover Fetcher
 * Identifica e aplica automaticamente capas e sinopses do TMDb para mídias sem imagem.
 */

import toast from '../components/toast/toast';

export function cleanMediaTitle(rawTitle) {
    if (!rawTitle) return '';
    let title = rawTitle;

    // Remove extensões de arquivo
    title = title.replace(/\.(mkv|mp4|avi|mov|wmv|ts|m4v)$/i, '');

    // Substitui pontos e underscores por espaços
    title = title.replace(/[._]/g, ' ');

    // Remove tags comuns de resolução, codecs e releases
    const tags = [
        '\\b(HD|FHD|UHD|4K|1080p|720p|480p)\\b',
        '\\b(x264|x265|hevc|h264|h265|avc|10bit|8bit)\\b',
        '\\b(bluray|blu-ray|bdrip|brrip|web-dl|webrip|hdtv|dvdrip)\\b',
        '\\b(dublado|legendado|dual|audio|nacional|pt-br|multi)\\b',
        '\\b(curtas|curta|completo|repack|proper|unrated|remastered)\\b'
    ];

    tags.forEach(pattern => {
        title = title.replace(new RegExp(pattern, 'gi'), ' ');
    });

    // Remove números de contadores soltos
    title = title.replace(/\b\d+\b/g, ' ');

    // Normaliza múltiplos espaços
    title = title.replace(/\s+/g, ' ').trim();

    return title || rawTitle;
}

const pendingItemIds = new Set();

/**
 * Busca e aplica capa e metadados para um item sem imagem
 */
export async function autoFetchMissingCover(item, apiClient) {
    if (!item || !item.Id || !apiClient) return;

    // Filtra apenas tipos de mídia suportados (ignora pastas de sistema como Legenda, etc.)
    const supportedTypes = ['Movie', 'Series', 'BoxSet', 'Episode', 'Video'];
    if (!supportedTypes.includes(item.Type)) return;

    // Ignora pastas comuns de arquivos auxiliares
    const ignoredNames = ['créditos', 'creditos', 'legenda', 'legendas', 'screenshots', 'sample'];
    if (ignoredNames.includes(item.Name.toLowerCase().trim())) return;

    // Se já possui imagem Primária, não precisa buscar
    if (item.ImageTags && item.ImageTags.Primary) return;

    // Evita requisições duplicadas simultâneas
    if (pendingItemIds.has(item.Id)) return;
    pendingItemIds.add(item.Id);

    const cleanName = cleanMediaTitle(item.Name);
    const searchType = item.Type === 'Series' ? 'Series' : 'Movie';

    try {
        console.info(`[MatheusFlix AutoMeta] Buscando capa automática para: "${cleanName}" (Original: "${item.Name}")`);

        const lookupInfo = {
            SearchInfo: {
                Name: cleanName
            },
            ItemId: item.Id
        };

        const results = await apiClient.ajax({
            type: 'POST',
            url: apiClient.getUrl(`Items/RemoteSearch/${searchType}`),
            data: JSON.stringify(lookupInfo),
            contentType: 'application/json',
            dataType: 'json'
        });

        if (results && results.length > 0) {
            const bestMatch = results[0];
            console.info(`[MatheusFlix AutoMeta] Encontrado "${bestMatch.Name}" (${bestMatch.ProductionYear || 'ano n/d'}). Aplicando capa e metadados...`);

            await apiClient.ajax({
                type: 'POST',
                url: apiClient.getUrl(`Items/RemoteSearch/Apply/${item.Id}`, { ReplaceAllImages: true }),
                data: JSON.stringify(bestMatch),
                contentType: 'application/json'
            });

            console.info(`[MatheusFlix AutoMeta] Capa aplicada com sucesso para "${bestMatch.Name}".`);

            // Notifica o cliente para atualizar a interface
            if (window.Events) {
                window.Events.trigger(apiClient, 'itemupdated', [item.Id]);
            }
        }
    } catch (err) {
        console.debug(`[MatheusFlix AutoMeta] Busca automática finalizada para "${item.Name}".`);
    } finally {
        setTimeout(() => pendingItemIds.delete(item.Id), 15000);
    }
}

/**
 * Varre a biblioteca procurando todas as mídias sem capa e busca em lote
 */
export async function scanAndFetchAllMissing(apiClient) {
    if (!apiClient) return;

    toast('MatheusFlix: Verificando mídias sem capa...');

    try {
        const userId = apiClient.getCurrentUserId();
        const itemsRes = await apiClient.getItems(userId, {
            Recursive: true,
            IncludeItemTypes: 'Movie,Series,Episode',
            Fields: 'PrimaryImageAspectRatio,Overview'
        });

        const missing = (itemsRes.Items || []).filter(item => !item.ImageTags || !item.ImageTags.Primary);
        console.info(`[MatheusFlix AutoMeta] Mídias sem capa encontradas: ${missing.length}`);

        if (missing.length === 0) {
            toast('Todas as suas mídias já possuem capas!');
            return;
        }

        toast(`Buscando capas para ${missing.length} mídia(s) automaticamente...`);

        for (const item of missing) {
            await autoFetchMissingCover(item, apiClient);
            // Delay suave de 1.2s entre buscas para respeitar o limite de requisições da API
            await new Promise(r => setTimeout(r, 1200));
        }

        toast('Busca de capas concluída!');
    } catch (err) {
        console.error('[MatheusFlix AutoMeta] Erro na varredura geral:', err);
    }
}

// Expõe globalmente para uso no console ou botões
if (typeof window !== 'undefined') {
    window.MatheusFlix = window.MatheusFlix || {};
    window.MatheusFlix.autoFetchMissingCover = autoFetchMissingCover;
    window.MatheusFlix.scanAndFetchAllMissing = scanAndFetchAllMissing;
}
