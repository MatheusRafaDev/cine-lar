import { useState, useEffect, useCallback, useRef } from 'react';
import { NAV_ITEMS } from '../components/Header';

// Mapeamento oficial de teclas Tizen e navegadores
export const KEYS = {
  ENTER: 13,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  BACK_TIZEN: 10009,
  BACK_ESC: 27,
  BACKSPACE: 8,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_STOP: 413,
  MEDIA_RW: 412,
  MEDIA_FF: 417
};

export function useSpatialNav({
  isPlayerOpen = false,
  isModalOpen = false,
  modalActionRef = null,
  modalStreamBaseIndex = 3,
  isQuickMenuOpen = false,
  quickMenuCount = 4,
  activeTab = 'home',
  hasHero = true,
  rowCount = 1,
  getColCount = null,
  headerCount = 7,
  localFilterCount = 0,
  modalItemsCount = 3,
  searchActionRef = null,
  onBack = null,
  onEnter = null,
  onLongPress = null,
  onCloseQuickMenu = null,
  onQuickMenuSelect = null,
  onTabChange = null,
  onLocalFilterChange = null
}) {
  const [activeZone, setActiveZone] = useState('rows'); // 'header' | 'hero' | 'rows' | 'modal' | 'player' | 'search-keyboard' | 'search-results' | 'local-filters'
  const [headerIndex, setHeaderIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [rowIndex, setRowIndex] = useState(0);
  const [colIndex, setColIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState(0);
  const [quickMenuIndex, setQuickMenuIndex] = useState(0);
  const [localFilterIndex, setLocalFilterIndex] = useState(0);

  // Estados específicos para a busca
  const [searchRowIndex, setSearchRowIndex] = useState(0);
  const [searchColIndex, setSearchColIndex] = useState(0);
  const [resultsColIndex, setResultsColIndex] = useState(0);

  // Refs de controle de long press para o botão OK (segurar abre menu de ações)
  const enterLongPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const pendingCardEnterRef = useRef(false);

  // Ref persistente com todo o estado e props para acesso O(1) no event listener sem recriar
  const stateRef = useRef({});
  stateRef.current = {
    isPlayerOpen,
    isModalOpen,
    modalActionRef,
    modalStreamBaseIndex,
    isQuickMenuOpen,
    quickMenuCount,
    activeZone,
    activeTab,
    hasHero,
    rowCount,
    getColCount,
    headerCount,
    localFilterCount,
    modalItemsCount,
    searchActionRef,
    headerIndex,
    heroIndex,
    rowIndex,
    colIndex,
    modalIndex,
    quickMenuIndex,
    localFilterIndex,
    searchRowIndex,
    searchColIndex,
    resultsColIndex,
    onBack,
    onEnter,
    onLongPress,
    onCloseQuickMenu,
    onQuickMenuSelect,
    onTabChange,
    onLocalFilterChange
  };

  const lastKeyRef = useRef({ code: 0, time: 0 });

  // Troca de aba adiada ao percorrer o header: evita montar/desmontar uma tela inteira
  // (dezenas de cards e imagens) a cada toque de seta. A aba so e trocada quando o usuario
  // para no item (TAB_SWITCH_DELAY) ou confirma com OK / seta para baixo.
  const TAB_SWITCH_DELAY = 280;
  const tabChangeTimerRef = useRef(null);
  const pendingDescendRef = useRef(false);

  const scheduleTabChange = (idx) => {
    if (tabChangeTimerRef.current) clearTimeout(tabChangeTimerRef.current);
    tabChangeTimerRef.current = setTimeout(() => {
      tabChangeTimerRef.current = null;
      stateRef.current.onTabChange?.(idx);
    }, TAB_SWITCH_DELAY);
  };

  // Aplica imediatamente uma troca de aba pendente. Retorna true se a aba vai mudar
  // (nesse caso a descida para o conteudo acontece apos a nova aba renderizar).
  const flushTabChange = () => {
    if (!tabChangeTimerRef.current) return false;
    clearTimeout(tabChangeTimerRef.current);
    tabChangeTimerRef.current = null;
    const idx = stateRef.current.headerIndex;
    const item = NAV_ITEMS[idx];
    if (item && item.id !== stateRef.current.activeTab) {
      pendingDescendRef.current = true;
      stateRef.current.onTabChange?.(idx);
      return true;
    }
    return false;
  };

  useEffect(() => () => {
    if (tabChangeTimerRef.current) clearTimeout(tabChangeTimerRef.current);
  }, []);

  // 1. Registro permanente de teclas de mídia e controle no sistema Tizen da Samsung
  useEffect(() => {
    if (typeof window !== 'undefined' && window.tizen && window.tizen.tvinputdevice) {
      const tvKeys = [
        'MediaPlay', 'MediaPause', 'MediaStop', 'MediaPlayPause',
        'MediaRewind', 'MediaFastForward',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
        'Caption', 'Info'
      ];
      tvKeys.forEach(k => {
        try {
          window.tizen.tvinputdevice.registerKey(k);
        } catch (_) {}
      });
    }
  }, []);

  // Memória persistente de foco para restauração 100% fiel ao voltar de modal, player ou troca de abas
  const savedFocusBeforeOverlayRef = useRef(null);
  const prevTabRef = useRef(activeTab);
  const tabPositionsRef = useRef({
    home: { activeZone: 'hero', heroIndex: 0, rowIndex: 0, colIndex: 0 },
    movies: { activeZone: 'rows', rowIndex: 0, colIndex: 0 },
    series: { activeZone: 'rows', rowIndex: 0, colIndex: 0 },
    favorites: { activeZone: 'rows', rowIndex: 0, colIndex: 0 },
    local: { activeZone: 'rows', rowIndex: 0, colIndex: 0, localFilterIndex: 0 },
    downloads: { activeZone: 'rows', rowIndex: 0, colIndex: 0 },
    search: { activeZone: 'search-keyboard', searchRowIndex: 0, searchColIndex: 0, resultsColIndex: 0 },
    settings: { activeZone: 'rows', rowIndex: 0, colIndex: 0 }
  });

  // 2. Transições de zona para Modal, Player e Menu de Ações (com memória cirúrgica da posição exata)
  useEffect(() => {
    const isOverlayActive = isPlayerOpen || isModalOpen;

    if (isOverlayActive) {
      // Salva snapshot da posição exata do card antes de abrir modal ou player
      if (!savedFocusBeforeOverlayRef.current) {
        const curZone = stateRef.current.activeZone;
        const validZone = (curZone === 'modal' || curZone === 'player') ? 'rows' : curZone;
        savedFocusBeforeOverlayRef.current = {
          activeZone: validZone,
          heroIndex: stateRef.current.heroIndex,
          rowIndex: stateRef.current.rowIndex,
          colIndex: stateRef.current.colIndex,
          localFilterIndex: stateRef.current.localFilterIndex,
          searchRowIndex: stateRef.current.searchRowIndex,
          searchColIndex: stateRef.current.searchColIndex,
          resultsColIndex: stateRef.current.resultsColIndex
        };
      }

      if (isPlayerOpen) {
        setActiveZone('player');
        stateRef.current.activeZone = 'player';
      } else if (isModalOpen) {
        setActiveZone('modal');
        stateRef.current.activeZone = 'modal';
        setModalIndex(0);
        stateRef.current.modalIndex = 0;
      }
    } else {
      // Quando AMBOS fecham (voltar do modal ou voltar do player), restaura exatamente o card onde o usuário estava
      const saved = savedFocusBeforeOverlayRef.current || tabPositionsRef.current[activeTab];
      savedFocusBeforeOverlayRef.current = null;

      if (saved) {
        const targetZone = (saved.activeZone === 'modal' || saved.activeZone === 'player') ? 'rows' : (saved.activeZone || 'rows');
        setActiveZone(targetZone);
        stateRef.current.activeZone = targetZone;

        setRowIndex(saved.rowIndex || 0);
        stateRef.current.rowIndex = saved.rowIndex || 0;

        setColIndex(saved.colIndex || 0);
        stateRef.current.colIndex = saved.colIndex || 0;

        setHeroIndex(saved.heroIndex || 0);
        stateRef.current.heroIndex = saved.heroIndex || 0;

        setLocalFilterIndex(saved.localFilterIndex || 0);
        stateRef.current.localFilterIndex = saved.localFilterIndex || 0;

        setSearchRowIndex(saved.searchRowIndex || 0);
        stateRef.current.searchRowIndex = saved.searchRowIndex || 0;

        setSearchColIndex(saved.searchColIndex || 0);
        stateRef.current.searchColIndex = saved.searchColIndex || 0;

        setResultsColIndex(saved.resultsColIndex || 0);
        stateRef.current.resultsColIndex = saved.resultsColIndex || 0;
      } else {
        setActiveZone(prev => (prev === 'modal' || prev === 'player') ? 'rows' : prev);
      }
    }
  }, [isPlayerOpen, isModalOpen, activeTab]);

  useEffect(() => {
    if (isQuickMenuOpen) {
      setQuickMenuIndex(0);
      stateRef.current.quickMenuIndex = 0;
    }
  }, [isQuickMenuOpen]);

  // 2.5. Salva continuamente a posição exata da navegação enquanto o usuário percorre o conteúdo
  useEffect(() => {
    if (activeZone !== 'modal' && activeZone !== 'player' && activeZone !== 'header') {
      tabPositionsRef.current[activeTab] = {
        activeZone,
        heroIndex,
        rowIndex,
        colIndex,
        localFilterIndex,
        searchRowIndex,
        searchColIndex,
        resultsColIndex
      };
    }
  }, [activeZone, activeTab, heroIndex, rowIndex, colIndex, localFilterIndex, searchRowIndex, searchColIndex, resultsColIndex]);

  // Função centralizada para descer do header direto para a posição exata salva naquela aba
  const descendFromHeader = useCallback(() => {
    const s = stateRef.current;
    const savedTab = tabPositionsRef.current[s.activeTab];
    if (s.activeTab === 'home' && s.hasHero && (!savedTab || savedTab.activeZone === 'hero')) {
      setActiveZone('hero');
      stateRef.current.activeZone = 'hero';
    } else if (s.activeTab === 'search') {
      const targetZone = savedTab?.activeZone || 'search-keyboard';
      setActiveZone(targetZone);
      stateRef.current.activeZone = targetZone;
    } else if (s.activeTab === 'local' && (!savedTab || savedTab.activeZone === 'local-filters')) {
      setActiveZone('local-filters');
      stateRef.current.activeZone = 'local-filters';
    } else {
      setActiveZone('rows');
      stateRef.current.activeZone = 'rows';
      const r = savedTab ? Math.min(Math.max(0, s.rowCount - 1), savedTab.rowIndex || 0) : 0;
      const maxC = s.getColCount ? s.getColCount(r) : 1;
      const c = savedTab ? Math.min(Math.max(0, maxC - 1), savedTab.colIndex || 0) : 0;
      setRowIndex(r);
      setColIndex(c);
      stateRef.current.rowIndex = r;
      stateRef.current.colIndex = c;
    }
  }, []);

  // 3. Sincronização de zona ao trocar de aba (somente quando a aba realmente muda, preservando posições)
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;

    // Salva a posição exata da aba anterior para restauração futura
    const oldTab = prevTabRef.current;
    if (oldTab) {
      tabPositionsRef.current[oldTab] = {
        activeZone: stateRef.current.activeZone,
        heroIndex: stateRef.current.heroIndex,
        rowIndex: stateRef.current.rowIndex,
        colIndex: stateRef.current.colIndex,
        localFilterIndex: stateRef.current.localFilterIndex,
        searchRowIndex: stateRef.current.searchRowIndex,
        searchColIndex: stateRef.current.searchColIndex,
        resultsColIndex: stateRef.current.resultsColIndex
      };
    }
    prevTabRef.current = activeTab;

    // Sincroniza o índice do header com a tab atual
    const tabIdx = NAV_ITEMS.findIndex(item => item.id === activeTab);
    if (tabIdx >= 0) {
      setHeaderIndex(tabIdx);
      stateRef.current.headerIndex = tabIdx;
    }

    if (pendingDescendRef.current) {
      // Usuario confirmou (OK / seta para baixo) antes da troca adiada: desce direto para o conteudo da nova aba
      pendingDescendRef.current = false;
      descendFromHeader();
      return;
    }

    if (stateRef.current.activeZone === 'header') return;

    // Restaura a posição salva para a nova aba
    const saved = tabPositionsRef.current[activeTab];
    if (saved) {
      setActiveZone(saved.activeZone);
      stateRef.current.activeZone = saved.activeZone;

      setRowIndex(saved.rowIndex || 0);
      stateRef.current.rowIndex = saved.rowIndex || 0;

      setColIndex(saved.colIndex || 0);
      stateRef.current.colIndex = saved.colIndex || 0;

      setHeroIndex(saved.heroIndex || 0);
      stateRef.current.heroIndex = saved.heroIndex || 0;

      setLocalFilterIndex(saved.localFilterIndex || 0);
      stateRef.current.localFilterIndex = saved.localFilterIndex || 0;
    } else {
      if (activeTab === 'search') {
        setSearchRowIndex(0);
        setSearchColIndex(0);
        setActiveZone('search-keyboard');
      } else if (activeTab === 'home' && hasHero) {
        setHeroIndex(0);
        setRowIndex(0);
        setColIndex(0);
        setActiveZone('hero');
      } else {
        setRowIndex(0);
        setColIndex(0);
        setActiveZone('rows');
      }
    }
  }, [activeTab, hasHero]);

  // 4. Manipulador global persistente de teclas (SINGLE LISTENER - ZERO GC CHURN)
  const handleKeyDown = useCallback((e) => {
    const s = stateRef.current;
    const code = e.keyCode || e.which || 0;
    const key = e.key || '';

    // Debounce de 55ms apenas para repetição contínua da mesma tecla (evita fila de eventos travando a TV)
    const now = Date.now();
    if (lastKeyRef.current.code === code && now - lastKeyRef.current.time < 55) {
      e.preventDefault();
      return;
    }
    lastKeyRef.current = { code, time: now };

    const isBack = code === KEYS.BACK_TIZEN || code === KEYS.BACK_ESC || code === KEYS.BACKSPACE || key === 'Back' || key === 'Escape';
    const isEnter = code === KEYS.ENTER || key === 'Enter';
    const isPlayPause = code === KEYS.MEDIA_PLAY_PAUSE || code === KEYS.MEDIA_PLAY || key === 'MediaPlayPause' || key === 'MediaPlay' || key === ' ';
    const isLeft = code === KEYS.LEFT || key === 'ArrowLeft';
    const isRight = code === KEYS.RIGHT || key === 'ArrowRight';
    const isUp = code === KEYS.UP || key === 'ArrowUp';
    const isDown = code === KEYS.DOWN || key === 'ArrowDown';

    // Teclas Coloridas do Controle Remoto da TV (Samsung / Tizen)
    const isRedKey = code === 403 || key === 'ColorF0Red';
    const isGreenKey = code === 404 || key === 'ColorF1Green';
    const isYellowKey = code === 405 || key === 'ColorF2Yellow';
    const isBlueKey = code === 406 || key === 'ColorF3Blue';

    if (!s.isPlayerOpen && !s.isModalOpen && !s.isQuickMenuOpen) {
      if (isRedKey) {
        e.preventDefault();
        e.stopPropagation();
        s.onTabChange?.(6); // Buscar
        return;
      }
      if (isGreenKey) {
        e.preventDefault();
        e.stopPropagation();
        s.onTabChange?.(4); // Pasta Local / Google Drive
        return;
      }
      if (isYellowKey) {
        e.preventDefault();
        e.stopPropagation();
        s.onTabChange?.(3); // Favoritos / Minha Lista
        return;
      }
      if (isBlueKey) {
        e.preventDefault();
        e.stopPropagation();
        s.onTabChange?.(5); // Downloads
        return;
      }
    }

    // Digitação direta em teclado USB / controle com teclado quando na aba de busca
    if (s.activeTab === 'search' && !s.isModalOpen && !s.isPlayerOpen && !s.isQuickMenuOpen) {
      if (key && key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && code !== 13) {
        e.preventDefault();
        e.stopPropagation();
        s.searchActionRef?.current?.typeDirect?.(key.toUpperCase());
        return;
      }
      if (code === 8 && s.activeZone === 'search-keyboard') {
        e.preventDefault();
        e.stopPropagation();
        s.searchActionRef?.current?.typeDirect?.('APAGAR');
        return;
      }
    }

    // Cancela detecção de long press se o usuário navegar ou apertar voltar
    if (isBack || isLeft || isRight || isUp || isDown) {
      if (enterLongPressTimerRef.current) {
        clearTimeout(enterLongPressTimerRef.current);
        enterLongPressTimerRef.current = null;
      }
      longPressTriggeredRef.current = false;
      pendingCardEnterRef.current = false;
    }

    // A0. Prioridade Absoluta: Menu de Ações Rápidas aberto
    if (s.isQuickMenuOpen) {
      pendingCardEnterRef.current = false;
      if (enterLongPressTimerRef.current) {
        clearTimeout(enterLongPressTimerRef.current);
        enterLongPressTimerRef.current = null;
      }
      if (isBack) {
        e.preventDefault();
        e.stopPropagation();
        s.onCloseQuickMenu?.();
        return;
      }
      if (isEnter) {
        e.preventDefault();
        e.stopPropagation();
        s.onQuickMenuSelect?.(s.quickMenuIndex);
        return;
      }
      if (isUp) {
        e.preventDefault();
        setQuickMenuIndex(prev => {
          const next = Math.max(0, prev - 1);
          stateRef.current.quickMenuIndex = next;
          return next;
        });
        return;
      }
      if (isDown) {
        e.preventDefault();
        setQuickMenuIndex(prev => {
          const maxIdx = Math.max(0, (s.quickMenuCount || 1) - 1);
          const next = Math.min(maxIdx, prev + 1);
          stateRef.current.quickMenuIndex = next;
          return next;
        });
        return;
      }
      return;
    }

    // A1. Prioridade Absoluta: Modal de Detalhes do Filme ou Série aberto
    if (s.isModalOpen) {
      pendingCardEnterRef.current = false;
      if (enterLongPressTimerRef.current) {
        clearTimeout(enterLongPressTimerRef.current);
        enterLongPressTimerRef.current = null;
      }
      // 1. Se houver sub-diálogo aberto dentro do modal (Escolher Versão para Download ou Opções para esta Versão)
      if (s.modalActionRef?.current?.isSubDialogOpen?.()) {
        if (isBack) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleBack?.();
          return;
        }
        if (isUp) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleSubNav?.(-1);
          return;
        }
        if (isDown) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleSubNav?.(1);
          return;
        }
        if (isLeft) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleSubDir?.(-1);
          return;
        }
        if (isRight) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleSubDir?.(1);
          return;
        }
        if (isEnter) {
          e.preventDefault();
          e.stopPropagation();
          s.modalActionRef.current.handleSubEnter?.();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 2. Tecla Voltar dentro do Modal de Detalhes: fecha o modal e restaura o foco na área de conteúdo (rows/hero)
      if (isBack) {
        e.preventDefault();
        e.stopPropagation();
        const handledBySub = s.onBack?.();
        if (handledBySub) return;
        setActiveZone(prev => (prev === 'modal' ? 'rows' : prev));
        return;
      }

      if (isEnter) {
        e.preventDefault();
        e.stopPropagation();
        s.onEnter?.({ zone: 'modal', index: s.modalIndex, isPlayKey: false });
        return;
      }

      if (isPlayPause) {
        e.preventDefault();
        e.stopPropagation();
        s.onEnter?.({ zone: 'modal', index: 0, isPlayKey: true });
        return;
      }

      const baseIdx = s.modalStreamBaseIndex || 3;
      const totalItems = s.modalItemsCount || 3;

      if (isLeft) {
        e.preventDefault();
        e.stopPropagation();
        // Na barra horizontal de botões: navega para a esquerda
        if (s.modalIndex < baseIdx) {
          setModalIndex(prev => {
            const next = Math.max(0, prev - 1);
            stateRef.current.modalIndex = next;
            return next;
          });
        }
        return;
      }

      if (isRight) {
        e.preventDefault();
        e.stopPropagation();
        // Na barra horizontal de botões: navega para a direita
        if (s.modalIndex < baseIdx) {
          setModalIndex(prev => {
            const next = Math.min(baseIdx - 1, prev + 1);
            stateRef.current.modalIndex = next;
            return next;
          });
        }
        return;
      }

      if (isDown) {
        e.preventDefault();
        e.stopPropagation();
        if (s.modalIndex < baseIdx) {
          // Desce da linha de botões para o primeiro stream (se houver streams)
          if (totalItems > baseIdx) {
            setModalIndex(baseIdx);
            stateRef.current.modalIndex = baseIdx;
          }
        } else {
          // Desce na lista vertical de streams
          setModalIndex(prev => {
            const next = Math.min(totalItems - 1, prev + 1);
            stateRef.current.modalIndex = next;
            return next;
          });
        }
        return;
      }

      if (isUp) {
        e.preventDefault();
        e.stopPropagation();
        if (s.modalIndex >= baseIdx) {
          // Se está no primeiro stream, sobe de volta para o primeiro botão de ação
          if (s.modalIndex === baseIdx) {
            setModalIndex(0);
            stateRef.current.modalIndex = 0;
          } else {
            // Sobe na lista vertical de streams
            setModalIndex(prev => {
              const next = prev - 1;
              stateRef.current.modalIndex = next;
              return next;
            });
          }
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // A. Prioridade Máxima: Botão Voltar (Tizen / Esc / Backspace)
    if (isBack) {
      e.preventDefault();
      e.stopPropagation();

      // 1. Player fullscreen aberto: fecha o player
      if (s.isPlayerOpen) {
        s.onBack?.();
        return;
      }

      // 2. Se o foco está em qualquer área de conteúdo (rows, local-filters, hero, busca):
      if (s.activeZone !== 'header') {
        const handled = s.onBack?.();
        if (handled) return;

        // Salva a posição exata antes de subir para o header
        tabPositionsRef.current[s.activeTab] = {
          activeZone: s.activeZone,
          heroIndex: s.heroIndex,
          rowIndex: s.rowIndex,
          colIndex: s.colIndex,
          localFilterIndex: s.localFilterIndex,
          searchRowIndex: s.searchRowIndex,
          searchColIndex: s.searchColIndex,
          resultsColIndex: s.resultsColIndex
        };

        const tabIdx = NAV_ITEMS.findIndex(item => item.id === s.activeTab);
        const targetHeaderIdx = tabIdx >= 0 ? tabIdx : 0;
        setHeaderIndex(targetHeaderIdx);
        stateRef.current.headerIndex = targetHeaderIdx;
        setActiveZone('header');
        stateRef.current.activeZone = 'header';
        return;
      }

      // 3. Se o usuário JÁ ESTÁ no header e não está na aba Início, volta para Início
      if (tabChangeTimerRef.current) {
        clearTimeout(tabChangeTimerRef.current);
        tabChangeTimerRef.current = null;
      }
      if (s.activeTab !== 'home' || s.headerIndex !== 0) {
        setHeaderIndex(0);
        stateRef.current.headerIndex = 0;
        s.onTabChange?.(0);
        return;
      }

      // 4. Se já está no header na aba Início, chama onBack para fechar o app Tizen
      s.onBack?.();
      return;
    }

    // B. Player Fullscreen aberto (CinemaPlayer gerencia todas as teclas internamente em capture phase)
    if (s.isPlayerOpen) {
      return;
    }

    // D. Tecla Play/Pause dedicada fora do player
    if (isPlayPause) {
      e.preventDefault();
      s.onEnter?.({
        zone: s.activeZone,
        headerIndex: s.headerIndex,
        heroIndex: s.heroIndex,
        rowIndex: s.rowIndex,
        colIndex: s.colIndex,
        filterIndex: s.localFilterIndex,
        searchRowIndex: s.searchRowIndex,
        searchColIndex: s.searchColIndex,
        resultsColIndex: s.resultsColIndex,
        isPlayKey: true
      });
      return;
    }

    // E. Botão Enter (OK central)
    if (isEnter) {
      e.preventDefault();

      const isDownloadActionButton = s.activeTab === 'downloads' && s.activeZone === 'rows' && s.colIndex > 0;
      const isSettingsTab = s.activeTab === 'settings';
      const isCardZone = !isDownloadActionButton && !isSettingsTab && (s.activeZone === 'rows' || s.activeZone === 'hero' || s.activeZone === 'search-results');

      // Se não for zona de cards (ex: header, local-filters, search-keyboard, modal, ou botões de ação em Downloads), dispara imediato no keydown
      if (!isCardZone) {
        pendingCardEnterRef.current = false;
        if (s.activeZone === 'header' && flushTabChange()) return;
        s.onEnter?.({
          zone: s.activeZone,
          headerIndex: s.headerIndex,
          heroIndex: s.heroIndex,
          rowIndex: s.rowIndex,
          colIndex: s.colIndex,
          filterIndex: s.localFilterIndex,
          searchRowIndex: s.searchRowIndex,
          searchColIndex: s.searchColIndex,
          resultsColIndex: s.resultsColIndex,
          isPlayKey: false
        });
        return;
      }

      // Se o long press já disparou e o usuário continua segurando OK na TV, ignora
      if (longPressTriggeredRef.current) {
        pendingCardEnterRef.current = false;
        return;
      }

      // Se o timer de long press já está ativo, é repetição de keydown do controle da TV Samsung ->
      // NÃO cancela e NÃO reinicia o timer! Permite que o timer complete os 400ms!
      if (enterLongPressTimerRef.current) {
        return;
      }

      // Primeiro keydown na zona de cards: marca intenção de clique no card e agenda detecção de long press (400ms)
      longPressTriggeredRef.current = false;
      pendingCardEnterRef.current = true;

      enterLongPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        pendingCardEnterRef.current = false;
        enterLongPressTimerRef.current = null;
        s.onLongPress?.({
          zone: s.activeZone,
          headerIndex: s.headerIndex,
          heroIndex: s.heroIndex,
          rowIndex: s.rowIndex,
          colIndex: s.colIndex,
          filterIndex: s.localFilterIndex,
          resultsColIndex: s.resultsColIndex
        });
      }, 400);
      return;
    }

    // F. D-Pad SETA PARA CIMA
    if (isUp) {
      e.preventDefault();
      if (s.activeZone === 'rows') {
        if (s.rowIndex > 0) {
          setRowIndex(r => {
            const nextR = r - 1;
            stateRef.current.rowIndex = nextR;
            if (s.getColCount) {
              const maxC = s.getColCount(nextR);
              setColIndex(c => {
                const nextC = Math.min(Math.max(0, maxC - 1), c);
                stateRef.current.colIndex = nextC;
                return nextC;
              });
            }
            return nextR;
          });
        } else if (s.activeTab === 'local') {
          setActiveZone('local-filters');
          stateRef.current.activeZone = 'local-filters';
        } else if (s.activeTab === 'home' && s.hasHero) {
          setActiveZone('hero');
          stateRef.current.activeZone = 'hero';
        } else {
          setActiveZone('header');
          stateRef.current.activeZone = 'header';
        }
      } else if (s.activeZone === 'local-filters') {
        setActiveZone('header');
        stateRef.current.activeZone = 'header';
      } else if (s.activeZone === 'hero') {
        setActiveZone('header');
        stateRef.current.activeZone = 'header';
      } else if (s.activeZone === 'search-keyboard') {
        if (s.searchRowIndex > 0) {
          setSearchRowIndex(r => {
            const next = r - 1;
            stateRef.current.searchRowIndex = next;
            return next;
          });
        } else {
          setActiveZone('header');
          stateRef.current.activeZone = 'header';
        }
      } else if (s.activeZone === 'search-results') {
        setActiveZone('search-keyboard');
        stateRef.current.activeZone = 'search-keyboard';
      }
      return;
    }

    // G. D-Pad SETA PARA BAIXO
    if (isDown) {
      e.preventDefault();
      if (s.activeZone === 'header') {
        if (flushTabChange()) return;
        descendFromHeader();
        return;
      } else if (s.activeZone === 'local-filters') {
        setActiveZone('rows');
        stateRef.current.activeZone = 'rows';
        const savedTab = tabPositionsRef.current.local;
        const r = (savedTab && savedTab.activeZone === 'rows') ? Math.min(Math.max(0, s.rowCount - 1), savedTab.rowIndex || 0) : 0;
        const maxC = s.getColCount ? s.getColCount(r) : 1;
        const c = (savedTab && savedTab.activeZone === 'rows') ? Math.min(Math.max(0, maxC - 1), savedTab.colIndex || 0) : 0;
        setRowIndex(r);
        setColIndex(c);
        stateRef.current.rowIndex = r;
        stateRef.current.colIndex = c;
      } else if (s.activeZone === 'hero') {
        setActiveZone('rows');
        stateRef.current.activeZone = 'rows';
        const savedTab = tabPositionsRef.current.home;
        const r = (savedTab && savedTab.activeZone === 'rows') ? Math.min(Math.max(0, s.rowCount - 1), savedTab.rowIndex || 0) : 0;
        const maxC = s.getColCount ? s.getColCount(r) : 1;
        const c = (savedTab && savedTab.activeZone === 'rows') ? Math.min(Math.max(0, maxC - 1), savedTab.colIndex || 0) : 0;
        setRowIndex(r);
        setColIndex(c);
        stateRef.current.rowIndex = r;
        stateRef.current.colIndex = c;
      } else if (s.activeZone === 'rows') {
        setRowIndex(r => {
          const nextR = Math.min(Math.max(0, s.rowCount - 1), r + 1);
          stateRef.current.rowIndex = nextR;
          if (s.getColCount) {
            const maxC = s.getColCount(nextR);
            setColIndex(c => {
              const nextC = Math.min(Math.max(0, maxC - 1), c);
              stateRef.current.colIndex = nextC;
              return nextC;
            });
          }
          return nextR;
        });
      } else if (s.activeZone === 'search-keyboard') {
        if (s.searchRowIndex < 3) {
          setSearchRowIndex(r => {
            const next = r + 1;
            stateRef.current.searchRowIndex = next;
            return next;
          });
        } else {
          setActiveZone('search-results');
          stateRef.current.activeZone = 'search-results';
        }
      }
      return;
    }

    // H. D-Pad SETA PARA ESQUERDA
    if (isLeft) {
      e.preventDefault();
      if (s.activeZone === 'header') {
        const next = Math.max(0, (stateRef.current.headerIndex || 0) - 1);
        stateRef.current.headerIndex = next;
        setHeaderIndex(next);
        scheduleTabChange(next);
      } else if (s.activeZone === 'local-filters') {
        setLocalFilterIndex(i => {
          const next = Math.max(0, i - 1);
          stateRef.current.localFilterIndex = next;
          s.onLocalFilterChange?.(next);
          return next;
        });
      } else if (s.activeZone === 'hero') {
        setHeroIndex(i => {
          const next = Math.max(0, i - 1);
          stateRef.current.heroIndex = next;
          return next;
        });
      } else if (s.activeZone === 'rows') {
        setColIndex(c => {
          const next = Math.max(0, c - 1);
          stateRef.current.colIndex = next;
          return next;
        });
      } else if (s.activeZone === 'search-keyboard') {
        setSearchColIndex(c => {
          const next = Math.max(0, c - 1);
          stateRef.current.searchColIndex = next;
          return next;
        });
      } else if (s.activeZone === 'search-results') {
        if (s.resultsColIndex > 0) {
          setResultsColIndex(c => {
            const next = c - 1;
            stateRef.current.resultsColIndex = next;
            return next;
          });
        } else {
          setActiveZone('search-keyboard');
          stateRef.current.activeZone = 'search-keyboard';
        }
      }
      return;
    }

    // I. D-Pad SETA PARA DIREITA
    if (isRight) {
      e.preventDefault();
      if (s.activeZone === 'header') {
        const next = Math.min(s.headerCount - 1, (stateRef.current.headerIndex || 0) + 1);
        stateRef.current.headerIndex = next;
        setHeaderIndex(next);
        scheduleTabChange(next);
      } else if (s.activeZone === 'local-filters') {
        setLocalFilterIndex(i => {
          const next = Math.min(Math.max(0, s.localFilterCount - 1), i + 1);
          stateRef.current.localFilterIndex = next;
          s.onLocalFilterChange?.(next);
          return next;
        });
      } else if (s.activeZone === 'hero') {
        setHeroIndex(i => {
          const next = Math.min(1, i + 1);
          stateRef.current.heroIndex = next;
          return next;
        });
      } else if (s.activeZone === 'rows') {
        const curColCount = s.getColCount ? s.getColCount(s.rowIndex) : 30;
        setColIndex(c => {
          const next = Math.min(Math.max(0, curColCount - 1), c + 1);
          stateRef.current.colIndex = next;
          return next;
        });
      } else if (s.activeZone === 'search-keyboard') {
        const maxCol = s.searchRowIndex === 3 ? 8 : 9;
        if (s.searchColIndex < maxCol) {
          setSearchColIndex(c => {
            const next = c + 1;
            stateRef.current.searchColIndex = next;
            return next;
          });
        } else {
          setActiveZone('search-results');
          stateRef.current.activeZone = 'search-results';
        }
      } else if (s.activeZone === 'search-results') {
        setResultsColIndex(c => {
          const next = c + 1;
          stateRef.current.resultsColIndex = next;
          return next;
        });
      }
      return;
    }
  }, []); // Montado uma única vez - listener permanente sem recriação

  // 4b. Manipulador de keyup para detecção precisa de clique rápido vs long press
  const handleKeyUp = useCallback((e) => {
    const s = stateRef.current;
    const code = e.keyCode || e.which || 0;
    const key = e.key || '';
    const isEnter = code === KEYS.ENTER || key === 'Enter';

    if (isEnter) {
      if (enterLongPressTimerRef.current) {
        clearTimeout(enterLongPressTimerRef.current);
        enterLongPressTimerRef.current = null;
      }

      // Se o long press disparou (menu já aberto), ignora o soltar do botão
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        pendingCardEnterRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Se o keydown de Enter ocorreu dentro de um modal/menu (que fechou no keydown), NÃO dispara clique no card ao soltar a tecla!
      if (!pendingCardEnterRef.current) {
        return;
      }
      pendingCardEnterRef.current = false;

      // Se soltou antes de 400ms na zona de cards, dispara o clique normal (onEnter)
      const isCardZone = s.activeZone === 'rows' || s.activeZone === 'hero' || s.activeZone === 'search-results';
      if (isCardZone && !s.isModalOpen && !s.isPlayerOpen && !s.isQuickMenuOpen) {
        e.preventDefault();
        e.stopPropagation();
        s.onEnter?.({
          zone: s.activeZone,
          headerIndex: s.headerIndex,
          heroIndex: s.heroIndex,
          rowIndex: s.rowIndex,
          colIndex: s.colIndex,
          filterIndex: s.localFilterIndex,
          searchRowIndex: s.searchRowIndex,
          searchColIndex: s.searchColIndex,
          resultsColIndex: s.resultsColIndex,
          isPlayKey: false
        });
      }
    }
  }, []);

  // 5. Adiciona os listeners uma única vez na inicialização
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (enterLongPressTimerRef.current) {
        clearTimeout(enterLongPressTimerRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    activeZone,
    setActiveZone,
    headerIndex,
    setHeaderIndex,
    heroIndex,
    setHeroIndex,
    rowIndex,
    setRowIndex,
    colIndex,
    setColIndex,
    localFilterIndex,
    setLocalFilterIndex,
    modalIndex,
    setModalIndex,
    quickMenuIndex,
    setQuickMenuIndex,
    searchRowIndex,
    setSearchRowIndex,
    searchColIndex,
    setSearchColIndex,
    resultsColIndex,
    setResultsColIndex,
    descendFromHeader
  };
}
