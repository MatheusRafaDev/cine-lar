import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header, NAV_ITEMS } from './components/Header';
import { MovieDetailsModal } from './components/MovieDetailsModal';
import { CinemaPlayer } from './components/CinemaPlayer';
import { HomeView } from './views/HomeView';
import { MoviesView } from './views/MoviesView';
import { SeriesView } from './views/SeriesView';
import { FavoritesView } from './views/FavoritesView';
import { LocalFolderView } from './views/LocalFolderView';
import { DownloadsView } from './views/DownloadsView';
import { SearchView } from './views/SearchView';
import {
  getTrendingMovies,
  getMovies,
  getSeries,
  getGenres,
  getLocalMovies,
  getLocalLibraryData,
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
  const [seriesGenreSections, setSeriesGenreSections] = useState([]);
  const [localMovies, setLocalMovies] = useState([]);
  const [localLibrary, setLocalLibrary] = useState({
    movies: [],
    franchises: [],
    standaloneMovies: [],
    series: [],
    count: 0,
    totalSize: '',
    savePath: 'D:\\Filmes'
  });
  const [localFilterId, setLocalFilterId] = useState('all');
  const [downloads, setDownloads] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeStream, setActiveStream] = useState(null);

  const playerControlsRef = useRef({});
  const searchInputRef = useRef({ handleKeyPress: null });
  const modalActionRef = useRef({});

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

    // Biblioteca e Filmes Locais (com franquias estruturadas)
    getLocalLibraryData().then(data => {
      setLocalLibrary(data);
      setLocalMovies(data.movies || []);
    });

    // Downloads
    getDownloads().then(d => {
      setDownloads(d);
    });

    // Gêneros de filmes e séries
    getGenres().then(async genres => {
      const topGenres = genres.filter(g => g.id !== 'all').slice(0, 8);

      // Carrega seções de filmes por gênero
      const mSections = [];
      for (const g of topGenres) {
        try {
          const list = await getMovies({ genre: g.id, limit: 15 });
          if (list.length > 0) {
            mSections.push({
              id: g.id,
              title: g.name,
              movies: list
            });
          }
        } catch (_) {}
      }
      setGenreSections(mSections);

      // Carrega seções de séries por gênero
      const sSections = [];
      for (const g of topGenres) {
        try {
          const sList = await getSeries({ genre: g.id, limit: 15 });
          if (sList.length > 0) {
            sSections.push({
              id: `series-${g.id}`,
              title: `Séries de ${g.name}`,
              movies: sList
            });
          }
        } catch (_) {}
      }
      setSeriesGenreSections(sSections);
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

    if (seriesGenreSections.length > 0 && seriesGenreSections[0].movies.length > 0) {
      list.push({
        id: 'series-popular',
        title: 'Séries em Destaque',
        movies: seriesGenreSections[0].movies
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
  }, [watchHistory, favorites, trendingMovies, seriesGenreSections, localMovies, genreSections]);

  // Filtros disponíveis na visualização local
  const localFilters = useMemo(() => {
    const list = [
      { id: 'all', label: `Todos os Filmes (${localLibrary.count || (localLibrary.movies ? localLibrary.movies.length : 32)})`, icon: 'video_library' },
      { id: 'collections', label: `Coleções Agrupadas (${localLibrary.franchises ? localLibrary.franchises.length : 10})`, icon: 'collections_bookmark' }
    ];

    if (localLibrary.franchises && localLibrary.franchises.length > 0) {
      localLibrary.franchises.forEach(f => {
        list.push({
          id: `franchise:${f.name}`,
          label: `${f.name} (${f.movies ? f.movies.length : (f.count || 1)})`,
          icon: 'folder_special'
        });
      });
    }

    if (localLibrary.standaloneMovies && localLibrary.standaloneMovies.length > 0) {
      list.push({
        id: 'standalone',
        label: `Filmes Avulsos (${localLibrary.standaloneMovies.length})`,
        icon: 'movie'
      });
    }

    return list;
  }, [localLibrary]);

  // Seções e linhas em grid full-page (6 colunas) para a visualização Local
  const localGridRows = useMemo(() => {
    const COL_COUNT = 6;
    if (!localLibrary || !localLibrary.movies) return [];

    // 1. Modo Coleções Agrupadas
    if (localFilterId === 'collections') {
      const rows = [];
      (localLibrary.franchises || []).forEach(f => {
        const fMovies = f.movies || [];
        for (let i = 0; i < fMovies.length; i += COL_COUNT) {
          rows.push({
            id: `franchise-${f.name}-${i}`,
            title: i === 0 ? `Coleção ${f.name}` : '',
            subtitle: i === 0 ? `${fMovies.length} ${fMovies.length === 1 ? 'filme salvo' : 'filmes salvos em ordem cronológica'}` : '',
            icon: 'collections_bookmark',
            movies: fMovies.slice(i, i + COL_COUNT)
          });
        }
      });

      if (localLibrary.standaloneMovies && localLibrary.standaloneMovies.length > 0) {
        const stMovies = localLibrary.standaloneMovies;
        for (let i = 0; i < stMovies.length; i += COL_COUNT) {
          rows.push({
            id: `standalone-${i}`,
            title: i === 0 ? 'Filmes Avulsos' : '',
            subtitle: i === 0 ? `${stMovies.length} filmes individuais salvos no disco` : '',
            icon: 'movie',
            movies: stMovies.slice(i, i + COL_COUNT)
          });
        }
      }
      return rows;
    }

    // 2. Modo Franquia Específica (ex: 'franchise:Shrek')
    if (localFilterId.startsWith('franchise:')) {
      const fName = localFilterId.replace('franchise:', '');
      const f = (localLibrary.franchises || []).find(x => x.name === fName);
      const fMovies = f ? f.movies : [];
      const rows = [];
      for (let i = 0; i < fMovies.length; i += COL_COUNT) {
        rows.push({
          id: `franchise-single-${i}`,
          title: i === 0 ? `Coleção ${fName}` : '',
          subtitle: i === 0 ? `${fMovies.length} ${fMovies.length === 1 ? 'filme salvo' : 'filmes salvos em ordem cronológica'}` : '',
          icon: 'collections_bookmark',
          movies: fMovies.slice(i, i + COL_COUNT)
        });
      }
      return rows;
    }

    // 3. Modo Filmes Avulsos
    if (localFilterId === 'standalone') {
      const stMovies = localLibrary.standaloneMovies || [];
      const rows = [];
      for (let i = 0; i < stMovies.length; i += COL_COUNT) {
        rows.push({
          id: `standalone-single-${i}`,
          title: i === 0 ? 'Filmes Avulsos (Sem Franquia)' : '',
          subtitle: i === 0 ? `${stMovies.length} títulos individuais` : '',
          icon: 'movie',
          movies: stMovies.slice(i, i + COL_COUNT)
        });
      }
      return rows;
    }

    // 4. Modo Padrão: 'all' (Página inteira contínua com todos os filmes salvos)
    const allMovies = localLibrary.movies || [];
    const rows = [];
    for (let i = 0; i < allMovies.length; i += COL_COUNT) {
      rows.push({
        id: `all-grid-${i}`,
        title: '',
        subtitle: '',
        movies: allMovies.slice(i, i + COL_COUNT)
      });
    }
    return rows;
  }, [localLibrary, localFilterId]);

  // Seções e linhas em grade full-page (6 colunas) para a visualização de Favoritos
  const favoritesGridRows = useMemo(() => {
    const COL_COUNT = 6;
    if (!favorites || favorites.length === 0) return [];
    const rows = [];
    for (let i = 0; i < favorites.length; i += COL_COUNT) {
      rows.push({
        id: `fav-grid-${i}`,
        title: '',
        movies: favorites.slice(i, i + COL_COUNT)
      });
    }
    return rows;
  }, [favorites]);

  // Filme em destaque (Hero)
  const heroMovie = useMemo(() => {
    return trendingMovies.length > 0 ? trendingMovies[0] : (localMovies[0] || null);
  }, [trendingMovies, localMovies]);

  // 3. Cálculo dinâmico do número de linhas e colunas para a navegação espacial
  const currentSections = useMemo(() => {
    if (activeTab === 'home') return homeSections;
    if (activeTab === 'movies') return genreSections;
    if (activeTab === 'series') return seriesGenreSections;
    if (activeTab === 'favorites') return favoritesGridRows;
    if (activeTab === 'local') return localGridRows;
    return [];
  }, [activeTab, homeSections, genreSections, seriesGenreSections, favoritesGridRows, localGridRows]);

  const rowCount = useMemo(() => {
    if (activeTab === 'downloads') return Math.max(1, downloads.length);
    if (activeTab === 'search') return 1;
    if (activeTab === 'favorites') return Math.max(1, favoritesGridRows.length);
    if (activeTab === 'local') return Math.max(1, localGridRows.length);
    return Math.max(1, currentSections.length);
  }, [activeTab, downloads.length, favoritesGridRows.length, localGridRows.length, currentSections.length]);

  const getColCount = useCallback((rIdx) => {
    if (activeTab === 'favorites') {
      return favoritesGridRows[rIdx]?.movies?.length || 1;
    }
    if (activeTab === 'local') {
      return localGridRows[rIdx]?.movies?.length || 1;
    }
    if (currentSections[rIdx] && currentSections[rIdx].movies) {
      return currentSections[rIdx].movies.length;
    }
    return 1;
  }, [activeTab, favoritesGridRows, localGridRows, currentSections]);

  // Iniciar reprodução de filme ou abrir modal de série
  const handlePlayMovieDirect = useCallback(async (movie) => {
    if (!movie) return;

    // Séries abrem modal com seleção de temporada/episódio
    if (movie.isSeries || movie.type === 'series') {
      setSelectedMovie(movie);
      return;
    }

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

  const modalItemsCount = useMemo(() => {
    if (!selectedMovie) return 3;
    const streamsCount = selectedMovie.streams ? selectedMovie.streams.length : 5;
    return 3 + streamsCount;
  }, [selectedMovie]);

  // 4. Integração do Hook Espacial Ultra-Rápido
  const nav = useSpatialNav({
    isPlayerOpen: Boolean(activeStream),
    isModalOpen: Boolean(selectedMovie),
    activeTab,
    hasHero: activeTab === 'home' && Boolean(heroMovie),
    rowCount,
    getColCount,
    headerCount: NAV_ITEMS.length,
    localFilterCount: localFilters.length,
    modalItemsCount,
    onTabChange: (newHeaderIdx) => {
      const item = NAV_ITEMS[newHeaderIdx];
      if (item && item.id !== activeTab) {
        setActiveTab(item.id);
      }
    },
    onBack: () => {
      // Hierarquia estrita do botão Voltar (Tizen / Esc)
      if (activeStream) {
        setActiveStream(null);
        refreshUserData();
        return;
      }
      if (selectedMovie) {
        setSelectedMovie(null);
        refreshUserData();
        return;
      }
      if (nav.activeZone !== 'header') {
        nav.setActiveZone('header');
        return;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        nav.setHeaderIndex(0);
        return;
      }
      // Se já está no header da página inicial, sai do aplicativo Tizen
      if (typeof window !== 'undefined' && window.tizen && window.tizen.application) {
        try {
          window.tizen.application.getCurrentApplication().exit();
        } catch (_) {}
      }
    },
    onEnter: ({ zone, index, headerIndex, heroIndex, rowIndex, colIndex, filterIndex, searchRowIndex, searchColIndex, resultsColIndex, isPlayKey }) => {
      if (zone === 'modal') {
        if (modalActionRef.current && modalActionRef.current.triggerAction) {
          modalActionRef.current.triggerAction(index);
        }
        return;
      }

      if (zone === 'header') {
        // Confirma tab e desce para o conteúdo
        if (activeTab === 'home' && heroMovie) {
          nav.setActiveZone('hero');
        } else if (activeTab === 'local') {
          nav.setActiveZone('local-filters');
        } else if (activeTab === 'search') {
          nav.setActiveZone('search-keyboard');
        } else {
          nav.setActiveZone('rows');
          nav.setRowIndex(0);
          nav.setColIndex(0);
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

      if (zone === 'local-filters') {
        const targetFilter = localFilters[filterIndex];
        if (targetFilter) {
          setLocalFilterId(targetFilter.id);
          nav.setRowIndex(0);
          nav.setColIndex(0);
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

        if (activeTab === 'favorites') {
          const row = favoritesGridRows[rowIndex];
          if (row && row.movies && row.movies[colIndex]) {
            const mov = row.movies[colIndex];
            if (isPlayKey) {
              handlePlayMovieDirect(mov);
            } else {
              setSelectedMovie(mov);
            }
          }
          return;
        }

        if (activeTab === 'local') {
          const row = localGridRows[rowIndex];
          if (row && row.movies && row.movies[colIndex]) {
            handlePlayMovieDirect(row.movies[colIndex]);
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
        if (searchInputRef.current && searchInputRef.current.pressKey) {
          searchInputRef.current.pressKey(searchRowIndex, searchColIndex);
        }
        return;
      }

      if (zone === 'search-results') {
        if (searchInputRef.current && searchInputRef.current.selectResult) {
          searchInputRef.current.selectResult(resultsColIndex);
        }
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

        {activeTab === 'series' && (
          <SeriesView
            genreSections={seriesGenreSections}
            activeZone={nav.activeZone}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectSeries={setSelectedMovie}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            gridRows={favoritesGridRows}
            activeZone={nav.activeZone}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectMovie={setSelectedMovie}
          />
        )}

        {activeTab === 'local' && (
          <LocalFolderView
            localLibrary={localLibrary}
            filters={localFilters}
            activeFilter={localFilterId}
            onSelectFilter={(fid, idx) => {
              setLocalFilterId(fid);
              nav.setLocalFilterIndex(idx);
              nav.setRowIndex(0);
              nav.setColIndex(0);
            }}
            gridRows={localGridRows}
            activeZone={nav.activeZone}
            localFilterIndex={nav.localFilterIndex}
            rowIndex={nav.rowIndex}
            colIndex={nav.colIndex}
            onSelectMovie={handlePlayMovieDirect}
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
            searchActionRef={searchInputRef}
          />
        )}
      </main>

      {/* Modal de Detalhes do Filme ou Série */}
      {selectedMovie && (
        <MovieDetailsModal
          movie={selectedMovie}
          isZoneFocused={nav.activeZone === 'modal'}
          focusedIndex={nav.modalIndex}
          modalActionRef={modalActionRef}
          onClose={() => {
            setSelectedMovie(null);
            refreshUserData();
          }}
          onPlayStream={(streamData) => {
            setSelectedMovie(null);
            setActiveStream(streamData);
            refreshUserData();
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
