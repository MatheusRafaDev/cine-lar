import React, { memo } from 'react';

export const NAV_ITEMS = [
  { id: 'home', label: 'Início' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'local', label: 'Pasta Local' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'search', label: 'Buscar' }
];

function HeaderComponent({ activeTab, onSelectTab, isZoneFocused, focusedIndex, serverStatus = 'checking' }) {
  const [clockTime, setClockTime] = React.useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setClockTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const statusLabel = serverStatus === 'online'
    ? 'PC Ligado: Acesso via Drive + Torrent Streaming + Pasta Local'
    : serverStatus === 'offline'
    ? 'PC Desligado: Acesso direto via Google Drive (Nuvem)'
    : 'Verificando conexão com o servidor local...';
  return (
    <header className="tv-header">
      <div className="tv-logo-box" onClick={() => onSelectTab('home')}>
        <span className="tv-logo-text">CINELAR</span>
      </div>

      <nav className="tv-nav-items">
        {NAV_ITEMS.map((item, idx) => {
          const isFocused = isZoneFocused && focusedIndex === idx;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`tv-nav-btn ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="tv-header-right">
        <div className={`tv-server-status ${serverStatus}`} title={statusLabel} aria-label={statusLabel}>
          {serverStatus === 'offline' ? (
            <span className="material-icons" style={{ fontSize: '13px', color: '#4285F4', marginRight: '3px' }}>cloud</span>
          ) : (
            <span className="tv-server-status-dot" />
          )}
          <span>{serverStatus === 'online' ? 'PC Ligado' : serverStatus === 'offline' ? 'Modo Drive' : 'Conectando'}</span>
        </div>
        <span className="tv-header-clock">{clockTime}</span>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
