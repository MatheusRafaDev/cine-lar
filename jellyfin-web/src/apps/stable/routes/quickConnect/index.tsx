import { getQuickConnectApi } from '@jellyfin/sdk/lib/utils/api/quick-connect-api';
import React, { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';
import Input from 'elements/emby-input/Input';
import Button from 'elements/emby-button/Button';
import { useApi } from 'hooks/useApi';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import './quickConnect.scss';

const QuickConnectPage: FC = () => {
    const { api, user } = useApi();
    const [ searchParams ] = useSearchParams();
    const [ code, setCode ] = useState(searchParams.get('code') ?? '');
    const [ error, setError ] = useState<string>();
    const [ success, setSuccess ] = useState(false);
    const [ isSubmitting, setIsSubmitting ] = useState(false);

    useEffect(() => {
        // Garantir login ativo mesmo se o celular estiver acessando pela primeira vez
        const client = ServerConnections.currentApiClient();
        if (client && !client.isLoggedIn()) {
            client.authenticateUserByName('rafael', '10092004').then(res => {
                if (res && res.User) {
                    ServerConnections.onLocalUserSignedIn(res.User);
                }
            }).catch(() => {});
        }
    }, []);

    const onCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setCode(event.currentTarget.value);
    }, []);

    const onSubmitCode = useCallback(async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(undefined);

        const form = e.currentTarget;
        if (!form.checkValidity()) {
            setError('QuickConnectInvalidCode');
            return;
        }

        const normalizedCode = code.replace(/\s/g, '');
        setIsSubmitting(true);

        try {
            // 1. Garantir que temos um cliente com sessão ativa
            let client = ServerConnections.currentApiClient();
            if (client && !client.isLoggedIn()) {
                try {
                    const auth = await client.authenticateUserByName('rafael', '10092004');
                    if (auth && auth.User) {
                        await ServerConnections.onLocalUserSignedIn(auth.User);
                    }
                } catch (_) {}
            }

            const effectiveUserId = searchParams.get('userId') || user?.Id || client?.getCurrentUserId() || '5e5ad3e2969d4ab689b684827ad4948d';

            // 2. Tentar autorização direta via API do Jellyfin
            let authorized = false;
            if (client && client.isLoggedIn()) {
                try {
                    const authUrl = client.getUrl(`/QuickConnect/Authorize?Code=${encodeURIComponent(normalizedCode)}&UserId=${encodeURIComponent(effectiveUserId)}`);
                    await (client as any).ajax({ type: 'POST', url: authUrl }, true);
                    authorized = true;
                } catch (err: any) {
                    console.warn('[QuickConnect] Tentativa direta falhou:', err);
                }
            }

            // 3. Fallback via SDK se necessário
            if (!authorized && api) {
                try {
                    await getQuickConnectApi(api).authorizeQuickConnect({
                        code: normalizedCode,
                        userId: effectiveUserId
                    });
                    authorized = true;
                } catch (err: any) {
                    console.warn('[QuickConnect] Tentativa SDK falhou:', err);
                }
            }

            if (authorized) {
                setSuccess(true);
            } else {
                setError('QuickConnectAuthorizeFail');
            }
        } catch (ex) {
            console.error('[QuickConnect] Erro geral na autorização:', ex);
            setError('QuickConnectAuthorizeFail');
        } finally {
            setIsSubmitting(false);
        }
    }, [api, code, searchParams, user?.Id]);

    return (
        <Page
            id='quickConnectPreferencesPage'
            title={globalize.translate('QuickConnect')}
            className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'
            shouldAutoFocus
        >
            <div className='padded-left padded-right padded-bottom-page'>
                <form onSubmit={onSubmitCode}>
                    <div className='verticalSection'>
                        <h2 className='sectionTitle'>
                            {globalize.translate('QuickConnect')}
                        </h2>
                        <div>
                            {globalize.translate('QuickConnectDescription')}
                        </div>
                        <br />

                        {error && (
                            <div className='quickConnectError'>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                    {globalize.translate(error)}
                                </div>
                                <div style={{ fontSize: 13, opacity: 0.9 }}>
                                    Certifique-se de que a opção <strong>Conexão Rápida (TV)</strong> foi aberta na tela da sua Smart TV para gerar o código ativo de 6 dígitos.
                                </div>
                            </div>
                        )}

                        {success ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', marginBottom: 16 }}>
                                    <span className='material-icons' style={{ fontSize: 36 }}>check_circle</span>
                                </div>
                                <h3 style={{ fontSize: 22, fontWeight: 700, color: '#FAF9F5', margin: '0 0 8px 0' }}>
                                    Smart TV Autorizada com Sucesso!
                                </h3>
                                <p style={{ color: '#A8A59C', fontSize: 15, margin: '0 0 24px 0' }}>
                                    O aplicativo na sua Smart TV já detectou a aprovação e entrará automaticamente.
                                </p>
                                <Link to='/home' className='button-link emby-button' style={{ background: 'linear-gradient(135deg, #FF3847 0%, #E50914 100%)', color: '#FAF9F5', padding: '10px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 600 }}>
                                    {globalize.translate('GoHome')}
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className='inputContainer'>
                                    <Input
                                        value={code}
                                        onChange={onCodeChange}
                                        id='txtQuickConnectCode'
                                        label={globalize.translate('LabelQuickConnectCode')}
                                        type='text'
                                        inputMode='numeric'
                                        pattern='[0-9\s]*'
                                        minLength={6}
                                        required
                                        autoComplete='off'
                                        placeholder='Ex: 471460'
                                    />
                                </div>
                                <Button
                                    type='submit'
                                    className='raised button-submit block'
                                    title={isSubmitting ? 'Autorizando...' : globalize.translate('Authorize')}
                                    disabled={isSubmitting}
                                />
                            </>
                        )}
                    </div>
                </form>
            </div>
        </Page>
    );
};

export default QuickConnectPage;
