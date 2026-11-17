import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import React, { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { useSearchParams } from 'react-router-dom';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import LinkButton from 'elements/emby-button/LinkButton';
import { useApi } from 'hooks/useApi';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
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

    const onSwitchProfileClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setSavedNotice('Perfil único ativo no MatheusFlix (Acesso direto sem login).');
        window.setTimeout(() => setSavedNotice(null), 3000);
    }, []);

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div className='mf-profile-avatar'>
                            {(user.Name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h2 className='mf-profile-name'>
                                    {user.Name}
                                </h2>
                                {user.Policy?.IsAdministrator && (
                                    <span className='mf-profile-badge'>
                                        Administrador
                                    </span>
                                )}
                            </div>
                            <p className='mf-profile-subtext'>
                                Perfil ativo no MatheusFlix • Sem exigência de senhas
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type='button'
                            onClick={onSwitchProfileClick}
                            className='mf-btn-switch-profile focusable'
                        >
                            <span className='material-icons' style={{ fontSize: 18 }}>switch_account</span>
                            Trocar Perfil
                        </button>
                    </div>
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

                    <div className='mf-settings-status-row'>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span className='material-icons' style={{ color: '#b3b3b3', fontSize: 24 }}>folder</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Pasta de Filmes & Downloads</div>
                                <div style={{ fontSize: 12, color: '#808080', marginTop: 2 }}>D:\filmes (Organização em Franquias e Séries)</div>
                            </div>
                        </div>
                        <span className='mf-settings-badge-success'>
                            Ativo no Disco D:
                        </span>
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
