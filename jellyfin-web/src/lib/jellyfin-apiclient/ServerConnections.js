// NOTE: This is used for jsdoc return type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Api } from '@jellyfin/sdk';
import { Credentials, ApiClient } from 'jellyfin-apiclient';

import { appHost } from 'components/apphost';
import appSettings from 'scripts/settings/appSettings';
import { setUserInfo } from 'scripts/settings/userSettings';
import Dashboard from 'utils/dashboard';
import Events from 'utils/events.ts';
import { toApi } from 'utils/jellyfin-apiclient/compat';

import ConnectionManager from './connectionManager';

const normalizeImageOptions = options => {
    if (!options.quality && (options.maxWidth || options.width || options.maxHeight || options.height || options.fillWidth || options.fillHeight)) {
        options.quality = 90;
    }
};

const getMaxBandwidth = () => {
    if (navigator.connection) {
        let max = navigator.connection.downlinkMax;
        if (max && max > 0 && max < Number.POSITIVE_INFINITY) {
            max /= 8;
            max *= 1000000;
            max *= 0.7;
            return parseInt(max, 10);
        }
    }

    return null;
};

class ServerConnections extends ConnectionManager {
    constructor() {
        super(...arguments);
        this.localApiClient = null;
        this.firstConnection = null;

        // MatheusFlix: Auto-provisionar servidor padrão se credentials estiver vazio
        try {
            const creds = credentialProvider.credentials();
            if (!creds.Servers || creds.Servers.length === 0) {
                const defaultServer = {
                    Id: 'a61271d6b728483aa696c8d52ace8e04',
                    Name: 'MatheusFlix Server',
                    ManualAddress: 'http://localhost:8096',
                    LocalAddress: 'http://localhost:8096',
                    LastConnectionMode: 2,
                    manualAddressOnly: true,
                    DateLastAccessed: Date.now()
                };
                creds.Servers = [defaultServer];
                credentialProvider.credentials(creds);
            }
        } catch (e) {
            console.warn('[MatheusFlix] Error preconfiguring server credentials:', e);
        }

        Events.on(this, 'localusersignedout', (_e, logoutInfo) => {
            setUserInfo(null, null);
            // Ensure the updated credentials are persisted to storage
            credentialProvider.credentials(credentialProvider.credentials());

            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedOut === 'function') {
                window.NativeShell.onLocalUserSignedOut(logoutInfo);
            }
        });

        Events.on(this, 'apiclientcreated', (_e, apiClient) => {
            apiClient.getMaxBandwidth = getMaxBandwidth;
            apiClient.normalizeImageOptions = normalizeImageOptions;
        });
    }

    initApiClient(server) {
        console.debug('creating ApiClient singleton');

        const apiClient = new ApiClient(
            server,
            appHost.appName(),
            appHost.appVersion(),
            appHost.deviceName(),
            appHost.deviceId()
        );

        apiClient.enableAutomaticNetworking = false;
        apiClient.manualAddressOnly = true;

        this.addApiClient(apiClient);

        this.setLocalApiClient(apiClient);

        console.debug('loaded ApiClient singleton');
    }

    connect(options) {
        return super.connect({
            enableAutoLogin: appSettings.enableAutoLogin(),
            ...options
        }).then(async (result) => {
            // MatheusFlix: Se o servidor exigir login (ServerSignIn), autentica automaticamente sem pedir tela
            if (result && (result.State === 2 || result.State === 'ServerSignIn' || !result.AccessToken) && result.ApiClient) {
                try {
                    console.log('[MatheusFlix] Realizando auto-login transparente de usuario...');
                    const authRes = await result.ApiClient.authenticateUserByName('usuario', '10092004');
                    if (authRes && authRes.User) {
                        result.State = 1; // SignedIn
                        result.User = authRes.User;
                        result.AccessToken = authRes.AccessToken;

                        try {
                            const creds = credentialProvider.credentials();
                            if (creds && creds.Servers && creds.Servers.length > 0) {
                                creds.Servers[0].AccessToken = authRes.AccessToken;
                                creds.Servers[0].UserId = authRes.User.Id;
                                credentialProvider.credentials(creds);
                            }
                        } catch (_) {}

                        await this.onLocalUserSignedIn(authRes.User);
                    }
                } catch (err) {
                    console.warn('[MatheusFlix] Falha no auto-login transparente:', err);
                }
            }
            return result;
        });
    }

    setLocalApiClient(apiClient) {
        if (apiClient) {
            this.localApiClient = apiClient;
            window.ApiClient = apiClient;
        }
    }

    getLocalApiClient() {
        return this.localApiClient;
    }

    /**
     * Gets the ApiClient that is currently connected.
     * @returns {ApiClient|undefined} apiClient
     */
    currentApiClient() {
        let apiClient = this.getLocalApiClient();

        if (!apiClient) {
            const server = this.getLastUsedServer();

            if (server) {
                apiClient = this.getApiClient(server.Id);
            }
        }

        return apiClient;
    }

    /**
     * Gets the Api that is currently connected.
     * @returns {Api|undefined} The current Api instance.
     */
    getCurrentApi() {
        const apiClient = this.currentApiClient();
        if (!apiClient) return;

        return toApi(apiClient);
    }

    /**
     * Gets the ApiClient that is currently connected or throws if not defined.
     * @async
     * @returns {Promise<ApiClient>} The current ApiClient instance.
     */
    async getCurrentApiClientAsync() {
        const apiClient = this.currentApiClient();
        if (!apiClient) throw new Error('[ServerConnection] No current ApiClient instance');

        return apiClient;
    }

    onLocalUserSignedIn(user) {
        const apiClient = this.getApiClient(user.ServerId);
        this.setLocalApiClient(apiClient);
        return setUserInfo(user.Id, apiClient).then(() => {
            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedIn === 'function') {
                return window.NativeShell.onLocalUserSignedIn(user, apiClient.accessToken());
            }
            return Promise.resolve();
        });
    }
}

const credentialProvider = new Credentials();

const capabilities = Dashboard.capabilities(appHost);

export default new ServerConnections(
    credentialProvider,
    () => appHost.appName(),
    () => appHost.appVersion(),
    () => appHost.deviceName(),
    () => appHost.deviceId(),
    capabilities);
