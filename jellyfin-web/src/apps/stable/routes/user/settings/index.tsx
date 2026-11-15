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

const getChipStyle = (active: boolean) => ({
    padding: '10px 18px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    border: active ? '1px solid #ff7a1a' : '1px solid rgba(255, 255, 255, 0.12)',
    background: active ? 'linear-gradient(135deg, rgba(255, 122, 26, 0.25), rgba(255, 122, 26, 0.12))' : 'rgba(255, 255, 255, 0.04)',
    color: active ? '#ff9e42' : '#cbd5e1',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    userSelect: 'none' as const
});

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
            style={getChipStyle(active)}
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
        const mf = (window as unknown as { MatheusFlix?: { openProfileSelector?: () => void } }).MatheusFlix;
        if (mf?.openProfileSelector) {
            mf.openProfileSelector();
        } else {
            void import('scripts/matheusflix/profileSelector').then(m => m.openProfileSelector());
        }
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
            <div className='padded-left padded-right padded-bottom-page padded-top' style={{ maxWidth: 860, margin: '0 auto' }}>
                {/* Notificação Flutuante de Salvo */}
                {savedNotice && (
                    <div
                        style={{
                            background: 'rgba(34, 197, 94, 0.2)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            color: '#4ade80',
                            padding: '12px 20px',
                            borderRadius: 12,
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 14,
                            fontWeight: 600,
                            animation: 'fadeIn 0.2s ease'
                        }}
                    >
                        <span className='material-icons' style={{ fontSize: 20 }}>check_circle</span>
                        {savedNotice}
                    </div>
                )}

                {/* Card do Perfil Atual */}
                <div
                    style={{
                        background: 'linear-gradient(135deg, rgba(25, 29, 41, 0.95), rgba(15, 18, 26, 0.98))',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 16,
                        padding: '24px 28px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 16,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ff7a1a, #ff9e42)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 26,
                                boxShadow: '0 4px 16px rgba(255, 122, 26, 0.35)'
                            }}
                        >
                            {(user.Name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ffffff' }}>
                                    {user.Name}
                                </h2>
                                {user.Policy?.IsAdministrator && (
                                    <span
                                        style={{
                                            background: 'rgba(255, 122, 26, 0.2)',
                                            color: '#ff9e42',
                                            border: '1px solid rgba(255, 122, 26, 0.4)',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: 99
                                        }}
                                    >
                                        Administrador
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
                                Perfil ativo no MatheusFlix • Sem exigência de senhas
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type='button'
                            onClick={onSwitchProfileClick}
                            style={{
                                background: 'linear-gradient(135deg, rgba(255, 122, 26, 0.2), rgba(255, 122, 26, 0.1))',
                                color: '#ff9e42',
                                border: '1px solid rgba(255, 122, 26, 0.35)',
                                borderRadius: 12,
                                padding: '10px 20px',
                                fontSize: 14,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span className='material-icons' style={{ fontSize: 20 }}>switch_account</span>
                            Trocar Perfil
                        </button>
                    </div>
                </div>

                {/* Preferências Essenciais Diretas em 1 Tela */}
                <div
                    style={{
                        background: 'rgba(20, 24, 34, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 16,
                        padding: '24px 28px',
                        marginBottom: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 22
                    }}
                >
                    <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff9e42', margin: 0 }}>
                        Preferências do Player & Áudio
                    </h3>

                    {/* Áudio Padrão */}
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className='material-icons' style={{ fontSize: 18, color: '#ff7a1a' }}>volume_up</span>
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
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className='material-icons' style={{ fontSize: 18, color: '#38bdf8' }}>subtitles</span>
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
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className='material-icons' style={{ fontSize: 18, color: '#f59e0b' }}>format_size</span>
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
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className='material-icons' style={{ fontSize: 18, color: '#22c55e' }}>hd</span>
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
                <div
                    style={{
                        background: 'rgba(20, 24, 34, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 16,
                        padding: '20px 24px',
                        marginBottom: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14
                    }}
                >
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: 0 }}>
                        Armazenamento Local & Serviços
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className='material-icons' style={{ color: '#22c55e', fontSize: 24 }}>folder</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Pasta de Filmes & Downloads</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>D:\filmes (Organização em Franquias e Séries)</div>
                            </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '4px 12px', borderRadius: 99 }}>
                            Ativo no Disco D:
                        </span>
                    </div>

                    <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className='material-icons' style={{ color: '#38bdf8', fontSize: 24 }}>bolt</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Serviço de Torrent & Streaming</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Porta 8085 (Node.js + WebTorrent em tempo real)</div>
                            </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '4px 12px', borderRadius: 99 }}>
                            Conectado
                        </span>
                    </div>
                </div>

                {/* Administração do Servidor (se for Admin) */}
                {isLoggedInUser && user.Policy?.IsAdministrator && (
                    <div style={{ marginBottom: 24 }}>
                        <LinkButton
                            href='#/dashboard'
                            className='listItem-border'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                borderRadius: 14,
                                background: 'rgba(20, 24, 34, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                        >
                            <div className='listItem' style={{ padding: '14px 20px' }}>
                                <span className='material-icons listItemIcon listItemIcon-transparent dashboard' style={{ color: '#ff7a1a', fontSize: 24 }} aria-hidden='true' />
                                <div className='listItemBody'>
                                    <div className='listItemBodyText' style={{ fontWeight: 600, color: '#fff' }}>
                                        Painel do Servidor Jellyfin
                                    </div>
                                    <div className='listItemBodyText' style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                        Gerenciar bibliotecas, usuários e plugins do servidor
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#475569' }}>chevron_right</span>
                            </div>
                        </LinkButton>
                    </div>
                )}

                {/* Botão de Sair da Conta */}
                {isLoggedInUser && (
                    <div style={{ marginTop: 10 }}>
                        <button
                            type='button'
                            onClick={onLogoutClick}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: 12,
                                padding: '14px',
                                fontSize: 14,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
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
