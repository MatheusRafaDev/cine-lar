/**
 * MatheusFlix - Seletor de Perfis estilo Netflix ("Quem está assistindo?")
 * Permite alternar entre contas/perfis de usuário instantaneamente sem senhas chatas.
 */

import { fetchUserProfiles, createUserProfile, switchUserProfile, getCurrentUserId } from './api';
import { escapeHtml } from './utils';
import toast from 'components/toast/toast';

let activeSelectorModal = null;

const AVATAR_COLORS = [
    'linear-gradient(135deg, #e50914 0%, #b81d24 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)'
];

export async function openProfileSelector() {
    if (activeSelectorModal) {
        activeSelectorModal.remove();
        activeSelectorModal = null;
    }

    const currentUserId = getCurrentUserId();

    const modalEl = document.createElement('div');
    modalEl.className = 'mf-profile-selector-overlay';
    modalEl.innerHTML = `
        <div class="mf-profile-selector-container">
            <h1 class="mf-profile-title">Quem está assistindo?</h1>
            <p class="mf-profile-sub">Escolha seu perfil para ver seus favoritos e histórico personalizado.</p>
            
            <div class="mf-profiles-grid">
                <div class="mf-profiles-loading">
                    <span class="mf-profile-spinner">🍿</span>
                    <span>Carregando perfis...</span>
                </div>
            </div>

            <div class="mf-profile-add-form hide">
                <input type="text" class="mf-profile-name-input" placeholder="Nome do novo perfil (ex.: Maria, Crianças)" maxlength="24" />
                <div class="mf-profile-form-actions">
                    <button type="button" class="mf-btn-profile-save">Salvar Perfil</button>
                    <button type="button" class="mf-btn-profile-cancel">Cancelar</button>
                </div>
            </div>

            <div class="mf-profile-actions">
                <button type="button" class="mf-btn-add-profile">
                    <span class="material-icons" style="font-size: 18px;">add</span> Adicionar Perfil
                </button>
                <button type="button" class="mf-btn-close-selector">Continuar como Usuário Atual</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    activeSelectorModal = modalEl;

    const grid = modalEl.querySelector('.mf-profiles-grid');
    const addForm = modalEl.querySelector('.mf-profile-add-form');
    const nameInput = modalEl.querySelector('.mf-profile-name-input');
    const btnAdd = modalEl.querySelector('.mf-btn-add-profile');
    const btnClose = modalEl.querySelector('.mf-btn-close-selector');
    const btnSave = modalEl.querySelector('.mf-btn-profile-save');
    const btnCancel = modalEl.querySelector('.mf-btn-profile-cancel');

    btnClose.addEventListener('click', closeProfileSelector);

    btnAdd.addEventListener('click', () => {
        addForm.classList.remove('hide');
        btnAdd.classList.add('hide');
        nameInput.value = '';
        nameInput.focus();
    });

    btnCancel.addEventListener('click', () => {
        addForm.classList.add('hide');
        btnAdd.classList.remove('hide');
    });

    btnSave.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            toast('Digite o nome do perfil.');
            nameInput.focus();
            return;
        }
        btnSave.disabled = true;
        try {
            toast(`Criando perfil "${name}"...`);
            await createUserProfile(name);
            toast(`Perfil "${name}" criado com sucesso!`);
            addForm.classList.add('hide');
            btnAdd.classList.remove('hide');
            loadProfiles();
        } catch (err) {
            toast(`Erro ao criar perfil: ${err.message}`);
        } finally {
            btnSave.disabled = false;
        }
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnSave.click();
        if (e.key === 'Escape') btnCancel.click();
    });

    async function loadProfiles() {
        try {
            const data = await fetchUserProfiles();
            const profiles = data.profiles || [];
            grid.innerHTML = '';

            profiles.forEach((p, idx) => {
                const isCurrent = (p.id === currentUserId);
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initial = (p.name || 'M').charAt(0).toUpperCase();

                const card = document.createElement('button');
                card.type = 'button';
                card.className = `mf-profile-card ${isCurrent ? 'active' : ''}`;
                card.innerHTML = `
                    <div class="mf-profile-avatar" style="background: ${color};">
                        <span class="mf-profile-initial">${escapeHtml(initial)}</span>
                        ${isCurrent ? '<span class="mf-profile-badge-current">ATIVO</span>' : ''}
                    </div>
                    <span class="mf-profile-name">${escapeHtml(p.name)}</span>
                    <span class="mf-profile-role">${p.isAdmin ? 'Admin' : 'Perfil'}</span>
                `;

                card.addEventListener('click', async () => {
                    if (isCurrent) {
                        closeProfileSelector();
                        return;
                    }
                    try {
                        toast(`Alternando para perfil "${p.name}"...`);
                        await switchUserProfile(p);
                        closeProfileSelector();
                        window.location.reload();
                    } catch (err) {
                        toast(`Não foi possível alternar para "${p.name}": ${err.message}`);
                    }
                });

                grid.appendChild(card);
            });
        } catch (err) {
            grid.innerHTML = `<p class="mf-profile-error">Não foi possível carregar os perfis (${escapeHtml(err.message)}).</p>`;
        }
    }

    loadProfiles();
}

export function closeProfileSelector() {
    if (activeSelectorModal) {
        activeSelectorModal.remove();
        activeSelectorModal = null;
    }
}
