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
  switchDownloadDestination,
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
  prefetchCatalogs,
  clearCatalogCache
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
  const [downloads, setDownloads] = useState([]);
  const [downloadsStorage, setDownloadsStorage] = useState(null);
  const [downloadsStats, setDownloadsStats] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [isMoviesLoading, setIsMoviesLoading] = useState(false);
  const [isSeriesLoading, setIsSeriesLoading] = useState(false);
  const toastTimerRef = useRef(null);
  const lastBackPressRef = useRef(0);
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

  const confirmAppExit = useCallback(() => {
    try {
      const application = window.tizen?.application?.getCurrentApplication?.();
      if (application?.exit) {
        application.exit();
        return;
      }
    } catch (_) {}
    showToast('Pressione o botão Home do controle da TV para sair.');
  }, [showToast]);

  const searchInputRef = useRef({ handleKeyPress: null });
  const modalActionRef = useRef({});
  const deletedDownloadIdsRef = useRef(new Set());
  const deletedLocalPathsRef = useRef(new Set());

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

  const refreshLocalLibrary = useCallback((force = false) => {
    getLocalLibraryData(force).then(data => {
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

  const loadHomeCatalog = useCallback(async () => {
    setIsHomeLoading(true);
    try {
      const [trending, genres] = await Promise.all([getTrendingMovies(), getGenres()]);
      setTrendingMovies(trending);
      const topMovieGenres = genres.filter(g => g.id !== 'all').slice(0, 4);
      const [movieSections, seriesList] = await Promise.all([
        Promise.all(topMovieGenres.map(async genre => {
          try {
            const movies = await getMovies({ genre: genre.id, limit: 12 });
            return movies.length ? { id: genre.id, title: genre.name, movies } : null;
          } catch (_) {
            return null;
          }
        })),
        getSeries({ limit: 12 }).catch(() => [])
      ]);
      const availableMovieSections = movieSections.filter(Boolean);
      setGenreSections(availableMovieSections);
      setSeriesGenreSections(seriesList.length
        ? [{ id: 'series-popular', title: 'Séries em Destaque', movies: seriesList }]
        : []);
      if (!trending.length && !availableMovieSections.length && !seriesList.length) {
        const isStillOnline = await getServerStatus();
        if (!isStillOnline) setServerStatus('offline');
      }
      return true;
    } catch (_) {
      return false;
    } finally {
      setIsHomeLoading(false);
    }
  }, []);

  // Inicialização leve da Home: valida conexão antes de buscar o catálogo.
  useEffect(() => {
    refreshUserData();
    refreshLocalLibrary(true);
    let cancelled = false;
    getServerStatus().then(async isOnline => {
      if (cancelled) return;
      setServerStatus(isOnline ? 'online' : 'offline');
      if (!isOnline) {
        setIsHomeLoading(false);
        return;
      }
      const favoritesPromise = syncFavoritesWithServer().then(favs => {
        if (!cancelled && favs?.length) setFavorites(favs);
      }).catch(() => {});
      await loadHomeCatalog();
      await favoritesPromise;
      if (!cancelled) {
        try { prefetchCatalogs(); } catch (_) {}
      }
    }).catch(() => {
      if (!cancelled) {
        setServerStatus('offline');
        setIsHomeLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [refreshUserData, refreshLocalLibrary, loadHomeCatalog]);

  // Lazy loading sob demanda para a aba Filmes
  useEffect(() => {
    if (activeTab !== 'movies' || loadedAllMovies || serverStatus !== 'online') return;
    let cancelled = false;
    setIsMoviesLoading(true);
    getGenres().then(async genres => {
      const allGenres = genres.filter(g => g.id !== 'all').slice(0, 10);
      const sections = (await Promise.all(allGenres.map(async genre => {
        try {
          const movies = await getMovies({ genre: genre.id, limit: 12 });
          return movies.length ? { id: genre.id, title: genre.name, movies } : null;
        } catch (_) { return null; }
      }))).filter(Boolean);
      if (!cancelled) {
        setGenreSections(sections);
        setLoadedAllMovies(true);
        if (!sections.length) {
          const isStillOnline = await getServerStatus();
          if (!isStillOnline && !cancelled) setServerStatus('offline');
        }
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setIsMoviesLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, loadedAllMovies, serverStatus]);

  // Lazy loading sob demanda para a aba Séries
  useEffect(() => {
    if (activeTab !== 'series' || loadedAllSeries || serverStatus !== 'online') return;
    let cancelled = false;
    setIsSeriesLoading(true);
    getGenres().then(async genres => {
      const allGenres = genres.filter(g => g.id !== 'all').slice(0, 8);
      const sections = (await Promise.all(allGenres.map(async genre => {
        try {
          const series = await getSeries({ genre: genre.id, limit: 12 });
          return series.length ? { id: `series-${genre.id}`, title: `Séries de ${genre.name}`, movies: series } : null;
        } catch (_) { return null; }
      }))).filter(Boolean);
      if (!cancelled) {
        setSeriesGenreSections(sections);
        setLoadedAllSeries(true);
        if (!sections.length) {
          const isStillOnline = await getServerStatus();
          if (!isStillOnline && !cancelled) setServerStatus('offline');
        }
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setIsSeriesLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, loadedAllSeries, serverStatus]);

  // Função centralizada para atualizar lista e métricas de downloads (ignorando itens recém-excluídos)
  const refreshDownloadsInfo = useCallback(async () => {
    if (serverStatus !== 'online' || downloadsRequestInFlightRef.current || document.hidden) return;
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
  }, [serverStatus]);

  const retryServerConnection = useCallback(async () => {
    setServerStatus('checking');
    const isOnline = await getServerStatus();
    setServerStatus(isOnline ? 'online' : 'offline');
    if (!isOnline) return false;

    // Apenas busca o catálogo se ainda estiver vazio, evitando recarregar a tela do nada
    if (activeTab === 'home') {
      if (!genreSections.length || !trendingMovies.length) {
        await loadHomeCatalog();
      }
      syncFavoritesWithServer().then(favs => {
        if (favs?.length) setFavorites(favs);
      }).catch(() => {});
    } else if (activeTab === 'movies') {
      if (!genreSections.length) {
        setIsMoviesLoading(true);
        setLoadedAllMovies(false);
      }
    } else if (activeTab === 'series') {
      if (!seriesGenreSections.length) {
        setIsSeriesLoading(true);
        setLoadedAllSeries(false);
      }
    } else if (activeTab === 'local') {
      refreshLocalLibrary();
    } else if (activeTab === 'downloads') {
      refreshDownloadsInfo();
    }
    return true;
  }, [activeTab, genreSections.length, trendingMovies.length, seriesGenreSections.length, loadHomeCatalog, refreshLocalLibrary, refreshDownloadsInfo]);

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

  // Polling inteligente: atualiza na aba Downloads a cada 2.5s; nas demais apenas se houver download ativo
  useEffect(() => {
    refreshDownloadsInfo();
    if (activeTab === 'downloads') {
      const interval = setInterval(refreshDownloadsInfo, 2500);
      return () => clearInterval(interval);
    }
    if (activeDownloadsCount > 0) {
      const interval = setInterval(refreshDownloadsInfo, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeDownloadsCount, refreshDownloadsInfo]);

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

  // Mapeamento otimizado de filmes locais (D:\Filmes) e nuvem (Google Drive) para marcar badges nos cards
  const localMatchMap = useMemo(() => {
    const map = new Map();

    const normalizeKey = (str) => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const stripYear = (key) => {
      return key.replace(/\s+(19|20)\d{2}$/, '').trim();
    };

    const addTitleKeys = (rawTitle, info) => {
      if (!rawTitle) return;
      const k = normalizeKey(rawTitle);
      if (k && k.length >= 3) {
        map.set(`title:${k}`, info);
        const withoutYear = stripYear(k);
        if (withoutYear && withoutYear !== k && withoutYear.length >= 3) {
          map.set(`title:${withoutYear}`, info);
        }
      }
    };

    // 1. Filmes Locais do PC (D:\Filmes)
    (localMovies || []).forEach(m => {
      if (!m) return;
      const targetPath = String(m.filePath || m.videoPath || '').toLowerCase();
      const isLocalDisk = targetPath.startsWith('d:\\') || targetPath.startsWith('d:/') || targetPath.startsWith('c:\\') || targetPath.startsWith('c:/');
      const isDrive = !isLocalDisk && (targetPath.startsWith('g:\\') || targetPath.startsWith('g:/') || targetPath.includes('meu drive') || m.isCloud || m.isDrive || m.storageLocation === 'drive');
      const info = {
        isLocal: true,
        isDrive,
        filePath: m.filePath || m.videoPath,
        videoPath: m.videoPath || m.filePath,
        streamUrl: m.streamUrl,
        year: m.year
      };

      if (m.imdbId && String(m.imdbId).startsWith('tt')) {
        map.set(`imdb:${String(m.imdbId).toLowerCase().trim()}`, info);
      }
      if (m.id && String(m.id).startsWith('tt')) {
        map.set(`imdb:${String(m.id).toLowerCase().trim()}`, info);
      }
      addTitleKeys(m.title, info);
      addTitleKeys(m.cleanName, info);
      addTitleKeys(m.original_title, info);
      addTitleKeys(m.originalTitle, info);
    });

    // 2. Filmes do Google Drive
    (driveMovies || []).forEach(m => {
      if (!m) return;
      const info = {
        isLocal: true,
        isDrive: true,
        filePath: m.filePath || m.videoPath,
        videoPath: m.videoPath || m.filePath,
        streamUrl: m.streamUrl,
        year: m.year
      };
      if (m.imdbId && String(m.imdbId).startsWith('tt')) {
        map.set(`imdb:${String(m.imdbId).toLowerCase().trim()}`, info);
      }
      if (m.id && String(m.id).startsWith('tt')) {
        map.set(`imdb:${String(m.id).toLowerCase().trim()}`, info);
      }
      addTitleKeys(m.title, info);
      addTitleKeys(m.cleanName, info);
      addTitleKeys(m.original_title, info);
      addTitleKeys(m.originalTitle, info);
    });

    // 3. Downloads concluídos (100% gravado e finalizado)
    (downloads || []).forEach(d => {
      if (!d) return;
      const isComplete = d.status === 'completed' || d.stage === 'completed' || (typeof d.progress === 'number' && d.progress >= 100);
      if (!isComplete) return;
      const isDrive = d.destination === 'drive' || String(d.savePath || '').toLowerCase().startsWith('g:');
      const info = {
        isLocal: true,
        isDrive,
        filePath: d.savePath,
        videoPath: d.savePath,
        streamUrl: d.streamUrl,
        year: d.year
      };
      if (d.imdbId && String(d.imdbId).startsWith('tt')) {
        map.set(`imdb:${String(d.imdbId).toLowerCase().trim()}`, info);
      }
      addTitleKeys(d.title, info);
    });

    return map;
  }, [localMovies, driveMovies, downloads]);

  const enrichMovieWithLocalStatus = useCallback((movie) => {
    if (!movie) return movie;
    if (movie.isLocal && movie.filePath) return movie;

    const normalizeKey = (str) => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const stripYear = (key) => {
      return key.replace(/\s+(19|20)\d{2}$/, '').trim();
    };

    let matched = null;
    if (movie.imdbId && String(movie.imdbId).startsWith('tt')) {
      matched = localMatchMap.get(`imdb:${String(movie.imdbId).toLowerCase().trim()}`);
    }
    if (!matched && movie.id && String(movie.id).startsWith('tt')) {
      matched = localMatchMap.get(`imdb:${String(movie.id).toLowerCase().trim()}`);
    }

    const checkCandidates = [
      movie.title,
      movie.name,
      movie.original_title,
      movie.originalTitle,
      movie.original_name,
      movie.cleanName
    ];

    if (!matched) {
      for (const cand of checkCandidates) {
        if (!cand) continue;
        const k = normalizeKey(cand);
        if (!k || k.length < 3) continue;
        matched = localMatchMap.get(`title:${k}`) || localMatchMap.get(`title:${stripYear(k)}`);
        if (matched) break;
      }
    }

    if (matched && movie.year && matched.year) {
      const my = parseInt(movie.year, 10);
      const ly = parseInt(matched.year, 10);
      if (!isNaN(my) && !isNaN(ly) && Math.abs(my - ly) > 1) {
        matched = null;
      }
    }

    if (matched) {
      return {
        ...movie,
        isLocal: true,
        isDrive: Boolean(matched.isDrive),
        filePath: movie.filePath || matched.filePath,
        videoPath: movie.videoPath || matched.videoPath,
        streamUrl: movie.streamUrl || matched.streamUrl
      };
    }
    return movie;
  }, [localMatchMap]);

  const enrichedGenreSections = useMemo(() => {
    if (!genreSections || genreSections.length === 0) return [];
    return genreSections.map(sec => ({
      ...sec,
      movies: (sec.movies || []).map(enrichMovieWithLocalStatus)
    }));
  }, [genreSections, enrichMovieWithLocalStatus]);

  const enrichedHomeSections = useMemo(() => {
    if (!homeSections || homeSections.length === 0) return [];
    return homeSections.map(sec => ({
      ...sec,
      movies: (sec.movies || []).map(enrichMovieWithLocalStatus)
    }));
  }, [homeSections, enrichMovieWithLocalStatus]);

  const enrichedSeriesGenreSections = useMemo(() => {
    if (!seriesGenreSections || seriesGenreSections.length === 0) return [];
    return seriesGenreSections.map(sec => ({
      ...sec,
      movies: (sec.movies || []).map(enrichMovieWithLocalStatus)
    }));
  }, [seriesGenreSections, enrichMovieWithLocalStatus]);

  // Filme em destaque (Hero)
  const heroMovie = useMemo(() => {
    const raw = trendingMovies.length > 0 ? trendingMovies[0] : (localMovies[0] || null);
    return raw ? enrichMovieWithLocalStatus(raw) : null;
  }, [trendingMovies, localMovies, enrichMovieWithLocalStatus]);

  // 3. Cálculo dinâmico do número de linhas e colunas para a navegação espacial
  const currentSections = useMemo(() => {
    if (activeTab === 'home') return enrichedHomeSections;
    if (activeTab === 'movies') return enrichedGenreSections;
    if (activeTab === 'series') return enrichedSeriesGenreSections;
    if (activeTab === 'favorites') return favoritesGridRows;
    if (activeTab === 'local') return localGridRows;
    return [];
  }, [activeTab, enrichedHomeSections, enrichedGenreSections, enrichedSeriesGenreSections, favoritesGridRows, localGridRows]);

  const rowCount = useMemo(() => {
    if (activeTab === 'downloads') return Math.max(1, downloads.length);
    if (activeTab === 'search') return 1;
    if (activeTab === 'settings') return 5;
    if (activeTab === 'favorites') return Math.max(1, favoritesGridRows.length);
    if (activeTab === 'local') return Math.max(1, localGridRows.length);
    return Math.max(1, currentSections.length);
  }, [activeTab, downloads.length, favoritesGridRows.length, localGridRows.length, currentSections.length]);



  const handleLoadMoreInRow = useCallback(async (sec, explicitMovies = null) => {
    if (!sec) return;
    const secId = sec.id;
    const isSeries = Boolean(sec.isSeries || secId === 'series-popular' || String(secId).startsWith('series'));

    let newMovies = explicitMovies;
    if (!newMovies) {
      showToast(`Carregando mais títulos de "${sec.title}"...`);
      try {
        if (secId === 'trending') {
          newMovies = await getTrendingMovies();
        } else if (isSeries) {
          newMovies = await getSeries({ genre: secId, limit: 36 });
        } else {
          newMovies = await getMovies({ genre: secId, limit: 36 });
        }
      } catch (_) {
        showToast('Não foi possível buscar mais títulos.');
        return;
      }
    }

    if (!newMovies || newMovies.length === 0) {
      showToast('Todos os títulos já foram adicionados.');
      return;
    }

    const appendMovies = (prevList) => {
      const existingIds = new Set(prevList.map(m => String(m.id || m.imdbId || m.title).toLowerCase()));
      const filtered = newMovies.filter(m => !existingIds.has(String(m.id || m.imdbId || m.title).toLowerCase()));
      if (filtered.length === 0) return prevList;
      return [...prevList, ...filtered];
    };

    if (activeTab === 'home') {
      if (secId === 'trending') {
        setTrendingMovies(prev => appendMovies(prev));
      } else if (isSeries) {
        setSeriesGenreSections(prev => prev.map(s => s.id === secId ? { ...s, movies: appendMovies(s.movies) } : s));
      } else {
        setGenreSections(prev => prev.map(s => s.id === secId ? { ...s, movies: appendMovies(s.movies) } : s));
      }
    } else if (activeTab === 'movies') {
      setGenreSections(prev => prev.map(s => s.id === secId ? { ...s, movies: appendMovies(s.movies) } : s));
    } else if (activeTab === 'series') {
      setSeriesGenreSections(prev => prev.map(s => s.id === secId ? { ...s, movies: appendMovies(s.movies) } : s));
    }

    showToast(`✓ Catálogo expandido em "${sec.title}"!`);
  }, [activeTab, showToast]);

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
      const sec = currentSections[rIdx];
      const hasSeeMore = sec.id !== 'continue-watching' && sec.movies.length > 0;
      return hasSeeMore ? sec.movies.length + 1 : sec.movies.length;
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
  const handlePauseDownload = useCallback(async (item) => {
    const id = item.infoHash || item.id;
    if (!id) return;
    const normId = String(id).toLowerCase();
    const previousState = {
      isPaused: item.isPaused,
      status: item.status,
      downloadSpeed: item.downloadSpeed
    };

    setDownloads(prev => prev.map(d => {
      if (String(d.infoHash || d.id || '').toLowerCase() === normId) {
        return { ...d, isPaused: true, status: 'paused', downloadSpeed: '0 B/s' };
      }
      return d;
    }));
    const result = await pauseDownload(id);
    if (!result || result.success === false) {
      setDownloads(prev => prev.map(d => (
        String(d.infoHash || d.id || '').toLowerCase() === normId
          ? { ...d, ...previousState }
          : d
      )));
      showToast(result?.error || 'Não foi possível pausar o download.');
      return;
    }
    showToast(`Download de "${item.title || 'Filme'}" pausado.`);
    refreshDownloadsInfo();
  }, [refreshDownloadsInfo, showToast]);

  const handleResumeDownload = useCallback(async (item) => {
    const id = item.infoHash || item.id;
    if (!id) return;
    const normId = String(id).toLowerCase();
    deletedDownloadIdsRef.current.delete(normId);
    const previousState = {
      isPaused: item.isPaused,
      status: item.status,
      downloadSpeed: item.downloadSpeed
    };

    setDownloads(prev => prev.map(d => {
      if (String(d.infoHash || d.id || '').toLowerCase() === normId) {
        return { ...d, isPaused: false, status: 'downloading' };
      }
      return d;
    }));
    const result = await resumeDownload(id);
    if (!result || result.success === false) {
      setDownloads(prev => prev.map(d => (
        String(d.infoHash || d.id || '').toLowerCase() === normId
          ? { ...d, ...previousState }
          : d
      )));
      showToast(result?.error || 'Não foi possível retomar o download.');
      return;
    }
    showToast(`Download de "${item.title || 'Filme'}" retomado.`);
    refreshDownloadsInfo();
  }, [refreshDownloadsInfo, showToast]);

  const handleSwitchDownloadDestination = useCallback(async (item, newDestination = 'local') => {
    const id = item.infoHash || item.id;
    if (!id) return;
    const destName = newDestination === 'drive' ? 'Google Drive' : 'Pasta Local (D:\\Filmes)';
    showToast(`Alterando destino de "${item.title || 'Filme'}" para ${destName}...`);
    const result = await switchDownloadDestination(id, newDestination);
    if (!result || result.success === false) {
      showToast(result?.error || 'Não foi possível alterar o destino.');
      return;
    }
    showToast(`Destino alterado para ${destName}. Download iniciado!`);
    refreshDownloadsInfo();
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

  const handleCancelDownload = useCallback(async (item, deleteFiles = true) => {
    if (!item) return;
    const matchedLocal = findMatchingLocalMovie(item);
    const localPath = item.filePath || item.videoPath || matchedLocal?.filePath || matchedLocal?.videoPath || '';
    const id = item.infoHash || item.id;
    if (!id && !localPath) return;
    const normId = id ? String(id).toLowerCase() : '';
    const removedIndex = id
      ? downloads.findIndex(d => String(d.infoHash || d.id || '').toLowerCase() === normId)
      : -1;

    if (id) {
      deletedDownloadIdsRef.current.add(normId);
      setDownloads(prev => {
        const next = prev.filter(d => String(d.infoHash || d.id || '').toLowerCase() !== normId);
        if (activeTab === 'downloads') {
          nav.setRowIndex?.(r => Math.max(0, Math.min(r, next.length - 1)));
          nav.setColIndex?.(0);
        }
        return next;
      });
    }

    showToast(deleteFiles ? 'Removendo download e arquivo…' : 'Removendo download da fila…');
    const result = id
      ? await deleteDownload(id, deleteFiles)
      : await deleteLocalFile(localPath);

    if (!result || result.success === false) {
      if (id) {
        deletedDownloadIdsRef.current.delete(normId);
        setDownloads(prev => {
          if (prev.some(d => String(d.infoHash || d.id || '').toLowerCase() === normId)) return prev;
          const next = [...prev];
          const insertAt = Math.max(0, Math.min(removedIndex, next.length));
          next.splice(insertAt, 0, item);
          return next;
        });
        if (activeTab === 'downloads') {
          nav.setRowIndex?.(Math.max(0, removedIndex));
          nav.setColIndex?.(0);
        }
      }
      showToast(result?.error || 'Não foi possível remover o download.');
      return;
    }

    if (deleteFiles) {
      removeLocalMovieFromState(matchedLocal || item);
      clearWatchProgress(item);
      refreshUserData();
    }

    showToast(deleteFiles
      ? `Download de "${item.title || 'Filme'}" cancelado e excluído do PC.`
      : `Download de "${item.title || 'Filme'}" removido da fila.`);

    if (id) {
      refreshDownloadsInfo();
      if (deleteFiles) refreshLocalLibrary();
    }
  }, [activeTab, downloads, findMatchingLocalMovie, refreshDownloadsInfo, refreshLocalLibrary, showToast, removeLocalMovieFromState, refreshUserData]);

  // Exclusão ultra-responsiva de arquivo local (0ms na interface)
  const executeDeleteLocalMovie = useCallback(async (target) => {
    if (!target) return;
    const matchedLocal = findMatchingLocalMovie(target);
    const fPath = target.filePath || target.videoPath || matchedLocal?.filePath || matchedLocal?.videoPath || target.savePath || '';
    if (!fPath) {
      showToast('O caminho do arquivo n\u00e3o foi encontrado. Atualize a biblioteca e tente novamente.');
      return;
    }

    setConfirmDeleteMode(false);
    setQuickMenuMovie(null);
    setSelectedMovie(null);
    const displayTitle = target.title || target.cleanName || matchedLocal?.title || 'Arquivo';
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
    const normalizedPath = String(fPath).toLowerCase().trim();
    const normalizedDlId = dlId ? String(dlId).toLowerCase() : '';
    const removedDownloadIndex = dlId
      ? downloads.findIndex(d => String(d.infoHash || d.id || '').toLowerCase() === normalizedDlId)
      : -1;

    removeLocalMovieFromState(matchedLocal ? { ...target, filePath: fPath } : target);
    if (activeTab === 'local') nav.setColIndex?.(c => Math.max(0, c - 1));
    if (dlId) {
      deletedDownloadIdsRef.current.add(normalizedDlId);
      setDownloads(prev => prev.filter(d => String(d.infoHash || d.id || '').toLowerCase() !== normalizedDlId));
    }

    showToast('Excluindo "' + displayTitle + '"...');
    const result = dlId
      ? await deleteDownload(dlId, true)
      : await deleteLocalFile(fPath);

    if (!result || result.success === false) {
      deletedLocalPathsRef.current.delete(normalizedPath);
      if (dlId) {
        deletedDownloadIdsRef.current.delete(normalizedDlId);
        const isTorrentHash = /^[a-f0-9]{40}$/i.test(String(target.id || ''));
        const downloadToRestore = matchedDl || (target.infoHash || isTorrentHash ? target : null);
        if (downloadToRestore) {
          setDownloads(prev => {
            if (prev.some(d => String(d.infoHash || d.id || '').toLowerCase() === normalizedDlId)) return prev;
            const next = [...prev];
            const insertAt = Math.max(0, Math.min(removedDownloadIndex, next.length));
            next.splice(insertAt, 0, downloadToRestore);
            return next;
          });
        }
      }
      refreshLocalLibrary();
      showToast(result?.error || 'N\u00e3o foi poss\u00edvel excluir o arquivo.');
      return;
    }

    clearWatchProgress(target);
    refreshUserData();
    showToast('"' + displayTitle + '" exclu\u00eddo do computador!');
    if (dlId) refreshDownloadsInfo();
    refreshLocalLibrary();
  }, [activeTab, downloads, findMatchingLocalMovie, removeLocalMovieFromState, refreshUserData, showToast, refreshDownloadsInfo, refreshLocalLibrary]);


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
        }
      }
    } else if (zone === 'search-results') {
      if (searchInputRef.current && searchInputRef.current.getResult) {
        target = searchInputRef.current.getResult(resultsColIndex);
      }
    }
    if (target) {
      setSelectedMovie(target);
    }
  }, [activeTab, heroMovie, downloads, favoritesGridRows, localGridRows, currentSections]);

  // 4. Integração do Hook Espacial Ultra-Rápido
  const nav = useSpatialNav({
    isPlayerOpen: Boolean(activeStream),
    isModalOpen: Boolean(selectedMovie),
    isSeeMoreOpen: false,
    modalActionRef,
    modalStreamBaseIndex,
    activeTab,
    hasHero: activeTab === 'home' && Boolean(heroMovie),
    rowCount,
    getColCount,
    headerCount: NAV_ITEMS.length,
    localFilterCount: localFilters.length,
    modalItemsCount,
    searchActionRef: searchInputRef,
    onLongPress: handleLongPress,
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
    onBack: (context = {}) => {
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
      // Se estiver em qualquer aba secundária (Filmes, Séries, etc.) e não for saída raiz,
      // deixa o useSpatialNav voltar para a aba Início
      if (activeTab !== 'home' && !context.isRootExit) {
        return false;
      }
      // Pressionar voltar duas vezes na Home fecha o app diretamente, sem nenhum modal
      const now = Date.now();
      if (lastBackPressRef.current && (now - lastBackPressRef.current) < 2500) {
        confirmAppExit();
        return true;
      }
      lastBackPressRef.current = now;
      showToast('Pressione Voltar novamente para sair do Cinelar.');
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
        handlePlayMovieDirect(heroMovie);
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
          } else if (serverStatus !== 'online') {
            retryServerConnection();
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
            handlePlayMovieDirect(mov);
          }
          return;
        }

        const sec = currentSections[rowIndex];
        if (sec && sec.movies) {
          const hasSeeMore = sec.id !== 'continue-watching' && sec.movies.length > 0;
          if (hasSeeMore && colIndex === sec.movies.length) {
            handleOpenSeeMore(sec);
            return;
          }
          if (sec.movies[colIndex]) {
            const mov = sec.movies[colIndex];
            if (sec.id === 'continue-watching') {
              handlePlayMovieDirect(mov);
            } else if (isPlayKey) {
              handlePlayMovieDirect(mov);
            } else {
              setSelectedMovie(mov);
            }
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
        const result = searchInputRef.current?.getResult?.(resultsColIndex);
        if (result) searchInputRef.current?.selectResult?.(resultsColIndex);
        else if (serverStatus !== 'online') retryServerConnection();
        return;
      }
    }
  });

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const idx = NAV_ITEMS.findIndex(i => i.id === tabId);
    if (idx !== -1) nav.setHeaderIndex(idx);
  };

  const handleOpenSeeMore = useCallback((sec) => {
    if (!sec) return;
    const secId = String(sec.id || '').toLowerCase();
    const title = String(sec.title || '').toLowerCase();

    // 1. Seção do Disco Local (PC / D:\Filmes): navega para a aba Local com filtro de Pasta Local
    if (secId === 'local-quick' || secId.includes('local') || title.includes('disco local') || title.includes('d:\\filmes') || title.includes('pasta local')) {
      setLocalFilterId('local-only');
      nav.setLocalFilterIndex(0);
      nav.setRowIndex(0);
      nav.setColIndex(0);
      nav.setActiveZone('rows');
      handleSelectTab('local');
      showToast('Exibindo filmes salvos no computador (D:\\Filmes)...');
      return;
    }

    // 2. Seção do Google Drive (Nuvem): navega para a aba Local com filtro de Google Drive
    if (secId === 'drive-quick' || secId.includes('drive') || title.includes('google drive') || title.includes('nuvem')) {
      setLocalFilterId('gdrive');
      nav.setLocalFilterIndex(1);
      nav.setRowIndex(0);
      nav.setColIndex(0);
      nav.setActiveZone('rows');
      handleSelectTab('local');
      refreshDriveLibrary();
      showToast('Exibindo filmes da Nuvem (Google Drive)...');
      return;
    }

    // 3. Minha Lista / Favoritos: navega para a aba de Favoritos
    if (secId === 'my-list' || secId === 'favorites' || title.includes('minha lista') || title.includes('favoritos')) {
      nav.setRowIndex(0);
      nav.setColIndex(0);
      nav.setActiveZone('rows');
      handleSelectTab('favorites');
      return;
    }

    // 4. Séries em Destaque / Séries: navega para a aba de Séries
    if (sec.isSeries || secId === 'series-popular' || secId.startsWith('series') || title.includes('série')) {
      handleSelectTab('series');
      const targetRow = seriesGenreSections.findIndex(s => s.id === sec.id || s.title?.toLowerCase() === sec.title?.toLowerCase());
      if (targetRow !== -1) {
        nav.setRowIndex(targetRow);
        nav.setColIndex(0);
      } else {
        nav.setRowIndex(0);
        nav.setColIndex(0);
      }
      nav.setActiveZone('rows');
      showToast(`Abrindo catálogo de séries: ${sec.title || ''}...`);
      return;
    }

    // 5. Categorias de Filmes vindas da Home: navega para a aba Filmes focando na categoria
    if (activeTab === 'home') {
      handleSelectTab('movies');
      const targetRow = genreSections.findIndex(s => s.id === sec.id || s.title?.toLowerCase() === sec.title?.toLowerCase());
      if (targetRow !== -1) {
        nav.setRowIndex(targetRow);
        nav.setColIndex(0);
      } else {
        nav.setRowIndex(0);
        nav.setColIndex(0);
      }
      nav.setActiveZone('rows');
      showToast(`Filtrando filmes por ${sec.title || 'categoria'}...`);
      return;
    }

    // 6. Se já estiver na aba de Filmes ou Séries: carrega mais filmes direto na fileira sem abrir modal!
    handleLoadMoreInRow(sec);
  }, [genreSections, seriesGenreSections, activeTab, nav, handleLoadMoreInRow, refreshDriveLibrary, showToast]);

  const handleNavigateToDriveSettings = useCallback(() => {
    handleSelectTab('settings');
    nav.setRowIndex(1); // Categoria Google Drive
    nav.setColIndex(0);
    nav.setActiveZone('rows');
    showToast('Abrindo configurações da Nuvem Google Drive...');
  }, [handleSelectTab, nav, showToast]);

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
                sections={enrichedHomeSections}
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
                onContextMenuMovie={(mov) => setSelectedMovie(mov)}
                onPlayHero={() => handlePlayMovieDirect(heroMovie)}
                onInfoHero={() => setSelectedMovie(heroMovie)}
                onSeeMore={handleOpenSeeMore}
                isLoading={isHomeLoading}
                serverStatus={serverStatus}
                onRetryConnection={retryServerConnection}
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
                genreSections={enrichedGenreSections}
                activeZone={nav.activeZone}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectMovie={setSelectedMovie}
                onContextMenuMovie={(mov) => setSelectedMovie(mov)}
                onSeeMore={handleOpenSeeMore}
                serverStatus={serverStatus}
                isLoading={isMoviesLoading}
                onRetryConnection={retryServerConnection}
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
                genreSections={enrichedSeriesGenreSections}
                activeZone={nav.activeZone}
                rowIndex={nav.rowIndex}
                colIndex={nav.colIndex}
                onSelectSeries={setSelectedMovie}
                onContextMenuMovie={(mov) => setSelectedMovie(mov)}
                onSeeMore={handleOpenSeeMore}
                serverStatus={serverStatus}
                isLoading={isSeriesLoading}
                onRetryConnection={retryServerConnection}
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
                onContextMenuMovie={(mov) => setSelectedMovie(mov)}
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
                onSelectMovie={handlePlayMovieDirect}
                onContextMenuMovie={(mov) => setSelectedMovie(mov)}
                onOpenDriveConfig={handleNavigateToDriveSettings}
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
                serverStatus={serverStatus}
                onRetryConnection={retryServerConnection}
                onPlayDownload={handlePlayMovieDirect}
                onPauseDownload={handlePauseDownload}
                onResumeDownload={handleResumeDownload}
                onCancelDownload={handleCancelDownload}
                onSwitchDestination={handleSwitchDownloadDestination}
                onContextMenu={(mov) => setSelectedMovie(mov)}
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
                serverStatus={serverStatus}
                onRetryConnection={retryServerConnection}
                enrichMovie={enrichMovieWithLocalStatus}
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
            movie={selectedMovie ? enrichMovieWithLocalStatus(selectedMovie) : null}
            storage={downloadsStorage}
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
        />
      )}



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
      {!activeStream && !selectedMovie && (
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
