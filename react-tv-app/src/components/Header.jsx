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

function HeaderComponent({ activeTab, onSelectTab, isZoneFocused, focusedIndex }) {
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
    </header>
  );
}

export const Header = memo(HeaderComponent);
