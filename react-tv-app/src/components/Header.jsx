import React, { memo } from 'react';
import { motion } from 'framer-motion';

export const ONLINE_NAV_ITEMS = [
  { id: 'home', label: 'Início' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'local', label: 'Local / Drive' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'search', label: 'Buscar' },
  { id: 'settings', label: 'Configurações' }
];

export const OFFLINE_NAV_ITEMS = [
  { id: 'local', label: 'Google Drive' },
  { id: 'settings', label: 'Configurações' }
];

export const NAV_ITEMS = ONLINE_NAV_ITEMS;

function HeaderComponent({
  activeTab,
  onSelectTab,
  isZoneFocused,
  focusedIndex,
  serverStatus = 'checking',
  activeDownloadsCount = 0,
  navItems = null
}) {
  const currentNavItems = navItems || (serverStatus === 'offline' ? OFFLINE_NAV_ITEMS : ONLINE_NAV_ITEMS);

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

  const handleLogoClick = () => {
    if (serverStatus === 'offline') {
      onSelectTab('local');
    } else {
      onSelectTab('home');
    }
  };

  return (
    <header className="tv-header">
      <div className="tv-logo-box" onClick={handleLogoClick}>
        <span className="tv-logo-text">CINELAR</span>
      </div>

      <nav className="tv-nav-items">
        {currentNavItems.map((item, idx) => {
          const isFocused = isZoneFocused && focusedIndex === idx;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`tv-nav-btn ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBadge"
                  className="tv-nav-active-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="tv-nav-btn-text">{item.label}</span>
              {item.id === 'downloads' && activeDownloadsCount > 0 && (
                <span className="tv-nav-download-badge">
                  <span className="tv-nav-download-dot" />
                  <span>{activeDownloadsCount}</span>
                </span>
              )}
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
