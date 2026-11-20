import { useState, useEffect, useCallback, useRef } from 'react';

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
  modalItemsCount = 2,
  onBack = null,
  onEnter = null,
  onPlayPause = null,
  onSeek = null,
  onVolume = null
}) {
  const [activeZone, setActiveZone] = useState('rows'); // 'header' | 'hero' | 'rows' | 'modal' | 'player' | 'search-keyboard' | 'search-results'
  const [headerIndex, setHeaderIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [rowIndex, setRowIndex] = useState(0);
  const [colIndex, setColIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState(0);

  // Estados específicos para a busca
  const [searchRowIndex, setSearchRowIndex] = useState(0);
  const [searchColIndex, setSearchColIndex] = useState(0);
  const [resultsColIndex, setResultsColIndex] = useState(0);

  const lastKeyTimeRef = useRef(0);

  // Registro permanente de teclas de mídia no sistema Tizen da Samsung
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

  // Quando muda a aba, reseta o foco para a área adequada
  useEffect(() => {
    if (activeTab === 'search') {
      setActiveZone('search-keyboard');
      setSearchRowIndex(0);
      setSearchColIndex(0);
    } else if (activeTab === 'home' && hasHero) {
      setActiveZone('hero');
      setHeroIndex(0);
      setRowIndex(0);
      setColIndex(0);
    } else {
      setActiveZone('rows');
      setRowIndex(0);
      setColIndex(0);
    }
  }, [activeTab, hasHero]);

  const handleKeyDown = useCallback((e) => {
    const code = e.keyCode || e.which || 0;
    const key = e.key || '';

    // Throttle de 40ms para fluidez estrita sem perda de frames
    const now = Date.now();
    if (now - lastKeyTimeRef.current < 40) {
      e.preventDefault();
      return;
    }
    lastKeyTimeRef.current = now;

    const isBack = code === KEYS.BACK_TIZEN || code === KEYS.BACK_ESC || code === KEYS.BACKSPACE || key === 'Back' || key === 'Escape';
    const isEnter = code === KEYS.ENTER || key === 'Enter';
    const isPlayPause = code === KEYS.MEDIA_PLAY_PAUSE || code === KEYS.MEDIA_PLAY || code === KEYS.MEDIA_PAUSE || code === KEYS.MEDIA_STOP || key === 'MediaPlayPause' || key === ' ';

    // 1. Prioridade Máxima: Botão Voltar (Tizen / Esc)
    if (isBack) {
      e.preventDefault();
      e.stopPropagation();
      if (onBack) onBack();
      return;
    }

    // 2. Player em tela cheia: todo controle vai exclusivamente para a reprodução
    if (isPlayerOpen) {
      if (isEnter || isPlayPause) {
        e.preventDefault();
        if (onPlayPause) onPlayPause();
        return;
      }
      if (code === KEYS.LEFT || code === KEYS.MEDIA_RW || key === 'ArrowLeft') {
        e.preventDefault();
        if (onSeek) onSeek(-10);
        return;
      }
      if (code === KEYS.RIGHT || code === KEYS.MEDIA_FF || key === 'ArrowRight') {
        e.preventDefault();
        if (onSeek) onSeek(10);
        return;
      }
      if (code === KEYS.UP || key === 'ArrowUp') {
        e.preventDefault();
        if (onVolume) onVolume(0.1);
        return;
      }
      if (code === KEYS.DOWN || key === 'ArrowDown') {
        e.preventDefault();
        if (onVolume) onVolume(-0.1);
        return;
      }
      return;
    }

    // 3. Modal aberto
    if (isModalOpen) {
      if (isEnter) {
        e.preventDefault();
        if (onEnter) onEnter({ zone: 'modal', index: modalIndex });
        return;
      }
      if (code === KEYS.UP || key === 'ArrowUp') {
        e.preventDefault();
        setModalIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (code === KEYS.DOWN || key === 'ArrowDown') {
        e.preventDefault();
        setModalIndex(prev => Math.min(modalItemsCount - 1, prev + 1));
        return;
      }
      return;
    }

    // 4. Tecla Play/Pause dedicada fora do player
    if (isPlayPause) {
      e.preventDefault();
      if (onEnter) {
        onEnter({
          zone: activeZone,
          headerIndex,
          heroIndex,
          rowIndex,
          colIndex,
          searchRowIndex,
          searchColIndex,
          resultsColIndex,
          isPlayKey: true
        });
      }
      return;
    }

    // 5. Botão Enter (OK central do controle Samsung)
    if (isEnter) {
      e.preventDefault();
      if (onEnter) {
        onEnter({
          zone: activeZone,
          headerIndex,
          heroIndex,
          rowIndex,
          colIndex,
          searchRowIndex,
          searchColIndex,
          resultsColIndex,
          isPlayKey: false
        });
      }
      return;
    }

    // 6. Navegação D-Pad - SETA PARA CIMA
    if (code === KEYS.UP || key === 'ArrowUp') {
      e.preventDefault();
      if (activeZone === 'rows') {
        if (rowIndex > 0) {
          setRowIndex(r => r - 1);
        } else if (activeTab === 'home' && hasHero) {
          setActiveZone('hero');
        } else {
          setActiveZone('header');
        }
      } else if (activeZone === 'hero') {
        setActiveZone('header');
      } else if (activeZone === 'search-keyboard') {
        if (searchRowIndex > 0) {
          setSearchRowIndex(r => r - 1);
        } else {
          setActiveZone('header');
        }
      } else if (activeZone === 'search-results') {
        setActiveZone('header');
      }
      return;
    }

    // 7. Navegação D-Pad - SETA PARA BAIXO
    if (code === KEYS.DOWN || key === 'ArrowDown') {
      e.preventDefault();
      if (activeZone === 'header') {
        if (activeTab === 'home' && hasHero) {
          setActiveZone('hero');
        } else if (activeTab === 'search') {
          setActiveZone('search-keyboard');
        } else {
          setActiveZone('rows');
          setRowIndex(0);
        }
      } else if (activeZone === 'hero') {
        setActiveZone('rows');
        setRowIndex(0);
      } else if (activeZone === 'rows') {
        setRowIndex(r => Math.min(Math.max(0, rowCount - 1), r + 1));
      } else if (activeZone === 'search-keyboard') {
        if (searchRowIndex < 3) {
          setSearchRowIndex(r => r + 1);
        } else {
          setActiveZone('search-results');
        }
      }
      return;
    }

    // 8. Navegação D-Pad - SETA PARA ESQUERDA
    if (code === KEYS.LEFT || key === 'ArrowLeft') {
      e.preventDefault();
      if (activeZone === 'header') {
        setHeaderIndex(i => Math.max(0, i - 1));
      } else if (activeZone === 'hero') {
        setHeroIndex(i => Math.max(0, i - 1));
      } else if (activeZone === 'rows') {
        setColIndex(c => Math.max(0, c - 1));
      } else if (activeZone === 'search-keyboard') {
        setSearchColIndex(c => Math.max(0, c - 1));
      } else if (activeZone === 'search-results') {
        if (resultsColIndex > 0) {
          setResultsColIndex(c => c - 1);
        } else {
          setActiveZone('search-keyboard');
        }
      }
      return;
    }

    // 9. Navegação D-Pad - SETA PARA DIREITA
    if (code === KEYS.RIGHT || key === 'ArrowRight') {
      e.preventDefault();
      if (activeZone === 'header') {
        setHeaderIndex(i => Math.min(4, i + 1));
      } else if (activeZone === 'hero') {
        setHeroIndex(i => Math.min(1, i + 1));
      } else if (activeZone === 'rows') {
        const curColCount = getColCount ? getColCount(rowIndex) : 30;
        setColIndex(c => Math.min(Math.max(0, curColCount - 1), c + 1));
      } else if (activeZone === 'search-keyboard') {
        const maxCol = searchRowIndex === 3 ? 8 : 9;
        if (searchColIndex < maxCol) {
          setSearchColIndex(c => c + 1);
        } else {
          setActiveZone('search-results');
        }
      } else if (activeZone === 'search-results') {
        setResultsColIndex(c => c + 1);
      }
      return;
    }
  }, [
    isPlayerOpen, isModalOpen, activeZone, activeTab, hasHero, rowCount, getColCount,
    modalItemsCount, headerIndex, heroIndex, rowIndex, colIndex, modalIndex,
    searchRowIndex, searchColIndex, resultsColIndex,
    onBack, onEnter, onPlayPause, onSeek, onVolume
  ]);

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
