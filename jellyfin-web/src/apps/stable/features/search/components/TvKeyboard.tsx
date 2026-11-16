import React, { type FC, useEffect, useState, useCallback, useRef } from 'react';
import './tvKeyboard.scss';

interface TvKeyboardProps {
    query: string;
    onKeyInput: (char: string) => void;
    onBackspace: () => void;
    onClear: () => void;
    onSelectSuggestion?: (text: string) => void;
}

const STORAGE_KEY = 'mf_search_history';

const KEYBOARD_ROWS = [
    ['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3'],
    ['G', 'H', 'I', 'J', 'K', 'L', '4', '5', '6'],
    ['M', 'N', 'O', 'P', 'Q', 'R', '7', '8', '9'],
    ['S', 'T', 'U', 'V', 'W', 'X', '0', '-', '.'],
    ['Y', 'Z', 'SPACE', 'BACKSPACE', 'CLEAR']
];

const POPULAR_SHORTCUTS = [
    'Ação',
    'Comédia',
    'Terror',
    'Animação',
    'Ficção Científica',
    'Suspense'
];

export const TvKeyboard: FC<TvKeyboardProps> = ({
    query,
    onKeyInput,
    onBackspace,
    onClear,
    onSelectSuggestion
}) => {
    const [history, setHistory] = useState<string[]>([]);
    const [keyboardVisible, setKeyboardVisible] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    // Carrega histórico recente do localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setHistory(parsed.slice(0, 6));
                }
            }
        } catch {
            // Ignora falha de parse
        }
    }, []);

    // Adiciona ao histórico quando a busca tiver mais de 2 letras
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length >= 3) {
            const timer = setTimeout(() => {
                setHistory(prev => {
                    const next = [trimmed, ...prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                    } catch {}
                    return next;
                });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [query]);

    const handleClearHistory = useCallback(() => {
        setHistory([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
    }, []);

    const handleKeyClick = (val: string) => {
        if (val === 'SPACE') {
            onKeyInput(' ');
        } else if (val === 'BACKSPACE') {
            onBackspace();
        } else if (val === 'CLEAR') {
            onClear();
        } else {
            onKeyInput(val);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, rIndex: number, cIndex: number) => {
        const container = containerRef.current;
        if (!container) return;

        if (e.key === 'ArrowRight') {
            const nextKey = container.querySelector<HTMLButtonElement>(`[data-row="${rIndex}"][data-col="${cIndex + 1}"]`);
            if (nextKey) {
                e.preventDefault();
                nextKey.focus();
            } else {
                // Ao final da linha, pula para o primeiro item do histórico ou atalhos
                const firstHistory = container.querySelector<HTMLButtonElement>('.mf-osk-chip');
                if (firstHistory) {
                    e.preventDefault();
                    firstHistory.focus();
                }
            }
        } else if (e.key === 'ArrowLeft') {
            const prevKey = container.querySelector<HTMLButtonElement>(`[data-row="${rIndex}"][data-col="${cIndex - 1}"]`);
            if (prevKey) {
                e.preventDefault();
                prevKey.focus();
            }
        } else if (e.key === 'ArrowDown') {
            const downKey = container.querySelector<HTMLButtonElement>(`[data-row="${rIndex + 1}"][data-col="${cIndex}"]`);
            if (downKey) {
                e.preventDefault();
                downKey.focus();
            } else {
                // Sai do teclado e vai para os cards de filmes / resultados
                const firstCard = document.querySelector<HTMLElement>('.mf-search-card, .mf-category-chip');
                if (firstCard) {
                    e.preventDefault();
                    firstCard.focus();
                }
            }
        } else if (e.key === 'ArrowUp') {
            if (rIndex > 0) {
                const upKey = container.querySelector<HTMLButtonElement>(`[data-row="${rIndex - 1}"][data-col="${cIndex}"]`);
                if (upKey) {
                    e.preventDefault();
                    upKey.focus();
                }
            } else {
                // Linha superior: foca no input de texto
                const input = document.getElementById('searchTextInput');
                if (input) {
                    e.preventDefault();
                    input.focus();
                }
            }
        }
    };

    return (
        <div className='mf-osk-wrapper' ref={containerRef}>
            <div className='mf-osk-top-toolbar'>
                <button
                    type='button'
                    className='mf-osk-toggle-btn focusable'
                    onClick={() => setKeyboardVisible(!keyboardVisible)}
                    title={keyboardVisible ? 'Ocultar Teclado' : 'Exibir Teclado Virtual'}
                >
                    <span className='material-icons' aria-hidden='true'>
                        {keyboardVisible ? 'keyboard_hide' : 'keyboard'}
                    </span>
                    <span>{keyboardVisible ? 'Ocultar Teclado' : 'Teclado na Tela'}</span>
                </button>
            </div>

            {keyboardVisible && (
                <div className='mf-osk-container'>
                    {/* Grade de Teclas do Teclado */}
                    <div className='mf-osk-grid'>
                        {KEYBOARD_ROWS.map((row, rIdx) => (
                            <div key={rIdx} className='mf-osk-row'>
                                {row.map((k, cIdx) => {
                                    let label = k;
                                    let icon = '';
                                    let btnClass = 'mf-osk-key focusable';

                                    if (k === 'SPACE') {
                                        label = 'Espaço';
                                        icon = 'space_bar';
                                        btnClass += ' mf-osk-key-wide mf-osk-key-space';
                                    } else if (k === 'BACKSPACE') {
                                        label = 'Apagar';
                                        icon = 'backspace';
                                        btnClass += ' mf-osk-key-action mf-osk-key-backspace';
                                    } else if (k === 'CLEAR') {
                                        label = 'Limpar';
                                        icon = 'clear';
                                        btnClass += ' mf-osk-key-action mf-osk-key-clear';
                                    }

                                    return (
                                        <button
                                            key={k}
                                            type='button'
                                            className={btnClass}
                                            data-row={rIdx}
                                            data-col={cIdx}
                                            onClick={() => handleKeyClick(k)}
                                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                            title={label}
                                        >
                                            {icon && <span className='material-icons' aria-hidden='true'>{icon}</span>}
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Painel Lateral: Histórico e Sugestões */}
                    <div className='mf-osk-sidebar'>
                        {history.length > 0 && (
                            <div className='mf-osk-history-section'>
                                <div className='mf-osk-sidebar-header'>
                                    <span className='mf-osk-sidebar-title'>
                                        <span className='material-icons' style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>
                                            history
                                        </span>
                                        Buscas Recentes
                                    </span>
                                    <button
                                        type='button'
                                        className='mf-osk-clear-history-btn focusable'
                                        onClick={handleClearHistory}
                                        title='Limpar histórico de buscas'
                                    >
                                        Limpar
                                    </button>
                                </div>
                                <div className='mf-osk-chips-list'>
                                    {history.map((item) => (
                                        <button
                                            key={item}
                                            type='button'
                                            className='mf-osk-chip focusable'
                                            onClick={() => onSelectSuggestion?.(item)}
                                        >
                                            <span className='material-icons' style={{ fontSize: 15, opacity: 0.6 }}>
                                                search
                                            </span>
                                            <span className='mf-osk-chip-text'>{item}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className='mf-osk-shortcuts-section'>
                            <div className='mf-osk-sidebar-header'>
                                <span className='mf-osk-sidebar-title'>
                                    <span className='material-icons' style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>
                                        local_fire_department
                                    </span>
                                    Atalhos Rápidos
                                </span>
                            </div>
                            <div className='mf-osk-chips-list'>
                                {POPULAR_SHORTCUTS.map((genre) => (
                                    <button
                                        key={genre}
                                        type='button'
                                        className='mf-osk-chip mf-osk-genre-chip focusable'
                                        onClick={() => onSelectSuggestion?.(genre)}
                                    >
                                        <span className='mf-osk-chip-text'>{genre}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TvKeyboard;
