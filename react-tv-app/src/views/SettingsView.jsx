import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getServerStatus,
  getStoredServerIp,
  setStoredServerIp,
  getStoredApiToken,
  setStoredApiToken,
  rescanLocalLibrary,
  getDriveConfig,
  setDriveConfig,
  clearAppOfflineCache,
  clearAllWatchHistory,
  getServerDetailedStatus,
  getStorageTelemetry,
  executeLibraryOrganization
} from '../services/api';

const SETTINGS_CATEGORIES = [
  { id: 'server', label: 'Servidor & Rede', icon: 'dns', desc: 'Conexão e IP do PC' },
  { id: 'drive', label: 'Google Drive', icon: 'cloud', desc: 'Nuvem e streaming offline' },
  { id: 'storage', label: 'Armazenamento', icon: 'storage', desc: 'Discos D:\\ e G:\\' },
  { id: 'data', label: 'Dados & Cache', icon: 'cleaning_services', desc: 'Histórico e memória' },
  { id: 'about', label: 'Sobre o Sistema', icon: 'info', desc: 'Versão e atalhos da TV' }
];

export function SettingsView({
  activeZone = 'rows',
  focusedIndex = 0,
  actionIndex = 0,
  serverStatus = 'online',
  onOpenDriveConfig = () => {},
  onRefreshLibrary = () => {}
}) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [serverIp, setServerIp] = useState(() => getStoredServerIp() || '');
  const [apiToken, setApiToken] = useState(() => getStoredApiToken());
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [detailedStatus, setDetailedStatus] = useState(null);
  const [storageData, setStorageData] = useState(null);
  const [driveConfig, setDriveConfigState] = useState(() => getDriveConfig());
  const [folderIdInput, setFolderIdInput] = useState(() => getDriveConfig().folderId || '');
  const [apiKeyInput, setApiKeyInput] = useState(() => getDriveConfig().apiKey || '');
  const [toastMessage, setToastMessage] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);

  const categoryRefs = useRef([]);
  const actionRefs = useRef([]);

  const isViewFocused = activeZone === 'rows';

  // Sincroniza a categoria com o focusedIndex se estiver focado
  useEffect(() => {
    if (isViewFocused && focusedIndex >= 0 && focusedIndex < SETTINGS_CATEGORIES.length) {
      setSelectedCategory(focusedIndex);
    }
  }, [isViewFocused, focusedIndex]);

  // Carrega status detalhado e telemetria de armazenamento ao abrir a tela
  useEffect(() => {
    getServerDetailedStatus().then(st => setDetailedStatus(st)).catch(() => {});
    getStorageTelemetry().then(st => setStorageData(st)).catch(() => {});
    setDriveConfigState(getDriveConfig());
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const start = Date.now();
    try {
      const isOnline = await getServerStatus();
      const latency = Date.now() - start;
      if (isOnline) {
        showToast(`PC Conectado com sucesso! Latência: ${latency}ms`);
      } else {
        showToast('Não foi possível conectar ao PC. Verifique se o servidor está rodando.');
      }
    } catch (_) {
      showToast('Erro ao testar conexão com o servidor local.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveIp = () => {
    setStoredServerIp(serverIp);
    setIsEditingIp(false);
    showToast(serverIp ? `IP do servidor atualizado para: ${serverIp}` : 'IP redefinido para detecção automática');
    handleTestConnection();
  };

  const handleSaveApiToken = () => {
    setStoredApiToken(apiToken);
    showToast(apiToken.trim() ? 'Token de acesso salvo neste dispositivo.' : 'Token local removido.');
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    showToast('Re-escaneando pasta local D:\\Filmes...');
    try {
      const res = await rescanLocalLibrary();
      if (res && res.success !== false) {
        showToast('Biblioteca local re-indexada com sucesso!');
        onRefreshLibrary();
      } else {
        showToast(res?.error || 'Erro ao re-indexar biblioteca.');
      }
    } catch (err) {
      showToast(`Erro ao re-escanear: ${err.message}`);
    } finally {
      setIsRescanning(false);
    }
  };

  const [isOrganizing, setIsOrganizing] = useState(false);
  const handleOrganizeLibrary = async () => {
    setIsOrganizing(true);
    showToast('Organizando pastas e limpando propagandas de torrents...');
    try {
      const res = await executeLibraryOrganization();
      if (res?.success) {
        const r = res.result || {};
        showToast(`Sucesso! ${r.renamedFolders || 0} pastas padronizadas, ${r.deletedJunkFiles || 0} propagandas removidas.`);
        if (onRefreshLibrary) onRefreshLibrary(true);
      } else {
        showToast(res?.error || 'Não foi possível organizar a biblioteca.');
      }
    } catch (err) {
      showToast(`Erro ao organizar: ${err.message}`);
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleSaveDriveConfig = () => {
    const newCfg = { folderId: folderIdInput.trim(), apiKey: apiKeyInput.trim() };
    setDriveConfig(newCfg);
    setDriveConfigState(newCfg);
    showToast('Configurações do Google Drive salvas com sucesso!');
    if (onRefreshLibrary) onRefreshLibrary();
  };

  const handleClearCache = () => {
    clearAppOfflineCache();
    showToast('Cache de filmes offline limpo com sucesso! A memória da TV foi liberada.');
  };

  const handleClearHistory = async () => {
    const ok = await clearAllWatchHistory();
    if (ok) {
      showToast('Histórico de reprodução zerado com sucesso!');
    } else {
      showToast('Erro ao limpar histórico.');
    }
  };

  const activeCat = SETTINGS_CATEGORIES[selectedCategory] || SETTINGS_CATEGORIES[0];

  return (
    <div className="tv-view-container tv-settings-view" style={{ paddingTop: '72px' }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="tv-toast-message"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: '90px',
              right: '54px',
              zIndex: 10000,
              background: '#22c55e',
              color: '#000',
              fontWeight: 700,
              padding: '12px 24px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span className="material-icons" style={{ fontSize: '20px' }}>check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho da Página */}
      <div className="tv-page-header" style={{ padding: '0 54px 20px 54px' }}>
        <div className="tv-page-header-row">
          <h1 className="tv-page-title">Configurações do Sistema</h1>
          <span
            className="tv-badge-pill"
            style={{
              background: serverStatus === 'online' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(66, 133, 244, 0.2)',
              color: serverStatus === 'online' ? '#4ade80' : '#8AB4F8',
              borderColor: serverStatus === 'online' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(66, 133, 244, 0.4)'
            }}
          >
            <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>
              {serverStatus === 'online' ? 'desktop_windows' : 'cloud'}
            </span>
            <span>{serverStatus === 'online' ? 'PC Conectado: Modo Total' : 'PC Desligado: Acesso via Nuvem'}</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
          Gerencie a conexão com seu computador, pastas locais, sincronização com o Google Drive e armazenamento.
        </p>
      </div>

      {/* Layout Split: Sidebar de Categorias (Esquerda) + Painel de Conteúdo (Direita) */}
      <div
        className="tv-settings-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '32px',
          padding: '0 54px 60px 54px',
          boxSizing: 'border-box'
        }}
      >
        {/* 1. Sidebar de Categorias */}
        <div
          className="tv-settings-sidebar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {SETTINGS_CATEGORIES.map((cat, idx) => {
            const isSelected = selectedCategory === idx;
            const isFocused = isViewFocused && focusedIndex === idx && actionIndex === 0;
            return (
              <button
                key={cat.id}
                ref={el => categoryRefs.current[idx] = el}
                type="button"
                className={`tv-settings-cat-btn ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={() => setSelectedCategory(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 20px',
                  borderRadius: '14px',
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isFocused
                    ? '2px solid #E50914'
                    : isSelected
                    ? '1px solid rgba(255, 255, 255, 0.2)'
                    : '1px solid transparent',
                  color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isFocused ? '0 0 20px rgba(229, 9, 20, 0.4)' : 'none',
                  transform: isFocused ? 'scale(1.02)' : 'none'
                }}
              >
                <span
                  className="material-icons"
                  style={{
                    fontSize: '24px',
                    color: isSelected ? (cat.id === 'drive' ? '#4285F4' : '#E50914') : 'var(--text-subtle)'
                  }}
                >
                  {cat.icon}
                </span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: isSelected ? 700 : 600 }}>{cat.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>{cat.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 2. Painel Principal de Configurações da Categoria */}
        <div
          className="tv-settings-content-panel"
          style={{
            background: 'rgba(20, 23, 34, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '32px',
            backdropFilter: 'blur(16px)',
            minHeight: '460px'
          }}
        >
          {/* Categoria 1: Servidor & Conexão */}
          {activeCat.id === 'server' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#E50914' }}>dns</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Servidor Local & Rede</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Comunicação entre a Smart TV e o serviço de streaming em execução no seu computador.
                  </p>
                </div>
              </div>

              {/* Status Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '20px',
                  borderRadius: '14px',
                  marginBottom: '20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>ESTADO DO PC</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: serverStatus === 'online' ? '#4ade80' : '#8AB4F8', marginTop: '4px' }}>
                    {serverStatus === 'online' ? 'Ligado & Online' : 'Desligado (Modo Nuvem)'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>PORTA PADRÃO</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
                    8085 (HTTP / Stream)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>TORRENTS ATIVOS</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
                    {detailedStatus?.activeTorrents || 0} transferências
                  </div>
                </div>
              </div>

              {/* Configuração de IP do Servidor */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
                  Endereço IP do Computador na Rede Local
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={serverIp}
                    onChange={e => setServerIp(e.target.value)}
                    placeholder="Ex: 192.168.15.5:8085 (ou deixe vazio para detecção automática)"
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="button"
                    className="tv-btn tv-btn-primary"
                    onClick={handleSaveIp}
                    style={{ padding: '12px 20px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    Salvar IP
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    style={{ padding: '12px 20px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {isTestingConnection ? 'Testando...' : 'Testar Conexão'}
                  </button>
                </div>
              </div>



              {/* Re-escanear Biblioteca */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Re-indexar Arquivos Locais</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Atualiza instantaneamente os filmes e séries salvos na pasta D:\Filmes do PC.
                  </div>
                </div>
                <button
                  type="button"
                  className="tv-btn tv-btn-secondary"
                  onClick={handleRescan}
                  disabled={isRescanning}
                  style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>sync</span>
                  <span>{isRescanning ? 'Escaneando...' : 'Re-escanear Agora'}</span>
                </button>
              </div>

              {/* Organizador Inteligente de Pastas e Nomes */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Organizador Inteligente de Pastas e Arquivos</span>
                    <span style={{ fontSize: '11px', background: '#3b82f6', color: '#FFF', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>Kodi / Plex</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Padroniza nomes para Nome (Ano), remove propagandas (.url, banners) e organiza arquivos soltos em D:\Filmes.
                  </div>
                </div>
                <button
                  type="button"
                  className="tv-btn tv-btn-secondary"
                  onClick={handleOrganizeLibrary}
                  disabled={isOrganizing}
                  style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>auto_fix_high</span>
                  <span>{isOrganizing ? 'Organizando...' : 'Organizar Agora'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Categoria 2: Google Drive */}
          {activeCat.id === 'drive' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#4285F4' }}>cloud</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Nuvem Google Drive (Cinelar)</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Assista aos seus filmes e séries salvos no Google Drive mesmo quando o computador estiver totalmente desligado.
                  </p>
                </div>
              </div>

              {/* Informações da Nuvem */}
              <div style={{ background: 'rgba(66, 133, 244, 0.08)', border: '1px solid rgba(66, 133, 244, 0.25)', padding: '20px', borderRadius: '14px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8AB4F8', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                  <span className="material-icons" style={{ fontSize: '18px' }}>folder_shared</span>
                  <span>Pasta Sincronizada: G:\Meu Drive\cinelar</span>
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', margin: 0, lineHeight: '1.5' }}>
                  Ao baixar conteúdos escolhendo o destino <strong>Google Drive</strong>, os vídeos são salvos na sua pasta sincronizada e ficam acessíveis na nuvem diretamente pelo aplicativo da TV.
                </p>
              </div>

              {/* Formulário de Configuração Direta (Sem Modal) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '24px', borderRadius: '14px', marginBottom: '24px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', marginBottom: '16px' }}>
                  Configurações de Conexão com a Nuvem
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8AB4F8', marginBottom: '8px' }}>
                    ID ou Link da Pasta do Google Drive (Cinelar):
                  </label>
                  <input
                    type="text"
                    value={folderIdInput}
                    onChange={e => setFolderIdInput(e.target.value)}
                    placeholder="Ex: 1A2b3C4d5E... ou link de compartilhamento"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                    A pasta deve estar compartilhada como &quot;Qualquer pessoa com o link&quot;.
                  </span>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8AB4F8', marginBottom: '8px' }}>
                    Chave de API do Google Cloud (Opcional):
                  </label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="Opcional: chave de API do Google Cloud Console"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '10px',
                      color: '#FFF',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '14px' }}>
                  <button
                    type="button"
                    className="tv-btn tv-btn-primary"
                    onClick={handleSaveDriveConfig}
                    style={{
                      background: '#4285F4',
                      borderColor: '#4285F4',
                      color: '#FFF',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>save</span>
                    <span>Salvar Configuração</span>
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={() => {
                      onRefreshLibrary();
                      showToast('Arquivos do Google Drive sincronizados!');
                    }}
                    style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>cloud_sync</span>
                    <span>Sincronizar Arquivos da Nuvem</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Categoria 3: Armazenamento */}
          {activeCat.id === 'storage' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#10B981' }}>storage</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Armazenamento & Discos</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Capacidade disponível no disco local do computador e na unidade do Google Drive.
                  </p>
                </div>
              </div>

              {/* Disco Local D:\Filmes */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ color: '#10B981', fontSize: '20px' }}>folder</span>
                    <strong style={{ fontSize: '15px', color: '#FFF' }}>Disco Local PC (D:\Filmes)</strong>
                  </div>
                  <span style={{ fontSize: '13px', color: '#34D399', fontWeight: 700 }}>
                    {storageData?.local?.freeGB ? `${storageData.local.freeGB} GB Livres` : (detailedStatus?.freeSpaceGB ? `${detailedStatus.freeSpaceGB} GB Livres` : 'Calculando...')}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: storageData?.local?.usedGB && storageData?.local?.totalGB
                        ? `${Math.min(100, Math.round((storageData.local.usedGB / storageData.local.totalGB) * 100))}%`
                        : '45%',
                      height: '100%',
                      background: '#10B981',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '8px' }}>
                  <span>{storageData?.local?.usedGB ? `${storageData.local.usedGB} GB Usados` : 'Pasta padrão de download local'}</span>
                  <span>{storageData?.local?.totalGB ? `Total: ${storageData.local.totalGB} GB` : ''}</span>
                </div>
              </div>

              {/* Nuvem Google Drive G:\ */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ color: '#4285F4', fontSize: '20px' }}>cloud</span>
                    <strong style={{ fontSize: '15px', color: '#FFF' }}>Google Drive (G:\Meu Drive\cinelar)</strong>
                  </div>
                  <span style={{ fontSize: '13px', color: '#8AB4F8', fontWeight: 700 }}>
                    {storageData?.drive?.freeGB ? `${storageData.drive.freeGB} GB Disponíveis` : 'Nuvem Conectada'}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: storageData?.drive?.usedGB && storageData?.drive?.totalGB
                        ? `${Math.min(100, Math.round((storageData.drive.usedGB / storageData.drive.totalGB) * 100))}%`
                        : '20%',
                      height: '100%',
                      background: '#4285F4',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-subtle)', marginTop: '8px' }}>
                  <span>{storageData?.drive?.usedGB ? `${storageData.drive.usedGB} GB Ocupados` : 'Armazenamento em Nuvem'}</span>
                  <span>{storageData?.drive?.totalGB ? `Total: ${storageData.drive.totalGB} GB` : 'Google Drive'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Categoria 4: Dados & Cache */}
          {activeCat.id === 'data' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#f59e0b' }}>cleaning_services</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Dados & Limpeza de Memória</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Libere a memória interna da Smart TV e gerencie seus dados de navegação.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Limpar Cache Offline */}
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Limpar Cache de Catálogo Offline</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Remove as listas salvas em cache local para forçar nova leitura rápida do servidor.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={handleClearCache}
                    style={{ padding: '12px 20px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    Limpar Cache
                  </button>
                </div>

                {/* Limpar Histórico de Reprodução */}
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Zerar Histórico "Continuar Assistindo"</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Remove o progresso salvo de reprodução de filmes e séries assistidos.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tv-btn tv-btn-warning"
                    onClick={handleClearHistory}
                    style={{ padding: '12px 20px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    Zerar Histórico
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Categoria 5: Sobre o Sistema */}
          {activeCat.id === 'about' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className="material-icons" style={{ fontSize: '32px', color: '#E50914' }}>info</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Sobre o Cine Lar TV</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Informações do aplicativo e atalhos do controle remoto.
                  </p>
                </div>
              </div>

              {/* Informações da Versão */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Versão do App: </span>
                    <strong style={{ color: '#FFFFFF' }}>Cinelar TV v2.0.0 (Native Tizen)</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Motor de Streaming: </span>
                    <strong style={{ color: '#4ade80' }}>WebTorrent Engine + Direct HTTP</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Plataforma: </span>
                    <strong style={{ color: '#FFFFFF' }}>Samsung Smart TV (Tizen 5.5+) / Chrome</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-subtle)' }}>Desenvolvedor: </span>
                    <strong style={{ color: '#FFFFFF' }}>Matheus Rafael</strong>
                  </div>
                </div>
              </div>

              {/* Atalhos do Controle Remoto */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '20px', borderRadius: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginBottom: '12px' }}>
                  Atalhos do Controle Remoto Samsung
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tv-badge-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>OK / Enter</span>
                    <span style={{ color: 'var(--text-muted)' }}>Reproduzir ou Selecionar</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tv-badge-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>Segurar OK</span>
                    <span style={{ color: 'var(--text-muted)' }}>Menu Rápido de Ações</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tv-badge-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>Voltar</span>
                    <span style={{ color: 'var(--text-muted)' }}>Fechar Modal / Voltar ao Topo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tv-badge-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>Play / Pause</span>
                    <span style={{ color: 'var(--text-muted)' }}>Pausar / Retomar Imediato</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
