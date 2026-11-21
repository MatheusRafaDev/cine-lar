import React, { useState, useEffect } from 'react';
import { getDriveConfig, setDriveConfig } from '../services/api';

export function DriveConfigModal({ isOpen, onClose, onSaved }) {
  const [folderId, setFolderId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getDriveConfig();
      setFolderId(cfg.folderId || '');
      setApiKey(cfg.apiKey || '');
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setDriveConfig({ folderId, apiKey });
    setSavedSuccess(true);
    setTimeout(() => {
      if (onSaved) onSaved();
      if (onClose) onClose();
    }, 600);
  };

  return (
    <div className="tv-quick-actions-backdrop" onClick={onClose} style={{ zIndex: 12000 }}>
      <div
        className="tv-quick-actions-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '90%', padding: '28px', borderRadius: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <span className="material-icons" style={{ fontSize: '36px', color: '#4285F4' }}>cloud</span>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Nuvem Google Drive (Cinelar)</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Assista aos vídeos da pasta D:\filmes\Cinelar na TV mesmo com o PC desligado
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#8AB4F8' }}>Como obter o link da pasta:</strong>
          <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>No computador, abra o <strong>Google Drive</strong> (drive.google.com).</li>
            <li>Em <em>Computadores</em>, clique com botão direito na pasta <strong>Cinelar</strong>.</li>
            <li>Selecione <em>Compartilhar</em> e altere para <strong>"Qualquer pessoa com o link"</strong>.</li>
            <li>Cole o link copiado ou o ID da pasta no campo abaixo:</li>
          </ol>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Link ou ID da Pasta do Google Drive
          </label>
          <input
            type="text"
            className="tv-search-input"
            value={folderId}
            onChange={e => setFolderId(e.target.value)}
            placeholder="Ex: 1a2B3c4D5e... ou link completo"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '14px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFF' }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Chave de API do Google (Opcional para velocidade máxima)
          </label>
          <input
            type="text"
            className="tv-search-input"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Opcional: chave API do Google Cloud"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '14px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFF' }}
          />
        </div>

        {savedSuccess && (
          <div style={{ color: '#34A853', fontSize: '14px', fontWeight: 600, marginBottom: '14px', textAlign: 'center' }}>
            Configuração salva com sucesso!
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="tv-local-toggle-btn"
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: '8px' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="tv-local-toggle-btn active focused"
            onClick={handleSave}
            style={{ background: '#4285F4', color: '#FFF', padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
          >
            Salvar e Conectar
          </button>
        </div>
      </div>
    </div>
  );
}
