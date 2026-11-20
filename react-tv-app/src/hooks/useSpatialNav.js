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
  activeTab = 'home',
  hasHero = true,
  rowCount = 1,
  getColCount = null,
  headerCount = 7,
  localFilterCount = 0,
  modalItemsCount = 3,
  onBack = null,
  onEnter = null,
  onTabChange = null,
  onLocalFilterChange = null,
  onPlayPause = null,
  onSeek = null,
  onVolume = null
}) {
  const [activeZone, setActiveZone] = useState('rows'); // 'header' | 'hero' | 'rows' | 'modal' | 'player' | 'search-keyboard' | 'search-results' | 'local-filters'
  const [headerIndex, setHeaderIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [rowIndex, setRowIndex] = useState(0);
  const [colIndex, setColIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState(0);
  const [localFilterIndex, setLocalFilterIndex] = useState(0);

  // Estados específicos para a busca
  const [searchRowIndex, setSearchRowIndex] = useState(0);
  const [searchColIndex, setSearchColIndex] = useState(0);
  const [resultsColIndex, setResultsColIndex] = useState(0);

  // Ref persistente com todo o estado e props para acesso O(1) no event listener sem recriar
  const stateRef = useRef({});
  stateRef.current = {
    isPlayerOpen,
    isModalOpen,
    activeZone,
    activeTab,
    hasHero,
    rowCount,
    getColCount,
    headerCount,
    localFilterCount,
    modalItemsCount,
    headerIndex,
    heroIndex,
    rowIndex,
    colIndex,
    modalIndex,
    localFilterIndex,
    searchRowIndex,
    searchColIndex,
    resultsColIndex,
    onBack,
    onEnter,
    onTabChange,
    onLocalFilterChange,
    onPlayPause,
    onSeek,
    onVolume
  };

  const lastKeyRef = useRef({ code: 0, time: 0 });

  // 1. Registro permanente de teclas de mídia no sistema Tizen da Samsung
  useEffect(() => {
    if (typeof window !== 'undefined' && window.tizen && window.tizen.tvinputdevice) {
      const tvKeys = [
        'MediaPlay', 'MediaPause', 'MediaStop', 'MediaPlayPause',
        'MediaRewind', 'MediaFastForward', '0', '1', '2', '3', '4', '5'
      ];
      tvKeys.forEach(k => {
        try {
          window.tizen.tvinputdevice.registerKey(k);
        } catch (_) {}
      });
    }
  }, []);

  // 2. Transições automáticas de zona para Modal e Player
  useEffect(() => {
    if (isPlayerOpen) {
      setActiveZone('player');
    } else if (isModalOpen) {
      setActiveZone('modal');
      setModalIndex(0);
      stateRef.current.modalIndex = 0;
    } else {
      setActiveZone(prev => (prev === 'modal' || prev === 'player') ? 'rows' : prev);
    }
  }, [isPlayerOpen, isModalOpen]);

  // 3. Sincronização de zona ao trocar de aba (mantém no header se estiver navegando o header)
  useEffect(() => {
    if (isModalOpen || isPlayerOpen) return;

    // Sincroniza o índice do header com a tab atual
    const tabIdx = NAV_ITEMS.findIndex(item => item.id === activeTab);
    if (tabIdx >= 0) {
      setHeaderIndex(tabIdx);
      stateRef.current.headerIndex = tabIdx;
    }

    setActiveZone(currentZone => {
      if (currentZone === 'header') return 'header';

      if (activeTab === 'search') {
        setSearchRowIndex(0);
        setSearchColIndex(0);
        return 'search-keyboard';
      }
      if (activeTab === 'home' && hasHero) {
        setHeroIndex(0);
        setRowIndex(0);
        setColIndex(0);
        return 'hero';
      }
      if (activeTab === 'local') {
        setRowIndex(0);
        setColIndex(0);
        return 'rows';
      }
      setRowIndex(0);
      setColIndex(0);
      return 'rows';
    });
  }, [activeTab, hasHero, isModalOpen, isPlayerOpen]);

  // 4. Manipulador global persistente de teclas (SINGLE LISTENER - ZERO GC CHURN)
  const handleKeyDown = useCallback((e) => {
    const s = stateRef.current;
    const code = e.keyCode || e.which || 0;
    const key = e.key || '';

    // Debounce inteligente de 30ms apenas para repetição contínua da mesma tecla
    const now = Date.now();
    if (lastKeyRef.current.code === code && now - lastKeyRef.current.time < 30) {
      e.preventDefault();
      return;
    }
    lastKeyRef.current = { code, time: now };

    const isBack = code === KEYS.BACK_TIZEN || code === KEYS.BACK_ESC || code === KEYS.BACKSPACE || key === 'Back' || key === 'Escape';
    const isEnter = code === KEYS.ENTER || key === 'Enter';
    const isPlayPause = code === KEYS.MEDIA_PLAY_PAUSE || code === KEYS.MEDIA_PLAY || code === KEYS.MEDIA_PAUSE || code === KEYS.MEDIA_STOP || key === 'MediaPlayPause' || key === ' ';
    const isLeft = code === KEYS.LEFT || key === 'ArrowLeft';
    const isRight = code === KEYS.RIGHT || key === 'ArrowRight';
    const isUp = code === KEYS.UP || key === 'ArrowUp';
    const isDown = code === KEYS.DOWN || key === 'ArrowDown';

    // A. Prioridade Máxima: Botão Voltar (Tizen / Esc / Backspace)
    if (isBack) {
      e.preventDefault();
      e.stopPropagation();

      // 1. Player fullscreen aberto: fecha o player
      if (s.isPlayerOpen) {
        s.onBack?.();
        return;
      }

      // 2. Modal de detalhes aberto: fecha o modal e joga foco para o header na tab atual
      if (s.isModalOpen) {
        s.onBack?.();
        const tabIdx = NAV_ITEMS.findIndex(item => item.id === s.activeTab);
        const targetHeaderIdx = tabIdx >= 0 ? tabIdx : 0;
        setHeaderIndex(targetHeaderIdx);
        stateRef.current.headerIndex = targetHeaderIdx;
        setActiveZone('header');
        stateRef.current.activeZone = 'header';
        return;
      }

      // 3. Se o foco está em qualquer área de conteúdo (rows, local-filters, hero, busca):
      // Joga SEMPRE o foco para o header, sincronizado com a tab atual, para navegar dentro dele
      if (s.activeZone !== 'header') {
        const tabIdx = NAV_ITEMS.findIndex(item => item.id === s.activeTab);
        const targetHeaderIdx = tabIdx >= 0 ? tabIdx : 0;
        setHeaderIndex(targetHeaderIdx);
        stateRef.current.headerIndex = targetHeaderIdx;
        setActiveZone('header');
        stateRef.current.activeZone = 'header';
        return;
      }

      // 4. Se o usuário JÁ ESTÁ no header e não está na aba Início, volta para Início
      if (s.activeTab !== 'home' || s.headerIndex !== 0) {
        setHeaderIndex(0);
        stateRef.current.headerIndex = 0;
        s.onTabChange?.(0);
        return;
      }

      // 5. Se já está no header na aba Início, chama onBack para fechar o app Tizen
      s.onBack?.();
      return;
    }

    // B. Player Fullscreen aberto
    if (s.isPlayerOpen) {
      if (isEnter || isPlayPause) {
        e.preventDefault();
        s.onPlayPause?.();
        return;
      }
      if (isLeft || code === KEYS.MEDIA_RW) {
        e.preventDefault();
        s.onSeek?.(-10);
        return;
      }
      if (isRight || code === KEYS.MEDIA_FF) {
        e.preventDefault();
        s.onSeek?.(10);
        return;
      }
      if (isUp) {
        e.preventDefault();
        s.onVolume?.(0.1);
        return;
      }
      if (isDown) {
        e.preventDefault();
        s.onVolume?.(-0.1);
        return;
      }
      return;
    }

    // C. Modal de Detalhes aberto (Ações: Assistir, Baixar, Favoritos, Streams)
    if (s.isModalOpen) {
      if (isEnter) {
        e.preventDefault();
        s.onEnter?.({ zone: 'modal', index: s.modalIndex, isPlayKey: false });
        return;
      }
      if (isPlayPause) {
        e.preventDefault();
        s.onEnter?.({ zone: 'modal', index: 0, isPlayKey: true });
        return;
      }
      if (isLeft) {
        e.preventDefault();
        setModalIndex(prev => {
          const next = Math.max(0, prev - 1);
          stateRef.current.modalIndex = next;
          return next;
        });
        return;
      }
      if (isRight) {
        e.preventDefault();
        setModalIndex(prev => {
          const next = Math.min(s.modalItemsCount - 1, prev + 1);
          stateRef.current.modalIndex = next;
          return next;
        });
        return;
      }
      if (isUp) {
        e.preventDefault();
        setModalIndex(prev => {
          const next = Math.max(0, prev - 1);
          stateRef.current.modalIndex = next;
          return next;
        });
        return;
      }
      if (isDown) {
        e.preventDefault();
        setModalIndex(prev => {
          const next = Math.min(s.modalItemsCount - 1, prev + 1);
          stateRef.current.modalIndex = next;
          return next;
        });
        return;
      }
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
        if (s.activeTab === 'home' && s.hasHero) {
          setActiveZone('hero');
          stateRef.current.activeZone = 'hero';
        } else if (s.activeTab === 'search') {
          setActiveZone('search-keyboard');
          stateRef.current.activeZone = 'search-keyboard';
        } else if (s.activeTab === 'local') {
          setActiveZone('local-filters');
          stateRef.current.activeZone = 'local-filters';
        } else {
          setActiveZone('rows');
          stateRef.current.activeZone = 'rows';
          setRowIndex(0);
          setColIndex(0);
          stateRef.current.rowIndex = 0;
          stateRef.current.colIndex = 0;
        }
      } else if (s.activeZone === 'local-filters') {
        setActiveZone('rows');
        stateRef.current.activeZone = 'rows';
        setRowIndex(0);
        setColIndex(0);
        stateRef.current.rowIndex = 0;
        stateRef.current.colIndex = 0;
      } else if (s.activeZone === 'hero') {
        setActiveZone('rows');
        stateRef.current.activeZone = 'rows';
        setRowIndex(0);
        setColIndex(0);
        stateRef.current.rowIndex = 0;
        stateRef.current.colIndex = 0;
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
        setHeaderIndex(i => {
          const next = Math.max(0, i - 1);
          stateRef.current.headerIndex = next;
          s.onTabChange?.(next);
          return next;
        });
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
        setHeaderIndex(i => {
          const next = Math.min(s.headerCount - 1, i + 1);
          stateRef.current.headerIndex = next;
          s.onTabChange?.(next);
          return next;
        });
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

  // 5. Adiciona o listener uma única vez na inicialização
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

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
    searchRowIndex,
    setSearchRowIndex,
    searchColIndex,
    setSearchColIndex,
    resultsColIndex,
    setResultsColIndex
  };
}
