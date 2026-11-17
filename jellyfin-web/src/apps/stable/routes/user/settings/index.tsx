import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { useSearchParams } from 'react-router-dom';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import LinkButton from 'elements/emby-button/LinkButton';
import { useApi } from 'hooks/useApi';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';

interface PrefChipProps {
    active: boolean;
    label: string;
    value: string;
    icon?: string;
    onSelect: (val: string) => void;
}

const PrefChip: FC<PrefChipProps> = ({ active, label, value, icon, onSelect }) => {
    const handleClick = useCallback(() => {
        onSelect(value);
    }, [ onSelect, value ]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSelect(value);
        }
    }, [ onSelect, value ]);

    return (
        <div
            role='button'
            tabIndex={0}
            className={`mf-pref-chip focusable ${active ? 'active' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {icon && <span className='material-icons' style={{ fontSize: 16 }}>{icon}</span>}
            {label}
        </div>
    );
};

const UserSettingsPage: FC = () => {
    const { user: currentUser } = useApi();
    const [ searchParams ] = useSearchParams();
    const { data: users } = useUsers();
    const [ user, setUser ] = useState<UserDto>();

    const [ audioPref, setAudioPref ] = useState(() => localStorage.getItem('mf_pref_audio') || 'ptbr');
    const [ subPref, setSubPref ] = useState(() => localStorage.getItem('mf_pref_sub') || 'auto');
    const [ subSize, setSubSize ] = useState(() => localStorage.getItem('mf_pref_subsize') || 'large');
    const [ qualityPref, setQualityPref ] = useState(() => localStorage.getItem('mf_pref_quality') || 'auto');
    const [ savedNotice, setSavedNotice ] = useState<string | null>(null);

    // Edição do nome do perfil
    const [ isEditingName, setIsEditingName ] = useState(false);
    const [ editNameValue, setEditNameValue ] = useState('');
    const [ isSavingName, setIsSavingName ] = useState(false);

    // Edição da pasta de salvamento
    const [ savePath, setSavePath ] = useState(() => localStorage.getItem('mf_save_path') || 'D:\\filmes');
    const [ isEditingPath, setIsEditingPath ] = useState(false);
    const [ editPathValue, setEditPathValue ] = useState('');
    const [ isSavingPath, setIsSavingPath ] = useState(false);

    useEffect(() => {
        import('components/maintabsmanager').then((m) => {
            m.renderMatheusFlixDefaultTabs(null);
        });
        const userBtn = document.querySelector('.headerUserButton');
        if (userBtn) {
            userBtn.classList.add('headerUserButtonActive');
        }
        return () => {
            if (userBtn) {
                userBtn.classList.remove('headerUserButtonActive');
            }
        };
    }, []);

    useEffect(() => {
        fetch('http://localhost:8085/api/settings/save-path')
            .then(res => res.json())
            .then(data => {
                if (data?.savePath) {
                    setSavePath(data.savePath);
                    localStorage.setItem('mf_save_path', data.savePath);
                }
            })
            .catch(() => {});
    }, []);

    const diskLabel = useMemo(() => {
        const match = savePath.match(/^([A-Za-z]):/);
        return match ? `Ativo no Disco ${match[1].toUpperCase()}:` : 'Pasta Ativa';
    }, [ savePath ]);

    const userId = useMemo(() => (
        searchParams.get('userId') || currentUser?.Id
    ), [ currentUser, searchParams ]);

    const isLoggedInUser = useMemo(() => (
        Boolean(userId && userId === currentUser?.Id)
    ), [ currentUser, userId ]);

    useEffect(() => {
        if (userId) {
            if (userId === currentUser?.Id) setUser(currentUser);
            else setUser(users?.find(({ Id }) => userId === Id));
        }
    }, [ currentUser, userId, users ]);

    const savePref = useCallback((key: string, val: string, setter: (v: string) => void, label: string) => {
        localStorage.setItem(key, val);
        setter(val);
        setSavedNotice(`${label} atualizado com sucesso!`);
        window.setTimeout(() => setSavedNotice(null), 2500);
    }, []);

    const onSelectAudio = useCallback((val: string) => {
        savePref('mf_pref_audio', val, setAudioPref, 'Áudio');
    }, [ savePref ]);

    const onSelectSub = useCallback((val: string) => {
        savePref('mf_pref_sub', val, setSubPref, 'Legendas');
    }, [ savePref ]);

    const onSelectSubSize = useCallback((val: string) => {
        savePref('mf_pref_subsize', val, setSubSize, 'Tamanho da legenda');
    }, [ savePref ]);

    const onSelectQuality = useCallback((val: string) => {
        savePref('mf_pref_quality', val, setQualityPref, 'Qualidade');
    }, [ savePref ]);

    const handleSaveName = useCallback(async () => {
        const trimmed = editNameValue.trim();
        if (!trimmed) {
            setSavedNotice('O nome não pode estar vazio.');
            window.setTimeout(() => setSavedNotice(null), 3000);
            return;
        }
        if (!user) return;
        setIsSavingName(true);
        try {
            const updatedUser = { ...user, Name: trimmed };
            const apiClient = (window as any).ApiClient || ServerConnections.currentApiClient();
            if (apiClient?.updateUser) {
                await apiClient.updateUser(updatedUser);
            }
            setUser(updatedUser);
            setIsEditingName(false);
            localStorage.setItem('mf_user_name', trimmed);
            const userBtn = document.querySelector('.headerUserButton');
            if (userBtn) userBtn.setAttribute('title', trimmed);
            setSavedNotice(`Nome alterado para "${trimmed}" com sucesso!`);
            window.setTimeout(() => setSavedNotice(null), 3000);
        } catch (err: any) {
            console.error('[UserSettings] Erro ao salvar nome:', err);
            setSavedNotice(`Erro ao salvar nome: ${err.message || 'Falha de conexão'}`);
            window.setTimeout(() => setSavedNotice(null), 4000);
        } finally {
            setIsSavingName(false);
        }
    }, [ editNameValue, user ]);

    const handleSavePath = useCallback(async () => {
        const trimmed = editPathValue.trim();
        if (!trimmed) {
            setSavedNotice('O caminho da pasta não pode estar vazio.');
            window.setTimeout(() => setSavedNotice(null), 3000);
            return;
        }
        setIsSavingPath(true);
        try {
            const res = await fetch('http://localhost:8085/api/settings/save-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ savePath: trimmed })
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Falha ao salvar pasta.');
            }
            const saved = data.savePath || trimmed;
            setSavePath(saved);
            localStorage.setItem('mf_save_path', saved);
            setIsEditingPath(false);
            setSavedNotice(`Pasta de downloads atualizada para "${saved}"!`);
            window.setTimeout(() => setSavedNotice(null), 3000);
        } catch (err: any) {
            console.error('[UserSettings] Erro ao salvar pasta:', err);
            setSavedNotice(`Erro ao atualizar pasta: ${err.message || 'Serviço de torrent indisponível'}`);
            window.setTimeout(() => setSavedNotice(null), 4000);
        } finally {
            setIsSavingPath(false);
        }
    }, [ editPathValue ]);

    const onLogoutClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        Dashboard.logout();
    }, []);

    if (!userId || !user) {
        return <Loading />;
    }

    return (
        <Page
            id='myPreferencesMenuPage'
            className='libraryPage userPreferencesPage noSecondaryNavPage mainAnimatedPage'
            title={globalize.translate('Settings')}
            shouldAutoFocus
        >
            <div className='mf-settings-container'>
                {/* Notificação Flutuante de Salvo */}
                {savedNotice && (
                    <div className='mf-settings-saved-notice'>
                        <span className='material-icons' style={{ fontSize: 20 }}>check_circle</span>
                        {savedNotice}
                    </div>
                )}

                {/* Card do Perfil Atual Padrão Netflix */}
                <div className='mf-settings-card mf-profile-card'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 260 }}>
                        <div className='mf-profile-avatar'>
                            {(user.Name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            {isEditingName ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <input
                                        type='text'
                                        className='mf-settings-input focusable'
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveName();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                        autoFocus
                                        maxLength={32}
                                        placeholder='Nome do perfil...'
                                        style={{ maxWidth: 220 }}
                                    />
                                    <button
                                        type='button'
                                        onClick={handleSaveName}
                                        disabled={isSavingName}
                                        className='mf-btn-save-inline focusable'
                                    >
                                        {isSavingName ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setIsEditingName(false)}
                                        className='mf-btn-cancel-inline focusable'
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <h2 className='mf-profile-name'>
                                        {user.Name}
                                    </h2>
                                    {user.Policy?.IsAdministrator && (
                                        <span className='mf-profile-badge'>
                                            Administrador
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className='mf-profile-subtext'>
                                Perfil ativo no MatheusFlix • Sem exigência de senhas
                            </p>
                        </div>
                    </div>

                    {!isEditingName && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type='button'
                                onClick={() => {
                                    setEditNameValue(user.Name || '');
                                    setIsEditingName(true);
                                }}
                                className='mf-btn-action-outline focusable'
                            >
                                <span className='material-icons' style={{ fontSize: 16 }}>edit</span>
                                Alterar Nome
                            </button>
                        </div>
                    )}
                </div>

                {/* Preferências de Reprodução & Áudio Padrão Netflix */}
                <div className='mf-settings-card'>
                    <h3 className='mf-settings-section-title'>
                        Preferências de Reprodução & Áudio
                    </h3>

                    {/* Áudio Padrão */}
                    <div className='mf-settings-group'>
                        <div className='mf-settings-group-title'>
                            <span className='material-icons' style={{ fontSize: 18, color: '#e5e5e5' }}>volume_up</span>
                            Áudio Padrão dos Filmes & Séries
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <PrefChip
                                active={audioPref === 'ptbr'}
                                label='Dublado PT-BR (Padrão)'
                                value='ptbr'
                                icon='star'
                                onSelect={onSelectAudio}
                            />
                            <PrefChip
                                active={audioPref === 'original'}
                                label='Áudio Original'
                                value='original'
                                icon='language'
                                onSelect={onSelectAudio}
                            />
                        </div>
                    </div>

                    {/* Legendas */}
                    <div className='mf-settings-group'>
                        <div className='mf-settings-group-title'>
                            <span className='material-icons' style={{ fontSize: 18, color: '#e5e5e5' }}>subtitles</span>
                            Legendas em Português
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <PrefChip
                                active={subPref === 'auto'}
                                label='Automática (Se não dublado)'
                                value='auto'
                                onSelect={onSelectSub}
                            />
                            <PrefChip
                                active={subPref === 'always'}
                                label='Sempre Ativada'
                                value='always'
                                onSelect={onSelectSub}
                            />
                            <PrefChip
                                active={subPref === 'off'}
                                label='Desativada'
                                value='off'
                                onSelect={onSelectSub}
                            />
                        </div>
                    </div>

                    {/* Tamanho da Legenda */}
                    <div className='mf-settings-group'>
                        <div className='mf-settings-group-title'>
                            <span className='material-icons' style={{ fontSize: 18, color: '#e5e5e5' }}>format_size</span>
                            Tamanho da Legenda
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <PrefChip
                                active={subSize === 'normal'}
                                label='Normal'
                                value='normal'
                                onSelect={onSelectSubSize}
                            />
                            <PrefChip
                                active={subSize === 'large'}
                                label='Grande (Recomendado)'
                                value='large'
                                onSelect={onSelectSubSize}
                            />
                            <PrefChip
                                active={subSize === 'extra'}
                                label='Muito Grande'
                                value='extra'
                                onSelect={onSelectSubSize}
                            />
                        </div>
                    </div>

                    {/* Qualidade de Vídeo */}
                    <div className='mf-settings-group' style={{ marginBottom: 0 }}>
                        <div className='mf-settings-group-title'>
                            <span className='material-icons' style={{ fontSize: 18, color: '#e5e5e5' }}>hd</span>
                            Qualidade de Reprodução
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <PrefChip
                                active={qualityPref === 'auto'}
                                label='Automática (Mais Rápido)'
                                value='auto'
                                onSelect={onSelectQuality}
                            />
                            <PrefChip
                                active={qualityPref === '1080p'}
                                label='1080p Full HD'
                                value='1080p'
                                onSelect={onSelectQuality}
                            />
                            <PrefChip
                                active={qualityPref === '4k'}
                                label='4K UHD Máxima'
                                value='4k'
                                onSelect={onSelectQuality}
                            />
                        </div>
                    </div>
                </div>

                {/* Armazenamento & Motor de Download */}
                <div className='mf-settings-card'>
                    <h3 className='mf-settings-section-title'>
                        Armazenamento Local & Serviços
                    </h3>

                    <div className='mf-settings-status-row' style={{ alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 260 }}>
                            <span className='material-icons' style={{ color: '#b3b3b3', fontSize: 24, marginTop: 2 }}>folder</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Pasta de Filmes & Downloads</div>
                                {isEditingPath ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                        <input
                                            type='text'
                                            className='mf-settings-input focusable'
                                            value={editPathValue}
                                            onChange={(e) => setEditPathValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSavePath();
                                                if (e.key === 'Escape') setIsEditingPath(false);
                                            }}
                                            autoFocus
                                            placeholder='Ex: D:\filmes ou C:\Downloads...'
                                            style={{ minWidth: 260, flex: 1 }}
                                        />
                                        <button
                                            type='button'
                                            onClick={handleSavePath}
                                            disabled={isSavingPath}
                                            className='mf-btn-save-inline focusable'
                                        >
                                            {isSavingPath ? 'Salvando...' : 'Salvar'}
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => setIsEditingPath(false)}
                                            className='mf-btn-cancel-inline focusable'
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 12, color: '#808080', marginTop: 2 }}>
                                        {savePath} (Organização em Franquias e Séries)
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isEditingPath && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className='mf-settings-badge-success'>
                                    {diskLabel}
                                </span>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setEditPathValue(savePath);
                                        setIsEditingPath(true);
                                    }}
                                    className='mf-btn-action-outline focusable'
                                >
                                    <span className='material-icons' style={{ fontSize: 16 }}>folder_open</span>
                                    Alterar Pasta
                                </button>
                            </div>
                        )}
                    </div>

                    <div className='mf-settings-divider' />

                    <div className='mf-settings-status-row'>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span className='material-icons' style={{ color: '#b3b3b3', fontSize: 24 }}>bolt</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Serviço de Torrent & Streaming</div>
                                <div style={{ fontSize: 12, color: '#808080', marginTop: 2 }}>Porta 8085 (Node.js + WebTorrent em tempo real)</div>
                            </div>
                        </div>
                        <span className='mf-settings-badge-info'>
                            Conectado
                        </span>
                    </div>
                </div>

                {/* Administração do Servidor (se for Admin) */}
                {isLoggedInUser && user.Policy?.IsAdministrator && (
                    <div style={{ marginBottom: 24 }}>
                        <LinkButton
                            href='#/dashboard'
                            className='mf-btn-server-admin focusable'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                textDecoration: 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <span className='material-icons' style={{ color: '#e50914', fontSize: 24 }} aria-hidden='true'>
                                        dashboard
                                    </span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                                            Painel do Servidor Jellyfin
                                        </div>
                                        <div style={{ fontSize: 12, color: '#808080', marginTop: 2 }}>
                                            Gerenciar bibliotecas, usuários e plugins do servidor
                                        </div>
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#808080' }}>chevron_right</span>
                            </div>
                        </LinkButton>
                    </div>
                )}

                {/* Botão de Sair da Conta */}
                {isLoggedInUser && (
                    <div style={{ marginTop: 8 }}>
                        <button
                            type='button'
                            onClick={onLogoutClick}
                            className='mf-btn-logout focusable'
                        >
                            <span className='material-icons' style={{ fontSize: 20 }}>exit_to_app</span>
                            {globalize.translate('ButtonSignOut')}
                        </button>
                    </div>
                )}
            </div>
        </Page>
    );
};

export default UserSettingsPage;
