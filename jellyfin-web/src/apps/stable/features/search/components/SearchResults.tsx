import React, { type FC, useEffect, useState } from 'react';
import { useSearchItems } from '../api/useSearchItems';
import globalize from 'lib/globalize';
import Loading from 'components/loading/LoadingComponent';
import SearchResultsRow from './SearchResultsRow';
import { CardShape } from 'utils/card';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { Section } from '../types';
import { searchCatalogMovies } from 'scripts/matheusflix/api';
import { openStremioDetails } from 'scripts/matheusflix/stremioDetail';
import './searchSuggestions.scss';

interface SearchResultsProps {
    parentId?: string;
    collectionType?: CollectionType;
    query?: string;
}

interface CatalogMovie {
    imdb_id?: string;
    title: string;
    year?: number | string;
    rating?: number | string;
    poster?: string;
    genres?: string;
    overview?: string;
}

/*
 * Componente de resultados de busca unificado (Biblioteca Local + Catálogo MatheusFlix)
 */
const SearchResults: FC<SearchResultsProps> = ({
    parentId,
    collectionType,
    query
}) => {
    const trimmedQuery = query?.trim() || '';
    const { data, isPending } = useSearchItems(parentId, collectionType, trimmedQuery);

    const [catalogResults, setCatalogResults] = useState<CatalogMovie[]>([]);
    const [isCatalogPending, setIsCatalogPending] = useState(false);

    useEffect(() => {
        if (!trimmedQuery) {
            setCatalogResults([]);
            return;
        }

        let isMounted = true;
        setIsCatalogPending(true);

        searchCatalogMovies(trimmedQuery)
            .then(res => {
                if (isMounted && res && Array.isArray(res.movies)) {
                    setCatalogResults(res.movies);
                } else if (isMounted) {
                    setCatalogResults([]);
                }
            })
            .catch(() => {
                if (isMounted) setCatalogResults([]);
            })
            .finally(() => {
                if (isMounted) setIsCatalogPending(false);
            });

        return () => {
            isMounted = false;
        };
    }, [trimmedQuery]);

    const hasLocalResults = Boolean(data && data.length > 0);
    const hasCatalogResults = Boolean(catalogResults && catalogResults.length > 0);

    if (isPending && isCatalogPending) return <Loading />;

    if (!hasLocalResults && !hasCatalogResults && !isPending && !isCatalogPending) {
        return (
            <div className='noItemsMessage centerMessage' style={{ marginTop: '48px' }}>
                <span className='material-icons' style={{ fontSize: '64px', color: '#555', display: 'block', marginBottom: '16px' }}>
                    search_off
                </span>
                <p style={{ fontSize: '1.2rem', color: '#e5e5e5', margin: 0 }}>
                    {globalize.translate('SearchResultsEmpty', trimmedQuery)}
                </p>
                <p style={{ fontSize: '0.95rem', color: '#888', marginTop: '8px' }}>
                    Tente buscar por outro termo, nome de ator ou gênero.
                </p>
            </div>
        );
    }

    const renderSection = (section: Section, index: number) => {
        return (
            <SearchResultsRow
                key={`${section.title}-${index}`}
                title={globalize.translate(section.title)}
                items={section.items}
                cardOptions={{
                    shape: CardShape.AutoOverflow,
                    scalable: true,
                    showTitle: true,
                    overlayText: false,
                    centerText: true,
                    allowBottomPadding: false,
                    ...section.cardOptions
                }}
            />
        );
    };

    return (
        <div className='searchResults padded-top padded-bottom-page'>
            {/* Resultados da Biblioteca Local Jellyfin */}
            {hasLocalResults && data!.map((section, index) => renderSection(section, index))}

            {/* Resultados do Catálogo Geral MatheusFlix */}
            {hasCatalogResults && (
                <div className='mf-search-container' style={{ marginTop: hasLocalResults ? '32px' : '0' }}>
                    <div className='mf-search-section-header'>
                        <h2 className='mf-search-section-title'>
                            Disponíveis no Catálogo MatheusFlix
                        </h2>
                        <span className='mf-search-section-subtitle'>
                            {catalogResults.length} títulos encontrados
                        </span>
                    </div>

                    <div className='mf-search-grid'>
                        {catalogResults.map(movie => {
                            const ratingNum = typeof movie.rating === 'number'
                                ? movie.rating.toFixed(1)
                                : (movie.rating ? String(movie.rating) : null);

                            return (
                                <div
                                    key={movie.imdb_id || movie.title}
                                    className='mf-search-card'
                                    onClick={() => openStremioDetails(movie)}
                                    role='button'
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openStremioDetails(movie);
                                    }}
                                >
                                    <div className='mf-search-card-poster-wrap'>
                                        {movie.poster ? (
                                            <img
                                                src={movie.poster}
                                                alt={movie.title}
                                                className='mf-search-card-poster'
                                                loading='lazy'
                                            />
                                        ) : (
                                            <div className='mf-search-card-poster flex align-items-center justify-content-center'>
                                                <span className='material-icons' style={{ fontSize: 48, color: '#555' }}>movie</span>
                                            </div>
                                        )}

                                        {ratingNum && (
                                            <div className='mf-search-card-badge'>
                                                <span className='material-icons' style={{ fontSize: 12, color: '#f5a623', marginRight: 2 }}>star</span>
                                                <span>{ratingNum}</span>
                                            </div>
                                        )}

                                        <div className='mf-search-card-overlay'>
                                            <div className='mf-search-play-icon'>
                                                <span className='material-icons play_arrow' aria-hidden='true'></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className='mf-search-card-details'>
                                        <h3 className='mf-search-card-title' title={movie.title}>
                                            {movie.title}
                                        </h3>
                                        <div className='mf-search-card-meta'>
                                            <span>{movie.year || 'Filme'}</span>
                                            <span style={{ color: '#e50914', fontWeight: 600 }}>Assistir</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchResults;
