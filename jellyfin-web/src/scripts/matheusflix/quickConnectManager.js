import Dashboard from '../../utils/dashboard';
import { ServerConnections } from 'lib/jellyfin-apiclient';

let activeInterval = null;
let activeModal = null;

export function isQuickConnectOpen() {
    return !!activeModal;
}

export function closeQuickConnect() {
    if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
    }
    if (activeModal && activeModal.parentNode) {
        activeModal.parentNode.removeChild(activeModal);
    }
    activeModal = null;
}

export async function startQuickConnect(apiClient, targetUrl = 'home') {
    closeQuickConnect();

    if (!apiClient) {
        apiClient = ServerConnections.currentApiClient();
    }
    if (!apiClient) {
        console.error('[MatheusFlix QuickConnect] ApiClient ausente.');
        return;
    }

    try {
        const initUrl = apiClient.getUrl('/QuickConnect/Initiate');
        const res = await apiClient.ajax({ type: 'POST', url: initUrl }, true);
        const json = await res.json();

        if (!json.Secret || !json.Code) {
            console.error('[MatheusFlix QuickConnect] Resposta invalida:', json);
            return;
        }

        const currentHost = (typeof window !== 'undefined' && window.location.hostname) || '192.168.15.9';
        const port = (typeof window !== 'undefined' && window.location.port) ? window.location.port : '8096';
        const authorizeUrl = `http://${currentHost}:${port}/#/quickconnect`;

        renderQuickConnectModal(apiClient, json.Code, json.Secret, authorizeUrl, targetUrl);
    } catch (err) {
        console.error('[MatheusFlix QuickConnect] Erro ao iniciar:', err);
    }
}

function renderQuickConnectModal(apiClient, code, secret, authorizeUrl, targetUrl) {
    const modal = document.createElement('div');
    modal.className = 'mf-quickconnect-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const formattedDigits = code.split('').map(d => `<span class="mf-qc-digit">${d}</span>`).join('');

    modal.innerHTML = `
        <div class="mf-qc-card">
            <div class="mf-qc-header">
                <div class="mf-qc-logo">
                    <span class="mf-qc-logo-mark">M</span>
                    <span class="mf-qc-logo-title">MATHEUS<span>FLIX</span></span>
                </div>
                <h2 class="mf-qc-title">Conexão Rápida na TV</h2>
                <p class="mf-qc-subtitle">Conecte sua Smart TV usando o celular sem precisar digitar senhas no controle remoto.</p>
            </div>

            <div class="mf-qc-steps">
                <div class="mf-qc-step">
                    <div class="mf-qc-step-num">1</div>
                    <div class="mf-qc-step-content">
                        <div class="mf-qc-step-label">No seu celular ou PC na mesma rede Wi-Fi, acesse:</div>
                        <div class="mf-qc-url-box">${authorizeUrl}</div>
                    </div>
                </div>

                <div class="mf-qc-step">
                    <div class="mf-qc-step-num">2</div>
                    <div class="mf-qc-step-content">
                        <div class="mf-qc-step-label">Digite este código de pareamento:</div>
                        <div class="mf-qc-code-container">
                            ${formattedDigits}
                        </div>
                    </div>
                </div>
            </div>

            <div class="mf-qc-footer">
                <div class="mf-qc-status" id="mfQcStatus">
                    <span class="mf-qc-spinner"></span>
                    <span>Aguardando autorização no seu celular...</span>
                </div>
                <button type="button" class="mf-qc-cancel-btn" id="mfQcCancelBtn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    activeModal = modal;

    const cancelBtn = modal.querySelector('#mfQcCancelBtn');
    if (cancelBtn) {
        cancelBtn.focus();
        cancelBtn.addEventListener('click', closeQuickConnect);
    }

    const onKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Back' || e.keyCode === 10009 || e.keyCode === 27) {
            closeQuickConnect();
            window.removeEventListener('keydown', onKeyDown);
        }
    };
    window.addEventListener('keydown', onKeyDown);

    const connectUrl = apiClient.getUrl('/QuickConnect/Connect?Secret=' + secret);
    activeInterval = setInterval(async () => {
        try {
            const data = await apiClient.getJSON(connectUrl);
            if (data && data.Authenticated) {
                clearInterval(activeInterval);
                activeInterval = null;

                const statusEl = modal.querySelector('#mfQcStatus');
                if (statusEl) {
                    statusEl.innerHTML = '<span style="color:#22C55E; font-weight:700;">Pareamento confirmado! Entrando no MatheusFlix...</span>';
                }

                try {
                    const result = await apiClient.quickConnect(secret);
                    if (result && result.User) {
                        try {
                            const creds = credentialProvider.credentials();
                            if (creds && creds.Servers && creds.Servers.length > 0) {
                                creds.Servers[0].AccessToken = result.AccessToken;
                                creds.Servers[0].UserId = result.User.Id;
                                credentialProvider.credentials(creds);
                            }
                        } catch (_) {}

                        await ServerConnections.onLocalUserSignedIn(result.User);
                        Dashboard.onServerChanged(result.User.Id, result.AccessToken, apiClient);
                        
                        setTimeout(() => {
                            closeQuickConnect();
                            Dashboard.navigate(targetUrl || 'home');
                        }, 800);
                        return;
                    }
                } catch (err) {
                    console.error('[MatheusFlix QuickConnect] Falha ao finalizar sessao:', err);
                }
            }
        } catch (e) {
            console.debug('[MatheusFlix QuickConnect] Polling status:', e);
        }
    }, 2000);
}
