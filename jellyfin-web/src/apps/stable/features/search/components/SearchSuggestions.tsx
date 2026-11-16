import React, { type FC, useEffect, useState } from 'react';
import Loading from 'components/loading/LoadingComponent';
import { appRouter } from 'components/router/appRouter';
import { useSearchSuggestions } from '../api/useSearchSuggestions';
import { fetchTrendingMovies } from 'scripts/matheusflix/api';
import { openStremioDetails } from 'scripts/matheusflix/stremioDetail';
import './searchSuggestions.scss';

type SearchSuggestionsProps = {
    parentId?: string | null;
    onSelectCategory?: (category: string) => void;
};

const POPULAR_GENRES = [
    'Ação',
    'Aventura',
    'Comédia',
    'Ficção Científica',
    'Terror',
    'Animação',
    'Drama',
    'Suspense',
    'Romance',
    'Fantasia',
    'Família',
    'Mistério'
];

interface CatalogMovie {
    imdb_id?: string;
    title: string;
    year?: number | string;
    rating?: number | string;
    poster?: string;
    genres?: string;
    overview?: string;
}

const SearchSuggestions: FC<SearchSuggestionsProps> = ({ parentId, onSelectCategory }) => {
    const { data: jellyfinSuggestions, isPending: isJellyfinPending } = useSearchSuggestions(parentId || undefined);

    const [catalogTrending, setCatalogTrending] = useState<CatalogMovie[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetchTrendingMovies()
            .then(data => {
                if (isMounted && data && Array.isArray(data.movies)) {
                    setCatalogTrending(data.movies.slice(0, 36));
                }
            })
            .catch(() => {
                // Silently fallback to Jellyfin suggestions
            })
            .finally(() => {
                if (isMounted) setIsCatalogLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleCategoryClick = (genre: string) => {
        if (onSelectCategory) {
            onSelectCategory(genre);
        }
    };

    const handleCatalogMovieClick = (movie: CatalogMovie) => {
        openStremioDetails(movie);
    };

    const handleJellyfinItemClick = (item: any) => {
        if (item?.Id) {
            appRouter.showItem(item.Id);
        }
    };

    const getJellyfinPosterUrl = (itemId?: string | null) => {
        if (!itemId) return '';
        if (window.ApiClient) {
            return window.ApiClient.getUrl(`Items/${itemId}/Images/Primary`, { maxWidth: 400 });
        }
        return '';
    };

    const isLoading = isJellyfinPending && isCatalogLoading;

    return (
        <div className='mf-search-container'>
            {/* Categorias Rápidas em Pílulas */}
            <div className='mf-search-categories-section'>
                <div className='mf-search-categories-label'>Explorar por Gênero</div>
                <div className='mf-search-categories'>
                    {POPULAR_GENRES.map(genre => (
                        <button
                            key={genre}
                            type='button'
                            className='mf-category-chip'
                            onClick={() => handleCategoryClick(genre)}
                        >
                            {genre}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cabeçalho de Títulos em Alta */}
            <div className='mf-search-section-header'>
                <h2 className='mf-search-section-title'>Títulos em Alta e Recomendados</h2>
                <span className='mf-search-section-subtitle'>Descubra o melhor do catálogo</span>
            </div>

            {isLoading ? (
                <Loading />
            ) : (
                <div className='mf-search-grid'>
                    {/* Filmes do Catálogo Trending com Títulos em PT-BR */}
                    {catalogTrending.map(movie => {
                        const ratingNum = typeof movie.rating === 'number'
                            ? movie.rating.toFixed(1)
                            : (movie.rating ? String(movie.rating) : null);

                        return (
                            <div
                                key={movie.imdb_id || movie.title}
                                className='mf-search-card'
                                onClick={() => handleCatalogMovieClick(movie)}
                                role='button'
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCatalogMovieClick(movie);
                                }}
                            >
                                <div className='mf-search-card-poster-wrap'>
                                    {movie.poster ? (
                                        <img
                                            src={movie.poster}
                                            alt={movie.title || ''}
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
                                            <span className='star'>★</span>
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
                                    <h3 className='mf-search-card-title' title={movie.title || ''}>
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

                    {/* Itens locais do Jellyfin com capas */}
                    {jellyfinSuggestions?.map(item => {
                        const posterUrl = getJellyfinPosterUrl(item.Id);
                        const year = item.ProductionYear || (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : null);

                        return (
                            <div
                                key={item.Id}
                                className='mf-search-card'
                                onClick={() => handleJellyfinItemClick(item)}
                                role='button'
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleJellyfinItemClick(item);
                                }}
                            >
                                <div className='mf-search-card-poster-wrap'>
                                    {posterUrl ? (
                                        <img
                                            src={posterUrl}
                                            alt={item.Name || ''}
                                            className='mf-search-card-poster'
                                            loading='lazy'
                                        />
                                    ) : (
                                        <div className='mf-search-card-poster flex align-items-center justify-content-center'>
                                            <span className='material-icons' style={{ fontSize: 48, color: '#555' }}>movie</span>
                                        </div>
                                    )}

                                    {item.CommunityRating && (
                                        <div className='mf-search-card-badge'>
                                            <span className='star'>★</span>
                                            <span>{item.CommunityRating.toFixed(1)}</span>
                                        </div>
                                    )}

                                    <div className='mf-search-card-overlay'>
                                        <div className='mf-search-play-icon'>
                                            <span className='material-icons play_arrow' aria-hidden='true'></span>
                                        </div>
                                    </div>
                                </div>

                                <div className='mf-search-card-details'>
                                    <h3 className='mf-search-card-title' title={item.Name || ''}>
                                        {item.Name}
                                    </h3>
                                    <div className='mf-search-card-meta'>
                                        <span>{year || item.Type || 'Mídia'}</span>
                                        <span style={{ color: '#46d369', fontWeight: 600 }}>Local</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchSuggestions;
