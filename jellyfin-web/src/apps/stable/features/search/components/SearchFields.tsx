import React, { type ChangeEvent, type FC, useCallback, useRef } from 'react';
import layoutManager from 'components/layoutManager';
import browser from 'scripts/browser';
import TvKeyboard from './TvKeyboard';
import 'material-design-icons-iconfont';
import 'styles/flexstyles.scss';
import './searchfields.scss';

interface SearchFieldsProps {
    query: string;
    onSearch?: (query: string) => void;
}

const SearchFields: FC<SearchFieldsProps> = ({
    onSearch = () => { /* no-op */ },
    query
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const onKeyInput = useCallback((char: string) => {
        onSearch((query || '') + char);
    }, [query, onSearch]);

    const onBackspace = useCallback(() => {
        onSearch(query.length ? query.substring(0, query.length - 1) : '');
    }, [query, onSearch]);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        onSearch(e.target.value);
    }, [onSearch]);

    const onClear = useCallback(() => {
        onSearch('');
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [onSearch]);

    const onSelectSuggestion = useCallback((text: string) => {
        onSearch(text);
    }, [onSearch]);

    const isTvMode = layoutManager.tv || browser.tv || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tv') === '1');

    return (
        <div className='padded-left padded-right searchFields'>
            <div className='searchFieldsInner'>
                <span className='searchfields-icon material-icons search' aria-hidden='true' />
                <div className='inputContainer flex-grow'>
                    <input
                        ref={inputRef}
                        id='searchTextInput'
                        className='searchfields-txtSearch'
                        type='text'
                        placeholder='O que você quer assistir hoje? (Títulos, diretores, gêneros...)'
                        autoComplete='off'
                        maxLength={60}
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={query}
                        onChange={onChange}
                    />
                </div>
                {query ? (
                    <button
                        type='button'
                        className='searchfields-clearBtn focusable'
                        title='Limpar busca'
                        onClick={onClear}
                    >
                        <span className='material-icons close' aria-hidden='true'></span>
                    </button>
                ) : null}
            </div>

            {/* Teclado Virtual de TV com Histórico e Atalhos Rápidos */}
            <TvKeyboard
                query={query}
                onKeyInput={onKeyInput}
                onBackspace={onBackspace}
                onClear={onClear}
                onSelectSuggestion={onSelectSuggestion}
            />
        </div>
    );
};

export default SearchFields;
