import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header, NAV_ITEMS } from './components/Header';
import { MovieDetailsModal } from './components/MovieDetailsModal';
import { CinemaPlayer } from './components/CinemaPlayer';
import { HomeView } from './views/HomeView';
import { MoviesView } from './views/MoviesView';
import { LocalFolderView } from './views/LocalFolderView';
import { DownloadsView } from './views/DownloadsView';
import { SearchView } from './views/SearchView';
import {
  getTrendingMovies,
  getMovies,
  getGenres,
  getLocalMovies,
  getDownloads,
  getWatchHistory,
  getFavorites,
  getMovieDetails,
  deleteDownload
} from './services/api';
import { useSpatialNav } from './hooks/useSpatialNav';

export function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [genreSections, setGenreSections] = useState([]);
  const [localMovies, setLocalMovies] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeStream, setActiveStream] = useState(null);

  const playerControlsRef = useRef({});
  const searchInputRef = useRef({ handleKeyPress: null });

  // 1. Carrega dados iniciais do backend
  const refreshUserData = useCallback(() => {
    setWatchHistory(getWatchHistory());
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    refreshUserData();

    // Trending & Destaque
    getTrendingMovies().then(movies => {
      setTrendingMovies(movies);
    });

    // Filmes Locais
    getLocalMovies().then(movies => {
      setLocalMovies(movies);
    });

    // Downloads
    getDownloads().then(d => {
      setDownloads(d);
    });

    // Gêneros e catálogo por gênero
    getGenres().then(async genres => {
      const topGenres = genres.filter(g => g.id !== 'all').slice(0, 8);
      const sections = [];
      for (const g of topGenres) {
        try {
          const list = await getMovies({ genre: g.id, limit: 15 });
          if (list.length > 0) {
            sections.push({
              id: g.id,
              title: g.name,
              movies: list
            });
          }
        } catch (_) {}
      }
      setGenreSections(sections);
    });
  }, [refreshUserData]);

  // Polling leve para downloads ativos
  useEffect(() => {
    if (activeTab !== 'downloads') return;
    const interval = setInterval(async () => {
      const d = await getDownloads();
      setDownloads(d);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // 2. Seções da Home
  const homeSections = useMemo(() => {
    const list = [];

    if (watchHistory.length > 0) {
      list.push({
        id: 'continue-watching',
        title: 'Continuar Assistindo',
        movies: watchHistory
      });
    }

    if (favorites.length > 0) {
      list.push({
        id: 'my-list',
        title: 'Minha Lista',
        movies: favorites
      });
    }

    if (trendingMovies.length > 0) {
      list.push({
        id: 'trending',
        title: 'Filmes em Alta',
        movies: trendingMovies
      });
    }

    if (localMovies.length > 0) {
      list.push({
        id: 'local-quick',
        title: 'Disponíveis no Disco Local (D:\\Filmes)',
        movies: localMovies.slice(0, 15)
      });
    }

    genreSections.slice(0, 4).forEach(s => list.push(s));

    return list;
  }, [watchHistory, favorites, trendingMovies, localMovies, genreSections]);

  // Seções da visualização Local
  const localSections = useMemo(() => {
    if (localMovies.length === 0) return [];
    return [
      {
        id: 'all-local',
        title: 'Todos os Filmes Prontos no Disco',
        movies: localMovies
      }
    ];
  }, [localMovies]);

  // Filme em destaque (Hero)
  const heroMovie = useMemo(() => {
    return trendingMovies.length > 0 ? trendingMovies[0] : (localMovies[0] || null);
  }, [trendingMovies, localMovies]);

  // 3. Cálculo dinâmico do número de linhas e colunas para a navegação espacial
  const currentSections = useMemo(() => {
    if (activeTab === 'home') return homeSections;
    if (activeTab === 'movies') return genreSections;
    if (activeTab === 'local') return localSections;
    return [];
  }, [activeTab, homeSections, genreSections, localSections]);

  const rowCount = useMemo(() => {
    if (activeTab === 'downloads') return Math.max(1, downloads.length);
    if (activeTab === 'search') return 1;
    return Math.max(1, currentSections.length);
  }, [activeTab, downloads.length, currentSections.length]);

  const getColCount = useCallback((rIdx) => {
    if (currentSections[rIdx] && currentSections[rIdx].movies) {
      return currentSections[rIdx].movies.length;
    }
    return 1;
  }, [currentSections]);

  // Iniciar reprodução de filme
  const handlePlayMovieDirect = useCallback(async (movie) => {
    if (!movie) return;
    if (movie.isLocal && movie.streamUrl) {
      setActiveStream({
        streamUrl: movie.streamUrl,
        title: movie.title,
        poster: movie.poster,
        isLocal: true,
        resumePosition: movie.position || 0
      });
      return;
    }

    // Busca detalhes e melhor torrent
    const full = await getMovieDetails(movie);
    if (full && full.streams && full.streams.length > 0) {
      const best = full.streams[0];
      setActiveStream({
        streamUrl: best.streamUrl,
        title: full.title,
        poster: full.poster,
        infoHash: best.infoHash,
        quality: best.quality,
        isLocal: false,
        resumePosition: movie.position || 0
      });
    } else {
      setSelectedMovie(full || movie);
    }
  }, []);

  // 4. Integração do Hook Espacial
  const nav = useSpatialNav({
    isPlayerOpen: Boolean(activeStream),
    isModalOpen: Boolean(selectedMovie),
    activeTab,
    hasHero: activeTab === 'home' && Boolean(heroMovie),
    rowCount,
    getColCount,
    modalItemsCount: 5,
    onBack: () => {
      // Hierarquia estrita do botão Voltar (Tizen / Esc)
      if (activeStream) {
        setActiveStream(null);
        refreshUserData();
        return;
      }
      if (selectedMovie) {
        setSelectedMovie(null);
        return;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }
      if (nav.activeZone !== 'header') {
        nav.setActiveZone('header');
        return;
      }
      // Se já está no header da página inicial, sai do aplicativo Tizen
      if (typeof window !== 'undefined' && window.tizen && window.tizen.application) {
        try {
          window.tizen.application.getCurrentApplication().exit();
        } catch (_) {}
      }
    },
    onEnter: ({ zone, headerIndex, heroIndex, rowIndex, colIndex, searchRowIndex, searchColIndex, resultsColIndex, isPlayKey }) => {
      if (zone === 'header') {
        const item = NAV_ITEMS[headerIndex];
        if (item) {
          setActiveTab(item.id);
        }
        return;
      }

      if (zone === 'hero') {
        if (heroIndex === 0 || isPlayKey) {
          handlePlayMovieDirect(heroMovie);
        } else {
          setSelectedMovie(heroMovie);
        }
        return;
      }

      if (zone === 'rows') {
        if (activeTab === 'downloads') {
          const dl = downloads[rowIndex];
          if (dl) {
            handlePlayMovieDirect(dl);
          }
          return;
        }

        const sec = currentSections[rowIndex];
        if (sec && sec.movies && sec.movies[colIndex]) {
          const mov = sec.movies[colIndex];
          if (isPlayKey) {
            handlePlayMovieDirect(mov);
          } else {
            setSelectedMovie(mov);
          }
        }
        return;
      }

      if (zone === 'search-keyboard') {
        if (searchInputRef.current && searchInputRef.current.handleKeyPress) {
          searchInputRef.current.handleKeyPress(searchRowIndex, searchColIndex);
        }
        return;
      }

      if (zone === 'search-results') {
        // Seleciona filme no resultado de busca
        return;
      }
    },
    onPlayPause: () => playerControlsRef.current.onPlayPause?.(),
    onSeek: (delta) => playerControlsRef.current.onSeek?.(delta),
    onVolume: (delta) => playerControlsRef.current.onVolume?.(delta)
  });

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const idx = NAV_ITEMS.findIndex(i => i.id === tabId);
    if (idx !== -1) nav.setHeaderIndex(idx);
  };

  return (
    <div className="tv-app-root">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isZoneFocused={nav.activeZone === 'header'}
        focusedIndex={nav.headerIndex}
      />

      <main className="tv-main-content">
        {activeTab === 'home' && (
          <HomeView
            heroMovie={heroMovie}
            sections={homeSections}
            activeZone={nav.activeZone}
            heroIndex={nav.heroIndex}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectMovie={setSelectedMovie}
            onPlayHero={() => handlePlayMovieDirect(heroMovie)}
            onInfoHero={() => setSelectedMovie(heroMovie)}
          />
        )}

        {activeTab === 'movies' && (
          <MoviesView
            genreSections={genreSections}
            activeZone={nav.activeZone}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectMovie={setSelectedMovie}
          />
        )}

        {activeTab === 'local' && (
          <LocalFolderView
            localSections={localSections}
            activeZone={nav.activeZone}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectMovie={setSelectedMovie}
          />
        )}

        {activeTab === 'downloads' && (
          <DownloadsView
            downloads={downloads}
            activeZone={nav.activeZone}
            focusedIndex={nav.rowIndex}
            onPlayDownload={handlePlayMovieDirect}
            onCancelDownload={async (item) => {
              if (item.infoHash) {
                await deleteDownload(item.infoHash, true);
                const d = await getDownloads();
                setDownloads(d);
              }
            }}
          />
        )}

        {activeTab === 'search' && (
          <SearchView
            activeZone={nav.activeZone}
            searchRowIndex={nav.searchRowIndex}
            searchColIndex={nav.searchColIndex}
            resultsColIndex={nav.resultsColIndex}
            onSelectMovie={setSelectedMovie}
          />
        )}
      </main>

      {/* Modal de Detalhes do Filme */}
      {selectedMovie && (
        <MovieDetailsModal
          movie={selectedMovie}
          isZoneFocused={nav.activeZone === 'modal'}
          focusedIndex={nav.modalIndex}
          onClose={() => setSelectedMovie(null)}
          onPlayStream={(streamData) => {
            setSelectedMovie(null);
            setActiveStream(streamData);
          }}
        />
      )}

      {/* Player de Cinema Fullscreen com Limpeza Total de Mídia */}
      {activeStream && (
        <CinemaPlayer
          streamConfig={activeStream}
          onClose={() => {
            setActiveStream(null);
            refreshUserData();
          }}
          spatialNavControls={playerControlsRef.current}
        />
      )}
    </div>
  );
}
export default App;
