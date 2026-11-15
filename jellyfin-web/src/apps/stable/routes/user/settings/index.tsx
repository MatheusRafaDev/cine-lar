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

const UserSettingsPage: FC = () => {
    const { user: currentUser } = useApi();
    const [ searchParams ] = useSearchParams();
    const { data: users } = useUsers();
    const [ user, setUser ] = useState<UserDto>();

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
            <div className='padded-left padded-right padded-bottom-page padded-top' style={{ maxWidth: 840, margin: '0 auto' }}>
                {/* Cabeçalho do Perfil */}
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
                                Perfil ativo no MatheusFlix
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <LinkButton
                            onClick={onSwitchProfileClick}
                            className='button-flat'
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: 10,
                                padding: '8px 16px',
                                fontSize: 13,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer'
                            }}
                        >
                            <span className='material-icons' style={{ fontSize: 18, color: '#ff7a1a' }}>switch_account</span>
                            Trocar Perfil
                        </LinkButton>

                        <LinkButton
                            href={`#/userprofile?userId=${userId}`}
                            className='button-flat'
                            style={{
                                background: 'rgba(255, 122, 26, 0.15)',
                                color: '#ff9e42',
                                border: '1px solid rgba(255, 122, 26, 0.3)',
                                borderRadius: 10,
                                padding: '8px 16px',
                                fontSize: 13,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer'
                            }}
                        >
                            <span className='material-icons' style={{ fontSize: 18 }}>person</span>
                            Editar Perfil
                        </LinkButton>
                    </div>
                </div>

                {/* Seção de Preferências */}
                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 12px 4px' }}>
                        Preferências do Player & Visual
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <LinkButton
                            href={`#/mypreferencesdisplay?userId=${userId}`}
                            className='listItem-border'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                borderRadius: 12,
                                background: 'rgba(20, 24, 34, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                        >
                            <div className='listItem' style={{ padding: '14px 18px' }}>
                                <span className='material-icons listItemIcon listItemIcon-transparent tv' style={{ color: '#60a5fa', fontSize: 26 }} aria-hidden='true' />
                                <div className='listItemBody'>
                                    <div className='listItemBodyText' style={{ fontWeight: 600, color: '#fff' }}>
                                        {globalize.translate('Display')}
                                    </div>
                                    <div className='listItemBodyText' style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                        Tema escuro, layout e idioma do aplicativo
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#475569' }}>chevron_right</span>
                            </div>
                        </LinkButton>

                        <LinkButton
                            href={`#/mypreferencesplayback?userId=${userId}`}
                            className='listItem-border'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                borderRadius: 12,
                                background: 'rgba(20, 24, 34, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                        >
                            <div className='listItem' style={{ padding: '14px 18px' }}>
                                <span className='material-icons listItemIcon listItemIcon-transparent play_circle_filled' style={{ color: '#22c55e', fontSize: 26 }} aria-hidden='true' />
                                <div className='listItemBody'>
                                    <div className='listItemBodyText' style={{ fontWeight: 600, color: '#fff' }}>
                                        {globalize.translate('TitlePlayback')}
                                    </div>
                                    <div className='listItemBodyText' style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                        Qualidade máxima, saltos e preferências de áudio
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#475569' }}>chevron_right</span>
                            </div>
                        </LinkButton>

                        <LinkButton
                            href={`#/mypreferencessubtitles?userId=${userId}`}
                            className='listItem-border'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                borderRadius: 12,
                                background: 'rgba(20, 24, 34, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                        >
                            <div className='listItem' style={{ padding: '14px 18px' }}>
                                <span className='material-icons listItemIcon listItemIcon-transparent closed_caption' style={{ color: '#f59e0b', fontSize: 26 }} aria-hidden='true' />
                                <div className='listItemBody'>
                                    <div className='listItemBodyText' style={{ fontWeight: 600, color: '#fff' }}>
                                        {globalize.translate('Subtitles')}
                                    </div>
                                    <div className='listItemBodyText' style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                        Tamanho da fonte, cor, fundo e aparência das legendas
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#475569' }}>chevron_right</span>
                            </div>
                        </LinkButton>
                    </div>
                </div>

                {/* Seção de Armazenamento & Filmes */}
                <div style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 12px 4px' }}>
                        Armazenamento Local & Serviços
                    </h3>
                    <div
                        style={{
                            background: 'rgba(16, 20, 30, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 14,
                            padding: '18px 22px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className='material-icons' style={{ color: '#22c55e', fontSize: 24 }}>folder</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Pasta de Filmes & Downloads</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>D:\filmes</div>
                                </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '3px 10px', borderRadius: 99 }}>
                                Ativo no Disco D:
                            </span>
                        </div>

                        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)' }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className='material-icons' style={{ color: '#38bdf8', fontSize: 24 }}>bolt</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Serviço de Torrent & Streaming</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Porta 8085 (Node.js + WebTorrent)</div>
                                </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '3px 10px', borderRadius: 99 }}>
                                Conectado
                            </span>
                        </div>
                    </div>
                </div>

                {/* Seção Administrador (se for admin) */}
                {isLoggedInUser && user.Policy?.IsAdministrator && (
                    <div style={{ marginBottom: 28 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 12px 4px' }}>
                            Administração do Servidor
                        </h3>
                        <LinkButton
                            href='#/dashboard'
                            className='listItem-border'
                            style={{
                                display: 'block',
                                margin: 0,
                                padding: 0,
                                borderRadius: 12,
                                background: 'rgba(20, 24, 34, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}
                        >
                            <div className='listItem' style={{ padding: '14px 18px' }}>
                                <span className='material-icons listItemIcon listItemIcon-transparent dashboard' style={{ color: '#ff7a1a', fontSize: 26 }} aria-hidden='true' />
                                <div className='listItemBody'>
                                    <div className='listItemBodyText' style={{ fontWeight: 600, color: '#fff' }}>
                                        {globalize.translate('TabDashboard')}
                                    </div>
                                    <div className='listItemBodyText' style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                        Gerenciar bibliotecas, usuários, logs e plugins do servidor
                                    </div>
                                </div>
                                <span className='material-icons' style={{ color: '#475569' }}>chevron_right</span>
                            </div>
                        </LinkButton>
                    </div>
                )}

                {/* Seção de Sessão / Sair */}
                {isLoggedInUser && (
                    <div style={{ marginTop: 20, paddingTop: 10 }}>
                        <LinkButton
                            onClick={onLogoutClick}
                            className='button-flat'
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
                        </LinkButton>
                    </div>
                )}
            </div>
        </Page>
    );
};

export default UserSettingsPage;
