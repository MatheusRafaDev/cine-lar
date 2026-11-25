import React from 'react';

export function ServerStatusPanel({
  status = 'offline',
  title = 'Servidor indisponível',
  message = 'Verifique se o serviço Cinelar está ligado e se o dispositivo está na mesma rede.',
  onRetry,
  isFocused = false
}) {
  const isChecking = status === 'checking';

  return (
    <section
      className="tv-home-feedback offline tv-server-state-panel"
      role={isChecking ? 'status' : 'alert'}
      aria-live="polite"
    >
      <span className={`material-icons ${isChecking ? 'tv-server-state-icon-checking' : ''}`} aria-hidden="true">
        {isChecking ? 'sync' : 'wifi_off'}
      </span>
      <strong>{isChecking ? 'Verificando o servidor' : title}</strong>
      <span>{isChecking ? 'Tentando restabelecer a conexão com o computador…' : message}</span>
      <button
        type="button"
        className={`tv-btn tv-btn-secondary tv-server-state-button ${isFocused ? 'focused' : ''}`}
        onClick={onRetry}
        disabled={isChecking}
      >
        {isChecking ? 'Verificando…' : 'Tentar novamente'}
      </button>
    </section>
  );
}

export function EmptyCatalogPanel({ title = 'Nenhum título encontrado', message }) {
  return (
    <section className="tv-home-feedback" role="status" aria-live="polite">
      <span className="material-icons" aria-hidden="true">movie</span>
      <strong>{title}</strong>
      <span>{message || 'O catálogo está conectado, mas ainda não há títulos para exibir.'}</span>
    </section>
  );
}
