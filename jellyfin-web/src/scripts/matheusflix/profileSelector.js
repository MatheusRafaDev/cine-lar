/**
 * MatheusFlix - Perfil Único ("usuario")
 * Não há alternância de perfis no sistema; perfil único sempre ativo.
 */

let activeSelectorModal = null;

export async function openProfileSelector() {
    closeProfileSelector();
    return;
}

export function closeProfileSelector() {
    if (activeSelectorModal) {
        activeSelectorModal.remove();
        activeSelectorModal = null;
    }
    const existing = document.querySelectorAll('.mf-profile-selector-overlay');
    existing.forEach(el => el.remove());
}
