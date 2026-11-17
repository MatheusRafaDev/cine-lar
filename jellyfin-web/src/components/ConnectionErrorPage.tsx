import DOMPurify from 'dompurify';
import React, { FC, useCallback, useEffect, useState } from 'react';

import { appHost } from 'components/apphost';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import { AppFeature } from 'constants/appFeature';
import LinkButton from 'elements/emby-button/LinkButton';
import globalize from 'lib/globalize';
import { ConnectionState, ServerConnections } from 'lib/jellyfin-apiclient';

interface ConnectionErrorPageProps {
    state: ConnectionState
}

const ConnectionErrorPage: FC<ConnectionErrorPageProps> = ({
    state
}) => {
    const [ title, setTitle ] = useState<string>();
    const [ htmlMessage, setHtmlMessage ] = useState<string>();
    const [ message, setMessage ] = useState<string>();
    const [ isConnectDisabled, setIsConnectDisabled ] = useState(false);

    const onForceConnect = useCallback(async () => {
        setIsConnectDisabled(true);

        try {
            const server = ServerConnections.getLastUsedServer() || {
                ManualAddress: ServerConnections.currentApiClient()?.serverAddress() || window.location.origin
            };
            await ServerConnections.updateSavedServerId(server);
            window.location.reload();
        } catch (err) {
            console.error('[ConnectionErrorPage] Failed to force connect to server', err);
            try {
                localStorage.removeItem('jellyfin_credentials');
            } catch (_) {}
            window.location.reload();
        }
    }, []);

    useEffect(() => {
        if (state === ConnectionState.ServerMismatch && !isConnectDisabled) {
            console.warn('[ConnectionErrorPage] Incompatibilidade de servidor: conectando automaticamente');
            onForceConnect();
        }
    }, [ state, isConnectDisabled, onForceConnect ]);

    useEffect(() => {
        switch (state) {
            case ConnectionState.ServerMismatch:
                setTitle(globalize.translate('HeaderServerMismatch'));
                setHtmlMessage(undefined);
                setMessage(globalize.translate('MessageServerMismatch'));
                return;
            case ConnectionState.ServerUpdateNeeded:
                setTitle(globalize.translate('HeaderUpdateRequired'));
                setHtmlMessage(globalize.translate(
                    'ServerUpdateNeeded',
                    '<a href="https://jellyfin.org/downloads/server/">jellyfin.org/downloads/server</a>'
                ));
                setMessage(undefined);
                return;
            case ConnectionState.Unavailable:
                setTitle(globalize.translate('HeaderServerUnavailable'));
                setHtmlMessage(undefined);
                setMessage(globalize.translate('MessageUnableToConnectToServer'));
        }
    }, [ state ]);

    if (state === ConnectionState.ServerMismatch) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#141414',
                color: '#ffffff',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 12, color: '#e50914', letterSpacing: 1.5 }}>
                    MATHEUSFLIX
                </div>
                <div style={{ fontSize: 14, color: '#b3b3b3' }}>
                    Sincronizando com o servidor...
                </div>
            </div>
        );
    }

    if (!title) return;

    return (
        <Page
            id='connectionErrorPage'
            className='mainAnimatedPage standalonePage'
            isBackButtonEnabled={false}
            shouldAutoFocus
        >
            <div className='padded-left padded-right'>
                <h1>{title}</h1>
                {htmlMessage && (
                    <p
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlMessage) }}
                        style={{ maxWidth: '80ch' }}
                    />
                )}
                {message && (
                    <p style={{ maxWidth: '80ch' }}>
                        {message}
                    </p>
                )}

                {appHost.supports(AppFeature.MultiServer) && (
                    <LinkButton
                        className='raised'
                        href='/selectserver'
                    >
                        {globalize.translate('ButtonChangeServer')}
                    </LinkButton>
                )}
            </div>
        </Page>
    );
};

export default ConnectionErrorPage;
