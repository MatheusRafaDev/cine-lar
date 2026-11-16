import React, { type ChangeEvent, type FC, useCallback, useRef } from 'react';
import AlphaPicker from 'components/alphaPicker/AlphaPickerComponent';
import layoutManager from 'components/layoutManager';
import browser from 'scripts/browser';
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

    const onAlphaPicked = useCallback((e: Event) => {
        const value = (e as CustomEvent).detail.value;
        const inputValue = inputRef.current?.value || '';

        if (value === 'backspace') {
            onSearch(inputValue.length ? inputValue.substring(0, inputValue.length - 1) : '');
        } else {
            onSearch(inputValue + value);
        }
    }, [onSearch]);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        onSearch(e.target.value);
    }, [onSearch]);

    const onClear = useCallback(() => {
        onSearch('');
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [onSearch]);

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
                        className='searchfields-clearBtn'
                        title='Limpar busca'
                        onClick={onClear}
                    >
                        <span className='material-icons close' aria-hidden='true'></span>
                    </button>
                ) : null}
            </div>
            {layoutManager.tv && !browser.tv && (
                <AlphaPicker onAlphaPicked={onAlphaPicked} />
            )}
        </div>
    );
};

export default SearchFields;
