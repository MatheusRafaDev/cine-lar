import React, { Suspense, lazy, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, NAV_ITEMS } from './components/Header';
const MovieDetailsModal = lazy(() => import('./components/MovieDetailsModal').then(m => ({ default: m.MovieDetailsModal })));
const CinemaPlayer = lazy(() => import('./components/CinemaPlayer').then(m => ({ default: m.CinemaPlayer })));
const HomeView = lazy(() => import('./views/HomeView').then(m => ({ default: m.HomeView })));
const MoviesView = lazy(() => import('./views/MoviesView').then(m => ({ default: m.MoviesView })));
const SeriesView = lazy(() => import('./views/SeriesView').then(m => ({ default: m.SeriesView })));
const FavoritesView = lazy(() => import('./views/FavoritesView').then(m => ({ default: m.FavoritesView })));
const LocalFolderView = lazy(() => import('./views/LocalFolderView').then(m => ({ default: m.LocalFolderView })));
const DownloadsView = lazy(() => import('./views/DownloadsView').then(m => ({ default: m.DownloadsView })));
const SearchView = lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const QuickActionsModal = lazy(() => import('./components/QuickActionsModal').then(m => ({ default: m.QuickActionsModal })));
const DriveConfigModal = lazy(() => import('./components/DriveConfigModal').then(m => ({ default: m.DriveConfigModal })));
import {
  getTrendingMovies,
  getMovies,
  getSeries,
  getGenres,
  getLocalMovies,
  getLocalLibraryData,
  getDriveMovies,
  getDownloads,
  getDownloadsData,
  startDownload,
  pauseDownload,
  resumeDownload,
  getWatchHistory,
  syncWatchHistoryWithServer,
  getSavedProgress,
  getFavorites,
  syncFavoritesWithServer,
  getMovieDetails,
  deleteDownload,
  toggleFavorite,
  isFavorite,
  clearWatchProgress,
  isInWatchHistory,
  deleteLocalFile,
  getServerStatus,
  prefetchCatalogs
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
  const [localFilterId, setLocalFilterId] = useState('local-only');
  const [driveMovies, setDriveMovies] = useState([]);
  const [isDriveConfigOpen, setIsDriveConfigOpen] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [downloadsStorage, setDownloadsStorage] = useState(null);
  const [downloadsStats, setDownloadsStats] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [quickMenuMovie, setQuickMenuMovie] = useState(null);
  const [quickMenuContext, setQuickMenuContext] = useState({ isInContinueWatching: false, isLocal: false });
  const [confirmDeleteMode, setConfirmDeleteMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const toastTimerRef = useRef(null);
  const downloadsRequestInFlightRef = useRef(false);
  const downloadsSnapshotRef = useRef('');

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const playerControlsRef = useRef({});
  const searchInputRef = useRef({ handleKeyPress: null });
  const modalActionRef = useRef({});
  const deletedDownloadIdsRef = useRef(new Set());
  const deletedLocalPathsRef = useRef(new Set());
  const lastBackPressRef = useRef(0);

  // 1. Carrega dados de usuário (sem disparar requisições pesadas de catálogo)
  const refreshUserData = useCallback(() => {
    setWatchHistory(getWatchHistory());
    setFavorites(getFavorites());
    syncWatchHistoryWithServer().then(hist => {
      if (Array.isArray(hist) && hist.length > 0) {
        setWatchHistory(hist);
      }
    }).catch(() => {});
  }, []);

  const refreshDriveLibrary = useCallback(() => {
    getDriveMovies().then(movies => {
      if (Array.isArray(movies)) {
        setDriveMovies(movies);
      }
    }).catch(() => {});
  }, []);

  const refreshLocalLibrary = useCallback(() => {
    getLocalLibraryData().then(data => {
      const isNotDeleted = (m) => {
        const mp = String(m?.filePath || m?.videoPath || '').toLowerCase().trim();
        return !mp || !deletedLocalPathsRef.current.has(mp);
      };
      const filteredMovies = (data.movies || []).filter(isNotDeleted);
      const filteredFranchises = (data.franchises || [])
        .map(f => ({ ...f, movies: (f.movies || []).filter(isNotDeleted) }))
        .filter(f => f.movies.length > 0);
      const filteredStandalone = (data.standaloneMovies || []).filter(isNotDeleted);
      const filteredSeries = (data.series || [])
        .map(s => ({ ...s, episodes: (s.episodes || []).filter(isNotDeleted) }))
        .filter(s => s.episodes.length > 0);
      setLocalLibrary({
        ...data,
        movies: filteredMovies,
        franchises: filteredFranchises,
        standaloneMovies: filteredStandalone,
        series: filteredSeries,
        count: filteredMovies.length
      });
      setLocalMovies(filteredMovies);
    }).catch(() => {});
    refreshDriveLibrary();
  }, [refreshDriveLibrary]);

  const [loadedAllMovies, setLoadedAllMovies] = useState(false);
  const [loadedAllSeries, setLoadedAllSeries] = useState(false);

  // Inicialização leve e ultrarrápida da Home (executa apenas uma vez no mount)
  useEffect(() => {
    refreshUserData();
    refreshLocalLibrary();
    getServerStatus().then(isOnline => setServerStatus(isOnline ? 'online' : 'offline'));
    syncFavoritesWithServer().then(favs => {
      if (favs && favs.length > 0) setFavorites(favs);
    });
    syncWatchHistoryWithServer().then(hist => {
      if (hist && hist.length > 0) setWatchHistory(hist);
    });

    // Trending & Destaque
    getTrendingMovies().then(movies => {
      setTrendingMovies(movies);
      setIsHomeLoading(false);
    });

    // Biblioteca e Filmes Locais (com franquias estruturadas)
    // Carrega os 4 gêneros essenciais de filmes e 1 de séries para a Home instantaneamente
    const catalogTimer = setTimeout(() => getGenres().then(async genres => {
      const topMovieGenres = genres.filter(g => g.id !== 'all').slice(0, 4);

      const mPromises = topMovieGenres.map(async g => {
        try {
          const list = await getMovies({ genre: g.id, limit: 12 });
          return list.length > 0 ? { id: g.id, title: g.name, movies: list } : null;
        } catch (_) {
          return null;
        }
      });

      const sPromise = getSeries({ limit: 12 }).then(list => {
        return list && list.length > 0 ? [{ id: 'series-popular', title: 'Séries em Destaque', movies: list }] : [];
      }).catch(() => []);

      const [mSections, sSections] = await Promise.all([
        Promise.all(mPromises),
        sPromise
      ]);

      setGenreSections(mSections.filter(Boolean));
      if (sSections && sSections.length > 0) {
        setSeriesGenreSections(sSections);
      }
    }), 20);

    // Pré-carregamento em background durante o tempo ocioso para troca de abas instantânea (0ms de espera)
    const prefetchTimer = setTimeout(() => {
      try {
        prefetchCatalogs();
      } catch (_) {}
    }, 1200);

    return () => {
      clearTimeout(catalogTimer);
      clearTimeout(prefetchTimer);
    };
  }, []);

  // Lazy loading sob demanda para a aba Filmes
  useEffect(() => {
    if (activeTab !== 'movies' || loadedAllMovies) return;

    getGenres().then(async genres => {
      const allGenres = genres.filter(g => g.id !== 'all').slice(0, 10);
      const mPromises = allGenres.map(async g => {
        try {
          const list = await getMovies({ genre: g.id, limit: 12 });
          return list.length > 0 ? { id: g.id, title: g.name, movies: list } : null;
        } catch (_) {
          return null;
        }
      });
      const mSections = (await Promise.all(mPromises)).filter(Boolean);
      if (mSections.length > 0) {
        setGenreSections(mSections);
      }
      setLoadedAllMovies(true);
    });
  }, [activeTab, loadedAllMovies]);

  // Lazy loading sob demanda para a aba Séries
  useEffect(() => {
    if (activeTab !== 'series' || loadedAllSeries) return;

    getGenres().then(async genres => {
      const allGenres = genres.filter(g => g.id !== 'all').slice(0, 8);
      const sPromises = allGenres.map(async g => {
        try {
          const sList = await getSeries({ genre: g.id, limit: 12 });
          return sList.length > 0 ? { id: `series-${g.id}`, title: `Séries de ${g.name}`, movies: sList } : null;
        } catch (_) {
          return null;
        }
      });
      const sSections = (await Promise.all(sPromises)).filter(Boolean);
      if (sSections.length > 0) {
        setSeriesGenreSections(sSections);
      }
      setLoadedAllSeries(true);
    });
  }, [activeTab, loadedAllSeries]);

  // Função centralizada para atualizar lista e métricas de downloads (ignorando itens recém-excluídos)
  const refreshDownloadsInfo = useCallback(async () => {
    if (downloadsRequestInFlightRef.current || document.hidden) return;
    downloadsRequestInFlightRef.current = true;
    try {
      const data = await getDownloadsData();
      const filtered = (data.downloads || []).filter(d => {
        const did = String(d.infoHash || d.id || '').toLowerCase();
        return !deletedDownloadIdsRef.current.has(did);
      });
      const snapshot = JSON.stringify({
        downloads: filtered.map(d => [
          d.infoHash || d.id,
          d.status,
          d.stage,
          d.progress,
          d.downloaded,
          d.downloadSpeed,
          d.numPeers,
          d.errorMessage
        ]),
        storage: data.storage,
        stats: data.stats
      });
      if (snapshot !== downloadsSnapshotRef.current) {
        downloadsSnapshotRef.current = snapshot;
        setDownloads(filtered);
        if (data.storage) setDownloadsStorage(data.storage);
        if (data.stats) setDownloadsStats(data.stats);
      }
    } catch (_) {
    } finally {
      downloadsRequestInFlightRef.current = false;
    }
  }, []);

  const activeDownloadsCount = useMemo(() => {
    return (downloads || []).filter(d => {
      const isDl = d.status === 'downloading' || d.stage === 'searching_peers' || d.stage === 'connecting' || d.stage === 'downloading';
      return isDl && !d.isPaused;
    }).length;
  }, [downloads]);

  // Atualiza automaticamente a biblioteca local ao abrir a aba Pasta Local
  useEffect(() => {
    if (activeTab === 'local') {
      refreshLocalLibrary();
    }
  }, [activeTab, refreshLocalLibrary]);

  // Polling para downloads ativos: a cada 2s na aba Downloads, a cada 5s nas demais abas
  useEffect(() => {
    refreshDownloadsInfo();
    const intervalMs = activeTab === 'downloads' ? 2000 : 5000;
    const interval = setInterval(refreshDownloadsInfo, intervalMs);
    return () => clearInterval(interval);
  }, [activeTab, refreshDownloadsInfo]);

  // Suporte Híbrido TV / Web: visibilidade inteligente do cursor do mouse
  useEffect(() => {
    let hideTimer = null;
    const handleMouseMove = () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(hideTimer);
    };
    const handleKeyDown = (e) => {
      // Teclas direcionais do controle remoto da TV ocultam o cursor para não atrapalhar a tela
      const tvKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
      if (tvKeys.includes(e.key) || (e.keyCode >= 37 && e.keyCode <= 40)) {
        document.body.classList.add('hide-cursor');
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(hideTimer);
    };
  }, []);

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
        movies: trendingMovies.slice(0, 18)
      });
    }

    if (seriesGenreSections.length > 0 && seriesGenreSections[0].movies.length > 0) {
      list.push({
        id: 'series-popular',
        title: 'Séries em Destaque',
        movies: seriesGenreSections[0].movies
      });
    }

    const isStrictDriveMovie = (m) => {
      if (!m) return false;
      const p = String(m.filePath || m.videoPath || '').toLowerCase();
      if (p.startsWith('d:\\') || p.startsWith('d:/') || p.startsWith('c:\\') || p.startsWith('c:/')) return false;
      if (m.storageLocation === 'local') return false;
      return Boolean(
        p.startsWith('g:\\') || 
        p.startsWith('g:/') || 
        p.includes('meu drive') || 
        (m.streamUrl && (m.streamUrl.includes('drive.google.com') || m.streamUrl.includes('drive.usercontent.google.com'))) || 
        String(m.id || '').startsWith('gdrive_') || 
        m.storageLocation === 'drive' ||
        (m.isCloud && !m.isLocal)
      );
    };

    const pcMovies = localMovies.filter(m => !isStrictDriveMovie(m));
    const cloudMovies = (driveMovies || []).filter(isStrictDriveMovie);

    if (pcMovies.length > 0) {
      list.push({
        id: 'local-quick',
        title: 'Disponíveis no Disco Local (D:\\Filmes)',
        movies: pcMovies.slice(0, 18)
      });
    }

    if (cloudMovies.length > 0) {
      list.push({
        id: 'drive-quick',
        title: 'Nuvem Google Drive (G:\\Meu Drive\\cinelar)',
        movies: cloudMovies.slice(0, 18)
      });
    }

    genreSections.slice(0, 4).forEach(s => list.push(s));

    return list;
  }, [watchHistory, favorites, trendingMovies, seriesGenreSections, localMovies, driveMovies, genreSections]);

  // Filtros disponíveis na visualização local: Pasta Local (PC) | Nuvem (Google Drive) | Todos | Franquias
  const localFilters = useMemo(() => {
    return [
      { id: 'local-only', label: 'Pasta Local (PC)', icon: 'folder' },
      { id: 'gdrive', label: 'Nuvem (Google Drive)', icon: 'cloud' },
      { id: 'all', label: 'Todos os Arquivos', icon: 'auto_awesome_motion' },
      { id: 'collections', label: 'Franquias', icon: 'collections_bookmark' }
    ];
  }, []);

  // Seções e linhas em grid full-page (8 colunas) para a visualização Local
  const localGridRows = useMemo(() => {
    const COL_COUNT = 8;
    const isStrictDriveMovie = (m) => {
      if (!m) return false;
      const p = String(m.filePath || m.videoPath || '').toLowerCase();
      // Arquivos no disco D: ou C: são SEMPRE locais do computador
      if (p.startsWith('d:\\') || p.startsWith('d:/') || p.startsWith('c:\\') || p.startsWith('c:/')) return false;
      if (m.storageLocation === 'local') return false;
      return Boolean(
        p.startsWith('g:\\') || 
        p.startsWith('g:/') || 
        p.includes('meu drive') || 
        (m.streamUrl && (m.streamUrl.includes('drive.google.com') || m.streamUrl.includes('drive.usercontent.google.com'))) || 
        String(m.id || '').startsWith('gdrive_') || 
        m.storageLocation === 'drive' ||
        (m.isCloud && !m.isLocal)
      );
    };

    // 1. Apenas Pasta Local do PC (D:\Filmes, excluindo qualquer pasta da nuvem)
    if (localFilterId === 'local-only') {
      const all = localLibrary?.movies || [];
      const pcOnly = all.filter(m => !isStrictDriveMovie(m));
      const rows = [];
      for (let i = 0; i < pcOnly.length; i += COL_COUNT) {
        rows.push({
          id: `local-only-grid-${i}`,
          title: i === 0 ? 'Filmes na Pasta Local do PC (D:\\Filmes)' : '',
          subtitle: i === 0 ? `${pcOnly.length} ${pcOnly.length === 1 ? 'filme salvo' : 'filmes salvos'} no computador` : '',
          icon: 'folder',
          movies: pcOnly.slice(i, i + COL_COUNT)
        });
      }
      return rows;
    }

    // 2. Modo Nuvem / Google Drive (G:\Meu Drive\cinelar) - NUNCA exibe arquivos do disco D:
    if (localFilterId === 'gdrive') {
      const gMovies = (driveMovies || []).filter(isStrictDriveMovie);
      const rows = [];
      for (let i = 0; i < gMovies.length; i += COL_COUNT) {
        rows.push({
          id: `gdrive-grid-${i}`,
          title: i === 0 ? 'Filmes na Nuvem (Google Drive)' : '',
          subtitle: i === 0 ? `${gMovies.length} ${gMovies.length === 1 ? 'filme disponível' : 'filmes disponíveis'} sincronizados com Google Drive (G:\\Meu Drive\\cinelar)` : '',
          icon: 'cloud',
          movies: gMovies.slice(i, i + COL_COUNT)
        });
      }
      return rows;
    }

    // 3. Modo Franquias (Coleções Agrupadas)
    if (localFilterId === 'collections') {
      const rows = [];
      (localLibrary?.franchises || []).forEach(f => {
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

      if (localLibrary?.standaloneMovies && localLibrary.standaloneMovies.length > 0) {
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

    // 4. Modo Padrão: 'all' (Todos os Arquivos - Local PC + Google Drive)
    const allMovies = localLibrary?.movies || [];
    const rows = [];
    for (let i = 0; i < allMovies.length; i += COL_COUNT) {
      rows.push({
        id: `all-grid-${i}`,
        title: i === 0 ? 'Todos os Arquivos (Pasta Local + Google Drive)' : '',
        subtitle: i === 0 ? `${allMovies.length} filmes no total salvos no PC e sincronizados` : '',
        icon: 'auto_awesome_motion',
        movies: allMovies.slice(i, i + COL_COUNT)
      });
    }
    return rows;
  }, [localLibrary, localFilterId, driveMovies]);

  // Seções e linhas em grade full-page (8 colunas) para a visualização de Favoritos
  const favoritesGridRows = useMemo(() => {
    const COL_COUNT = 8;
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
    if (activeTab === 'settings') return 5;
    if (activeTab === 'favorites') return Math.max(1, favoritesGridRows.length);
    if (activeTab === 'local') return Math.max(1, localGridRows.length);
    return Math.max(1, currentSections.length);
  }, [activeTab, downloads.length, favoritesGridRows.length, localGridRows.length, currentSections.length]);

  const getColCount = useCallback((rIdx) => {
    if (activeTab === 'downloads') {
      const item = downloads[rIdx];
      const isDone = item && (item.status === 'completed' || (item.progress && item.progress >= 100));
      return isDone ? 2 : 3;
    }
    if (activeTab === 'settings') {
      return 1;
    }
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
  }, [activeTab, downloads, favoritesGridRows, localGridRows, currentSections]);

  // Iniciar reprodução de filme ou abrir modal de série com retomada inteligente
  const handlePlayMovieDirect = useCallback(async (movie) => {
    if (!movie) return;

    // Obtém progresso salvo previamente se existir
    const saved = getSavedProgress(movie);
    const resumePos = (saved && saved.position > 10) ? saved.position : (movie.position || 0);

    // Séries: se vier do Continuar Assistindo com episódio salvo, retoma diretamente
    if (movie.isSeries || movie.type === 'series') {
      if (movie.streamUrl && movie.episode) {
        let sUrl = movie.streamUrl;
        if (!sUrl.includes('direct=') && movie.isLocal) {
          sUrl += (sUrl.includes('?') ? '&' : '?') + 'direct=1';
        }
        setActiveStream({
          id: movie.id,
          movieId: movie.movieId || movie.id,
          imdbId: movie.imdbId,
          streamUrl: sUrl,
          title: movie.title,
          poster: movie.poster,
          backdrop: movie.backdrop || movie.poster,
          infoHash: movie.infoHash,
          quality: movie.quality || '1080p',
          isLocal: Boolean(movie.isLocal),
          filePath: movie.filePath,
          isSeries: true,
          season: movie.season,
          episode: movie.episode,
          episodeName: movie.episodeName,
          resumePosition: resumePos
        });
        return;
      }
      setSelectedMovie({ ...movie, position: resumePos });
      return;
    }

    // Nuvem (Google Drive)
    if (movie.isCloud || (movie.streamUrl && (movie.streamUrl.includes('drive.google.com') || movie.streamUrl.includes('drive.usercontent.google.com')))) {
      setActiveStream({
        id: movie.id,
        movieId: movie.movieId || movie.id,
        streamUrl: movie.streamUrl,
        title: movie.title || movie.name || 'Filme na Nuvem',
        poster: movie.poster,
        backdrop: movie.backdrop || movie.poster,
        quality: movie.quality || 'Nuvem 1080p',
        isLocal: false,
        isCloud: true,
        duration: movie.duration || 0,
        resumePosition: resumePos
      });
      return;
    }

    const filePath = movie.videoPath || movie.filePath || '';
    const isLocal = Boolean(filePath);
    if (isLocal) {
      let sUrl = movie.streamUrl;
      if (!sUrl) {
        sUrl = `/api/local/stream?file=${encodeURIComponent(filePath)}`;
      }

      setActiveStream({
        id: movie.id || filePath,
        movieId: movie.movieId || movie.id || filePath,
        streamUrl: sUrl,
        title: movie.title || movie.name || movie.cleanName || 'Filme Local',
        poster: movie.poster,
        backdrop: movie.backdrop || movie.poster,
        quality: movie.quality || '1080p Full HD',
        isLocal: true,
        filePath,
        duration: movie.duration || 0,
        resumePosition: resumePos,
        hasSubtitle: Boolean(movie.hasSubtitle || movie.srtPath),
        srtPath: movie.srtPath || '',
        subtitleUrl: movie.subtitleUrl || ''
      });
      return;
    }

    // Se já tiver streamUrl conhecido (ex: vindo direto do histórico Continuar Assistindo)
    if (movie.streamUrl && (movie.infoHash || movie.streamUrl.includes('/api/'))) {
      setActiveStream({
        id: movie.id || movie.imdbId,
        movieId: movie.movieId || movie.id,
        imdbId: movie.imdbId || movie.id,
        streamUrl: movie.streamUrl,
        title: movie.title,
        poster: movie.poster,
        backdrop: movie.backdrop || movie.poster,
        infoHash: movie.infoHash,
        quality: movie.quality || '1080p Full HD',
        isLocal: false,
        duration: movie.duration || 0,
        resumePosition: resumePos
      });
      return;
    }

    // Busca detalhes e melhor torrent (ou arquivo local já baixado)
    const full = await getMovieDetails(movie);
    if (full && full.isLocal && full.filePath) {
      setActiveStream({
        id: full.id || full.imdbId || full.filePath,
        movieId: full.id || movie.id || full.filePath,
        imdbId: full.imdbId || movie.imdbId,
        streamUrl: full.streamUrl || `/api/local/stream?file=${encodeURIComponent(full.filePath)}`,
        title: full.title,
        poster: full.poster,
        backdrop: full.backdrop || full.poster,
        quality: full.localFile?.quality || full.quality || '1080p Full HD',
        isLocal: true,
        filePath: full.filePath,
        duration: full.duration || 0,
        resumePosition: resumePos
      });
      return;
    }

    if (full && full.streams && full.streams.length > 0) {
      const best = full.streams[0];
      setActiveStream({
        id: full.id || full.imdbId || movie.id,
        movieId: full.id || movie.id,
        imdbId: full.imdbId || movie.imdbId,
        streamUrl: best.streamUrl,
        title: full.title,
        poster: full.poster,
        backdrop: full.backdrop || full.poster,
        infoHash: best.infoHash,
        quality: best.quality || '1080p Full HD',
        isLocal: false,
        duration: full.duration || 0,
        resumePosition: resumePos
      });
    } else {
      setSelectedMovie({ ...(full || movie), position: resumePos });
    }
  }, []);

  const modalItemsCount = useMemo(() => {
    if (!selectedMovie) return 3;
    const isSeries = Boolean(selectedMovie.isSeries || selectedMovie.type === 'series' || (selectedMovie.year && String(selectedMovie.year).includes('–')));
    const isLocal = Boolean(selectedMovie.isLocal || selectedMovie.filePath || selectedMovie.videoPath);
    const saved = getSavedProgress(selectedMovie);
    const hasResume = Boolean(saved && saved.position > 10 && (!saved.duration || saved.position / saved.duration < 0.92));
    const isInHistory = Boolean(hasResume || saved || isInWatchHistory(selectedMovie));

    let baseButtons = 3; // Assistir, Baixar, Favoritos
    if (hasResume) baseButtons += 1; // Do Início
    if (isSeries && !isLocal) baseButtons += 1; // Baixar Série Completa
    if (isInHistory) baseButtons += 1; // Tirar de Continuar Assistindo

    const streamsCount = selectedMovie.streams ? selectedMovie.streams.length : 5;
    return baseButtons + streamsCount;
  }, [selectedMovie]);

  const modalStreamBaseIndex = useMemo(() => {
    if (!selectedMovie) return 3;
    const isSeries = Boolean(selectedMovie.isSeries || selectedMovie.type === 'series' || (selectedMovie.year && String(selectedMovie.year).includes('–')));
    const isLocal = Boolean(selectedMovie.isLocal || selectedMovie.filePath || selectedMovie.videoPath);
    const saved = getSavedProgress(selectedMovie);
    const hasResume = Boolean(saved && saved.position > 10 && (!saved.duration || saved.position / saved.duration < 0.92));
    const isInHistory = Boolean(hasResume || saved || isInWatchHistory(selectedMovie));

    let baseButtons = 3; // Assistir, Baixar, Favoritos
    if (hasResume) baseButtons += 1; // Do Início
    if (isSeries && !isLocal) baseButtons += 1; // Baixar Série Completa
    if (isInHistory) baseButtons += 1; // Tirar de Continuar Assistindo

    return baseButtons;
  }, [selectedMovie]);

  // 3.5. Ações dinâmicas para o Menu de Ações Rápidas (Segurar OK no controle)
  const quickMenuActionsList = useMemo(() => {
    if (!quickMenuMovie) return [];
    if (confirmDeleteMode) {
      return ['confirm_delete', 'cancel_delete'];
    }
    if (quickMenuContext.isDownload) {
      const isDlDone = quickMenuMovie.status === 'completed' || (quickMenuMovie.progress && quickMenuMovie.progress >= 100);
      return isDlDone
        ? ['play', 'details', 'delete_download']
        : ['play', 'pause_resume', 'details', 'delete_download'];
    }
    const list = ['play'];
    if (quickMenuContext.isInContinueWatching) {
      list.push('remove_history');
    }
    list.push('details');
    list.push('favorite');
    if (!quickMenuContext.isLocal && !quickMenuMovie.isLocal) {
      list.push('download');
    }
    if (quickMenuContext.isLocal || quickMenuMovie.isLocal || quickMenuMovie.filePath) {
      list.push('delete_local');
    }
    return list;
  }, [quickMenuMovie, confirmDeleteMode, quickMenuContext]);

  const handleCloseQuickMenu = useCallback(() => {
    if (confirmDeleteMode) {
      setConfirmDeleteMode(false);
      nav.setQuickMenuIndex?.(0);
      return;
    }
    setQuickMenuMovie(null);
  }, [confirmDeleteMode]);

  // Remove otimisticamente um arquivo local de todos os estados da UI em 0ms
  const removeLocalMovieFromState = useCallback((target) => {
    if (!target) return;
    const fPath = String(target.filePath || target.videoPath || target.savePath || '').toLowerCase().trim();
    const tId = String(target.id || target.imdbId || target.infoHash || '').toLowerCase().trim();
    const tTitle = String(target.title || target.cleanName || target.name || '').toLowerCase().trim();

    if (fPath) deletedLocalPathsRef.current.add(fPath);

    const matchesTarget = (m) => {
      if (!m) return false;
      const mPath = String(m.filePath || m.videoPath || '').toLowerCase().trim();
      const mId = String(m.id || m.imdbId || '').toLowerCase().trim();
      const mTitle = String(m.title || m.cleanName || m.name || '').toLowerCase().trim();
      if (fPath && mPath && (mPath === fPath || mPath.startsWith(fPath))) return true;
      if (tId && mId && mId === tId && (m.isLocal || fPath)) return true;
      if (!fPath && tTitle && mTitle && mTitle === tTitle) return true;
      return false;
    };

    setLocalMovies(prev => prev.filter(m => !matchesTarget(m)));
    setLocalLibrary(prev => {
      if (!prev) return prev;
      const nextMovies = (prev.movies || []).filter(m => !matchesTarget(m));
      const nextFranchises = (prev.franchises || [])
        .map(f => ({ ...f, movies: (f.movies || []).filter(m => !matchesTarget(m)) }))
        .filter(f => f.movies.length > 0);
      const nextStandalone = (prev.standaloneMovies || []).filter(m => !matchesTarget(m));
      const nextSeries = (prev.series || [])
        .map(s => ({ ...s, episodes: (s.episodes || []).filter(ep => !matchesTarget(ep)) }))
        .filter(s => s.episodes.length > 0);
      return {
        ...prev,
        movies: nextMovies,
        franchises: nextFranchises,
        standaloneMovies: nextStandalone,
        series: nextSeries,
        count: nextMovies.length
      };
    });
  }, []);

  // Ações de download (100% otimistas - resposta em 0ms na interface)
  const handlePauseDownload = useCallback((item) => {
    const id = item.infoHash || item.id;
    if (!id) return;
    const normId = String(id).toLowerCase();

    setDownloads(prev => prev.map(d => {
      if (String(d.infoHash || d.id || '').toLowerCase() === normId) {
        return { ...d, isPaused: true, status: 'paused', downloadSpeed: '0 B/s' };
      }
      return d;
    }));
    showToast(`Download de "${item.title || 'Filme'}" pausado.`);

    pauseDownload(id).then(() => refreshDownloadsInfo());
  }, [refreshDownloadsInfo, showToast]);

  const handleResumeDownload = useCallback((item) => {
    const id = item.infoHash || item.id;
    if (!id) return;
    const normId = String(id).toLowerCase();
    deletedDownloadIdsRef.current.delete(normId);

    setDownloads(prev => prev.map(d => {
      if (String(d.infoHash || d.id || '').toLowerCase() === normId) {
        return { ...d, isPaused: false, status: 'downloading' };
      }
      return d;
    }));
    showToast(`Download de "${item.title || 'Filme'}" retomado.`);

    resumeDownload(id).then(() => refreshDownloadsInfo());
  }, [refreshDownloadsInfo, showToast]);

  const findMatchingLocalMovie = useCallback((target) => {
    if (!target || !localMovies || localMovies.length === 0) return null;
    const tPath = String(target.filePath || target.videoPath || '').toLowerCase().trim();
    const tImdb = String(target.imdbId || target.id || '').toLowerCase().trim();
    const tTitle = String(target.title || target.cleanName || target.name || '').toLowerCase().trim();
    return localMovies.find(m => {
      if (!m) return false;
      const mPath = String(m.filePath || m.videoPath || '').toLowerCase().trim();
      const mImdb = String(m.imdbId || m.id || '').toLowerCase().trim();
      const mTitle = String(m.title || m.cleanName || m.name || '').toLowerCase().trim();
      if (tPath && mPath && mPath === tPath) return true;
      if (tImdb && tImdb.startsWith('tt') && mImdb === tImdb) return true;
      if (tTitle && mTitle && mTitle === tTitle) return true;
      return false;
    }) || null;
  }, [localMovies]);

  const handleCancelDownload = useCallback((item, deleteFiles = true) => {
    if (!item) return;
    const matchedLocal = findMatchingLocalMovie(item);
    const localPath = item.filePath || item.videoPath || matchedLocal?.filePath || matchedLocal?.videoPath || '';
    const id = item.infoHash || item.id;
    if (!id && !localPath) return;

    if (id) {
      const normId = String(id).toLowerCase();
      deletedDownloadIdsRef.current.add(normId);

      // 1. Remove instantaneamente da lista de downloads na tela (0ms)
      setDownloads(prev => {
        const next = prev.filter(d => String(d.infoHash || d.id || '').toLowerCase() !== normId);
        if (activeTab === 'downloads') {
          nav.setRowIndex?.(r => Math.max(0, Math.min(r, next.length - 1)));
          nav.setColIndex?.(0);
        }
        return next;
      });
    }

    // 2. Remove também da biblioteca local e histórico se existir
    if (deleteFiles) {
      removeLocalMovieFromState(matchedLocal || item);
      clearWatchProgress(item);
      refreshUserData();
    }

    showToast(`Download de "${item.title || 'Filme'}" cancelado e excluído do PC.`);

    // 3. Executa exclusão física no backend em background sem travar a UI
    if (localPath && deleteFiles) {
      deleteLocalFile(localPath).catch(() => {});
    }
    if (id) {
      deleteDownload(id, deleteFiles).then(() => {
        refreshDownloadsInfo();
        if (deleteFiles) {
          getLocalLibraryData().then(data => {
            const isNotDeleted = (m) => {
              const mp = String(m?.filePath || m?.videoPath || '').toLowerCase().trim();
              return !mp || !deletedLocalPathsRef.current.has(mp);
            };
            const filteredMovies = (data.movies || []).filter(isNotDeleted);
            const filteredFranchises = (data.franchises || [])
              .map(f => ({ ...f, movies: (f.movies || []).filter(isNotDeleted) }))
              .filter(f => f.movies.length > 0);
            const filteredStandalone = (data.standaloneMovies || []).filter(isNotDeleted);
            const filteredSeries = (data.series || [])
              .map(s => ({ ...s, episodes: (s.episodes || []).filter(isNotDeleted) }))
              .filter(s => s.episodes.length > 0);
            setLocalLibrary({
              ...data,
              movies: filteredMovies,
              franchises: filteredFranchises,
              standaloneMovies: filteredStandalone,
              series: filteredSeries,
              count: filteredMovies.length
            });
            setLocalMovies(filteredMovies);
          });
        }
      });
    }
  }, [activeTab, findMatchingLocalMovie, refreshDownloadsInfo, showToast, removeLocalMovieFromState, refreshUserData]);

  // Exclusão ultra-responsiva de arquivo local (0ms na interface)
  const executeDeleteLocalMovie = useCallback((target) => {
    if (!target) return;
    setConfirmDeleteMode(false);
    setQuickMenuMovie(null);
    setSelectedMovie(null);

    const matchedLocal = findMatchingLocalMovie(target);
    const fPath = target.filePath || target.videoPath || matchedLocal?.filePath || matchedLocal?.videoPath || target.savePath || '';
    const displayTitle = target.title || target.cleanName || matchedLocal?.title || 'Arquivo';

    // 1. Atualização otimista instantânea (remove o card na mesma hora)
    removeLocalMovieFromState(matchedLocal ? { ...target, filePath: fPath } : target);
    clearWatchProgress(target);
    refreshUserData();
    if (activeTab === 'local') {
      nav.setColIndex?.(c => Math.max(0, c - 1));
    }

    const tImdb = String(target.imdbId || target.id || '').toLowerCase().trim();
    const tTitle = String(target.title || target.cleanName || target.name || '').toLowerCase().trim();
    const matchedDl = downloads.find(d => {
      if (!d) return false;
      if (target.infoHash && String(d.infoHash || d.id || '').toLowerCase() === String(target.infoHash).toLowerCase()) return true;
      if (tImdb && String(d.imdbId || d.id || '').toLowerCase() === tImdb) return true;
      if (tTitle && String(d.title || d.name || '').toLowerCase().trim() === tTitle) return true;
      return false;
    });
    const dlId = matchedDl?.infoHash || matchedDl?.id || target.infoHash || (target.id && /^[a-f0-9]{40}$/i.test(String(target.id)) ? target.id : null);

    if (dlId) {
      const normDlId = String(dlId).toLowerCase();
      deletedDownloadIdsRef.current.add(normDlId);
      setDownloads(prev => prev.filter(d => String(d.infoHash || d.id || '').toLowerCase() !== normDlId));
    }

    showToast(`"${displayTitle}" excluído do computador!`);

    // 2. Dispara remoção física em background no servidor
    if (fPath) {
      deleteLocalFile(fPath).then((res) => {
        if (res && res.success === false) {
          showToast(res.error || 'Aviso ao excluir arquivo no disco');
        }
        getLocalLibraryData().then(data => {
          const isNotDeleted = (m) => {
            const mp = String(m?.filePath || m?.videoPath || '').toLowerCase().trim();
            return !mp || !deletedLocalPathsRef.current.has(mp);
          };
          const filteredMovies = (data.movies || []).filter(isNotDeleted);
          const filteredFranchises = (data.franchises || [])
            .map(f => ({ ...f, movies: (f.movies || []).filter(isNotDeleted) }))
            .filter(f => f.movies.length > 0);
          const filteredStandalone = (data.standaloneMovies || []).filter(isNotDeleted);
          const filteredSeries = (data.series || [])
            .map(s => ({ ...s, episodes: (s.episodes || []).filter(isNotDeleted) }))
            .filter(s => s.episodes.length > 0);
          setLocalLibrary({
            ...data,
            movies: filteredMovies,
            franchises: filteredFranchises,
            standaloneMovies: filteredStandalone,
            series: filteredSeries,
            count: filteredMovies.length
          });
          setLocalMovies(filteredMovies);
        });
      }).catch(() => {});
    }
    if (dlId) {
      deleteDownload(dlId, true).then(() => refreshDownloadsInfo()).catch(() => {});
    }
  }, [activeTab, downloads, findMatchingLocalMovie, removeLocalMovieFromState, refreshUserData, showToast, refreshDownloadsInfo]);

  const handleConfirmDelete = useCallback(() => {
    if (!quickMenuMovie) return;
    executeDeleteLocalMovie(quickMenuMovie);
  }, [quickMenuMovie, executeDeleteLocalMovie]);

  const handleStartDownloadTarget = useCallback((target, destination = 'local') => {
    if (!target) return;
    const isDrive = destination === 'drive' || destination === 'gdrive';
    const destLabel = isDrive ? 'Google Drive (G:\\Meu Drive\\cinelar)' : 'Pasta Local (D:\\Filmes)';

    if (target.isSeries || target.type === 'series') {
      setSelectedMovie({ ...target, preferredDestination: destination });
      return;
    }

    const movieTitle = target.title || target.name || 'Filme';
    showToast(`Buscando opções para baixar "${movieTitle}" em ${destLabel}...`);
    getMovieDetails(target).then(async (full) => {
      const streams = full?.streams || [];
      const best = streams[0];
      if (best && best.magnet) {
        const res = await startDownload({
          magnet: best.magnet,
          title: full.title || movieTitle,
          poster: full.poster || target.poster || '',
          backdrop: full.backdrop || target.backdrop || full.poster || '',
          overview: full.synopsis || target.synopsis || '',
          year: full.year || target.year || '',
          imdbId: full.imdbId || target.imdbId || full.id || target.id,
          quality: best.quality || '1080p Full HD',
          destination: isDrive ? 'drive' : 'local'
        });
        if (res && (res.id || res.success !== false)) {
          if (res.id) deletedDownloadIdsRef.current.delete(String(res.id).toLowerCase());
          refreshDownloadsInfo();
          showToast(`Download de "${full.title || movieTitle}" (${best.quality || '1080p'}) iniciado em ${destLabel}!`);
          return;
        }
      }
      setSelectedMovie({ ...(full || target), preferredDestination: destination });
    }).catch(() => {
      setSelectedMovie({ ...target, preferredDestination: destination });
    });
  }, [showToast, refreshDownloadsInfo]);

  const handleQuickActionSelect = useCallback((actionId) => {
    if (!quickMenuMovie) return;
    const target = quickMenuMovie;

    switch (actionId) {
      case 'play':
        setQuickMenuMovie(null);
        handlePlayMovieDirect(target);
        break;

      case 'details':
        setQuickMenuMovie(null);
        setSelectedMovie(target);
        break;

      case 'pause_resume':
        setQuickMenuMovie(null);
        if (target.isPaused || target.status === 'paused') {
          handleResumeDownload(target);
        } else {
          handlePauseDownload(target);
        }
        break;

      case 'delete_download':
        setQuickMenuMovie(null);
        handleCancelDownload(target, true);
        break;

      case 'favorite': {
        const added = toggleFavorite(target);
        showToast(added ? 'Adicionado à Minha Lista' : 'Removido de Minha Lista');
        refreshUserData();
        setQuickMenuMovie(null);
        break;
      }

      case 'download_local': {
        setQuickMenuMovie(null);
        handleStartDownloadTarget(target, 'local');
        break;
      }

      case 'download_drive': {
        setQuickMenuMovie(null);
        handleStartDownloadTarget(target, 'drive');
        break;
      }

      case 'download': {
        setQuickMenuMovie(null);
        handleStartDownloadTarget(target, 'local');
        break;
      }

      case 'remove_history':
        clearWatchProgress(target);
        refreshUserData();
        showToast(`"${target.title || target.name || 'Título'}" removido de Continuar Assistindo`);
        setQuickMenuMovie(null);
        nav.setColIndex(c => Math.max(0, c - 1));
        break;

      case 'delete_local':
        executeDeleteLocalMovie(target);
        break;

      case 'confirm_delete':
        handleConfirmDelete();
        break;

      case 'cancel_delete':
        setConfirmDeleteMode(false);
        nav.setQuickMenuIndex?.(0);
        break;

      default:
        setQuickMenuMovie(null);
        break;
    }
  }, [quickMenuMovie, handlePlayMovieDirect, showToast, refreshUserData, executeDeleteLocalMovie, handleConfirmDelete, handleResumeDownload, handlePauseDownload, handleCancelDownload]);

  // Abertura centralizada do menu de opções do título
  const handleOpenQuickMenuForMovie = useCallback((target, forceContinueWatching = false) => {
    if (!target) return;
    const matchedLocal = findMatchingLocalMovie(target);
    const resolvedFilePath = target.filePath || target.videoPath || matchedLocal?.filePath || matchedLocal?.videoPath || '';
    const isLocal = Boolean(resolvedFilePath || target.isLocal || activeTab === 'local');
    const isDownload = Boolean(
      activeTab === 'downloads' ||
      target.status === 'downloading' ||
      target.status === 'paused'
    );
    const isContinueWatching = Boolean(forceContinueWatching || isInWatchHistory(target) || (target.position && target.position > 10));
    const enrichedTarget = resolvedFilePath && !target.filePath
      ? { ...target, filePath: resolvedFilePath, videoPath: resolvedFilePath, isLocal: true }
      : target;

    setConfirmDeleteMode(false);
    setQuickMenuContext({ isInContinueWatching: isContinueWatching, isLocal, isDownload, downloadItem: enrichedTarget });
    setQuickMenuMovie(enrichedTarget);
  }, [activeTab, findMatchingLocalMovie]);

  const handleLongPress = useCallback(({ zone, heroIndex, rowIndex, colIndex, resultsColIndex }) => {
    let target = null;

    if (zone === 'hero') {
      target = heroMovie;
    } else if (zone === 'rows') {
      if (activeTab === 'downloads') {
        target = downloads[rowIndex];
      } else if (activeTab === 'favorites') {
        target = favoritesGridRows[rowIndex]?.movies?.[colIndex];
      } else if (activeTab === 'local') {
        target = localGridRows[rowIndex]?.movies?.[colIndex];
      } else {
        const sec = currentSections[rowIndex];
        if (sec && sec.movies && sec.movies[colIndex]) {
          target = sec.movies[colIndex];
          handleOpenQuickMenuForMovie(target, sec.id === 'continue-watching');
          return;
        }
      }
    } else if (zone === 'search-results') {
      if (searchInputRef.current && searchInputRef.current.getResult) {
        target = searchInputRef.current.getResult(resultsColIndex);
      }
    }

    if (target) {
      handleOpenQuickMenuForMovie(target);
    }
  }, [activeTab, heroMovie, downloads, favoritesGridRows, localGridRows, currentSections, handleOpenQuickMenuForMovie]);

  // 4. Integração do Hook Espacial Ultra-Rápido
  const nav = useSpatialNav({
    isPlayerOpen: Boolean(activeStream),
    isModalOpen: Boolean(selectedMovie),
    modalActionRef,
    modalStreamBaseIndex,
    isQuickMenuOpen: Boolean(quickMenuMovie),
    quickMenuCount: quickMenuActionsList.length,
    activeTab,
    hasHero: activeTab === 'home' && Boolean(heroMovie),
    rowCount,
    getColCount,
    headerCount: NAV_ITEMS.length,
    localFilterCount: localFilters.length,
    modalItemsCount,
    searchActionRef: searchInputRef,
    onLongPress: handleLongPress,
    onCloseQuickMenu: handleCloseQuickMenu,
    onQuickMenuSelect: (idx) => {
      const actId = quickMenuActionsList[idx];
      if (actId) handleQuickActionSelect(actId);
    },
    onTabChange: (newHeaderIdx) => {
      const item = NAV_ITEMS[newHeaderIdx];
      if (item && item.id !== activeTab) {
        setActiveTab(item.id);
      }
    },
    onLocalFilterChange: (newFilterIdx) => {
      const targetFilter = localFilters[newFilterIdx];
      if (targetFilter) {
        setLocalFilterId(targetFilter.id);
        nav.setRowIndex(0);
        nav.setColIndex(0);
        if (targetFilter.id === 'gdrive') {
          refreshDriveLibrary();
        }
      }
    },
    onBack: () => {
      // Limpeza de estado do player e modal (prioridade absoluta com useSpatialNav)
      if (activeStream) {
        setActiveStream(null);
        refreshUserData();
        return true;
      }
      if (selectedMovie) {
        if (modalActionRef.current && modalActionRef.current.handleBack && modalActionRef.current.handleBack()) {
          return true; // Sub-diálogo consumiu o voltar, modal continua aberto
        }
        setSelectedMovie(null);
        refreshUserData();
        return true; // Modal fechado: useSpatialNav restaura o foco exato do card de origem
      }
      // Se estiver na aba local e com filtro de coleção/franquia ou drive ativo, voltar restaura para a Pasta Local do PC
      if (activeTab === 'local' && localFilterId !== 'local-only') {
        setLocalFilterId('local-only');
        nav.setLocalFilterIndex(0);
        nav.setRowIndex(0);
        nav.setColIndex(0);
        return true;
      }
      // Se já está no header da página inicial e pressionou voltar novamente, solicita confirmação para não fechar por acidente na TV
      const now = Date.now();
      if (lastBackPressRef.current && (now - lastBackPressRef.current < 2500)) {
        if (typeof window !== 'undefined' && window.tizen && window.tizen.application) {
          try {
            window.tizen.application.getCurrentApplication().exit();
          } catch (_) {}
        }
        return false;
      }
      lastBackPressRef.current = now;
      showToast('Pressione VOLTAR novamente para sair do Cinelar');
      return true;
    },
    onEnter: ({ zone, index, headerIndex, heroIndex, rowIndex, colIndex, filterIndex, searchRowIndex, searchColIndex, resultsColIndex, isPlayKey }) => {
      if (zone === 'modal') {
        if (modalActionRef.current && modalActionRef.current.triggerAction) {
          modalActionRef.current.triggerAction(index);
        }
        return;
      }

      if (zone === 'header') {
        // Confirma tab e desce diretamente para a posição exata salva naquela aba
        nav.descendFromHeader?.();
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
          if (targetFilter.id === 'gdrive') {
            refreshDriveLibrary();
          }
        }
        nav.setActiveZone('rows');
        nav.setRowIndex(0);
        nav.setColIndex(0);
        return;
      }

      if (zone === 'rows') {
        if (activeTab === 'settings') {
          if (rowIndex === 1) {
            setIsDriveConfigOpen(true);
          }
          return;
        }

        if (activeTab === 'downloads') {
          const dl = downloads[rowIndex];
          if (dl) {
            const isDone = dl.status === 'completed' || (dl.progress && dl.progress >= 100);
            if (colIndex === 0 || isPlayKey) {
              handlePlayMovieDirect(dl);
            } else if (!isDone && colIndex === 1) {
              if (dl.isPaused || dl.status === 'paused') {
                handleResumeDownload(dl);
              } else {
                handlePauseDownload(dl);
              }
            } else if ((isDone && colIndex === 1) || (!isDone && colIndex === 2)) {
              handleCancelDownload(dl, true);
            }
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
            const mov = row.movies[colIndex];
            if (isPlayKey) {
              handlePlayMovieDirect(mov);
            } else {
              handleOpenQuickMenuForMovie(mov);
            }
          }
          return;
        }

        const sec = currentSections[rowIndex];
        if (sec && sec.movies && sec.movies[colIndex]) {
          const mov = sec.movies[colIndex];
          if (sec.id === 'continue-watching') {
            handlePlayMovieDirect(mov);
          } else if (isPlayKey) {
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

  // Enquanto o player fullscreen estiver aberto, a interface por baixo nao precisa ser pintada.
  // visibility (e nao display) preserva o layout e a posicao de rolagem ao voltar.
  const hiddenUnderPlayerStyle = activeStream ? { visibility: 'hidden' } : undefined;

  return (
    <Suspense fallback={null}>
    <div className="tv-app-root">
      <div style={hiddenUnderPlayerStyle}>
        <Header
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isZoneFocused={nav.activeZone === 'header'}
          focusedIndex={nav.headerIndex}
          serverStatus={serverStatus}
          activeDownloadsCount={activeDownloadsCount}
        />
      </div>

      <main className="tv-main-content" style={hiddenUnderPlayerStyle}>
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <HomeView
                heroMovie={heroMovie}
                sections={homeSections}
                activeZone={nav.activeZone}
                heroIndex={nav.heroIndex}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectMovie={(mov, isContinue) => {
                  if (isContinue) {
                    handlePlayMovieDirect(mov);
                  } else {
                    setSelectedMovie(mov);
                  }
                }}
                onContextMenuMovie={(mov) => handleOpenQuickMenuForMovie(mov, true)}
                onPlayHero={() => handlePlayMovieDirect(heroMovie)}
                onInfoHero={() => setSelectedMovie(heroMovie)}
                isLoading={isHomeLoading}
                serverStatus={serverStatus}
              />
            </motion.div>
          )}

          {activeTab === 'movies' && (
            <motion.div
              key="movies"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <MoviesView
                genreSections={genreSections}
                activeZone={nav.activeZone}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectMovie={setSelectedMovie}
                onContextMenuMovie={handleOpenQuickMenuForMovie}
              />
            </motion.div>
          )}

          {activeTab === 'series' && (
            <motion.div
              key="series"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <SeriesView
                genreSections={seriesGenreSections}
                activeZone={nav.activeZone}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectSeries={setSelectedMovie}
                onContextMenuMovie={handleOpenQuickMenuForMovie}
              />
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div
              key="favorites"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <FavoritesView
                favorites={favorites}
                gridRows={favoritesGridRows}
                activeZone={nav.activeZone}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectMovie={setSelectedMovie}
                onContextMenuMovie={handleOpenQuickMenuForMovie}
              />
            </motion.div>
          )}

          {activeTab === 'local' && (
            <motion.div
              key="local"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <LocalFolderView
                localLibrary={localLibrary}
                filters={localFilters}
                activeFilter={localFilterId}
                onSelectFilter={(fid, idx) => {
                  setLocalFilterId(fid);
                  nav.setLocalFilterIndex(idx);
                  nav.setRowIndex(0);
                  nav.setColIndex(0);
                  if (fid === 'gdrive') {
                    refreshDriveLibrary();
                  }
                }}
                gridRows={localGridRows}
                activeZone={nav.activeZone}
                localFilterIndex={nav.localFilterIndex}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectMovie={handleOpenQuickMenuForMovie}
                onContextMenuMovie={handleOpenQuickMenuForMovie}
                onOpenDriveConfig={() => setIsDriveConfigOpen(true)}
                serverStatus={serverStatus}
              />
            </motion.div>
          )}

          {activeTab === 'downloads' && (
            <motion.div
              key="downloads"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <DownloadsView
                downloads={downloads}
                storage={downloadsStorage}
                stats={downloadsStats}
                activeZone={nav.activeZone}
                focusedIndex={nav.rowIndex}
                actionIndex={nav.colIndex}
                onPlayDownload={handlePlayMovieDirect}
                onPauseDownload={handlePauseDownload}
                onResumeDownload={handleResumeDownload}
                onCancelDownload={handleCancelDownload}
                onContextMenu={handleOpenQuickMenuForMovie}
              />
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <SearchView
                activeZone={nav.activeZone}
                searchRowIndex={nav.searchRowIndex}
                searchColIndex={nav.searchColIndex}
                resultsColIndex={nav.resultsColIndex}
                onSelectMovie={setSelectedMovie}
                searchActionRef={searchInputRef}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              className="tv-view-motion-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <SettingsView
                activeZone={nav.activeZone}
                focusedIndex={nav.rowIndex}
                actionIndex={nav.colIndex}
                serverStatus={serverStatus}
                onOpenDriveConfig={() => setIsDriveConfigOpen(true)}
                onRefreshLibrary={refreshLocalLibrary}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal de Detalhes do Filme ou Série */}
      <AnimatePresence>
        {selectedMovie && (
          <MovieDetailsModal
            key={selectedMovie.id || selectedMovie.imdbId || 'movie-modal'}
            movie={selectedMovie}
            isZoneFocused={nav.activeZone === 'modal'}
            focusedIndex={nav.modalIndex}
            modalActionRef={modalActionRef}
            onToggleFavorite={refreshUserData}
            onDeleteLocal={executeDeleteLocalMovie}
            onDownloadStarted={refreshDownloadsInfo}
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
      </AnimatePresence>

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

      {/* Menu de Ações Rápidas (Segurar OK no controle) */}
      <AnimatePresence>
        {quickMenuMovie && (
          <QuickActionsModal
            key="quick-menu"
            movie={quickMenuMovie}
            context={quickMenuContext}
            isFav={isFavorite(quickMenuMovie.id, quickMenuMovie.imdbId, quickMenuMovie.title)}
            isOpen={Boolean(quickMenuMovie)}
            focusedIndex={nav.quickMenuIndex}
            confirmDeleteMode={confirmDeleteMode}
            onSelectAction={handleQuickActionSelect}
            onClose={handleCloseQuickMenu}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={() => setConfirmDeleteMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Configuração do Google Drive */}
      <AnimatePresence>
        {isDriveConfigOpen && (
          <DriveConfigModal
            key="drive-config"
            isOpen={isDriveConfigOpen}
            onClose={() => setIsDriveConfigOpen(false)}
            onSaved={refreshDriveLibrary}
          />
        )}
      </AnimatePresence>

      {/* Notificação Toast Global */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="toast"
            className="tv-global-toast"
            initial={{ opacity: 0, y: 25, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <span className="material-icons" style={{ fontSize: '20px', color: '#22C55E' }}>check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Atalhos Coloridos do Controle da TV (Samsung / Tizen) */}
      {!activeStream && !selectedMovie && !quickMenuMovie && (
        <aside className="tv-remote-hints" aria-label="Atalhos coloridos do controle remoto">
          <div className="tv-hint-item">
            <span className="tv-hint-dot red" />
            <span>Buscar</span>
          </div>
          <div className="tv-hint-item">
            <span className="tv-hint-dot green" />
            <span>Drive / Local</span>
          </div>
          <div className="tv-hint-item">
            <span className="tv-hint-dot yellow" />
            <span>Favoritos</span>
          </div>
          <div className="tv-hint-item">
            <span className="tv-hint-dot blue" />
            <span>Downloads</span>
          </div>
        </aside>
      )}
    </div>
    </Suspense>
  );
}
export default App;
