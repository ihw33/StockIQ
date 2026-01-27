'use client';

import { useState, useCallback, useEffect } from 'react';

export interface StockSearchResult {
    symbol: string;
    name: string;
    market: string;
    marcap?: number;
    size?: string;
}

export interface SearchFilters {
    market: string[];
    size: string[];
}

const RECENT_SEARCH_KEY = 'stockiq-recent-searches';
const MAX_RECENT = 10;

export function useStockSearch() {
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<SearchFilters>({
        market: [],
        size: [],
    });
    const [results, setResults] = useState<StockSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<StockSearchResult[]>([]);

    // Load recent searches on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_SEARCH_KEY);
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load recent searches:', e);
        }
    }, []);

    // Search with debounce handled by caller or useDeferredValue
    const search = useCallback(async (searchQuery: string, currentFilters: SearchFilters) => {
        // 검색어도 없고 필터도 없으면 검색 안 함
        if ((!searchQuery || searchQuery.trim().length < 1) &&
            currentFilters.market.length === 0 &&
            currentFilters.size.length === 0) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('q', searchQuery.trim());
            if (currentFilters.market.length > 0) params.set('market', currentFilters.market.join(','));
            if (currentFilters.size.length > 0) params.set('size', currentFilters.size.join(','));

            const response = await fetch(`/api/stock/search?${params.toString()}`);
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            setResults(data.results || []);
        } catch (error) {
            console.error('Stock search error:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounced search when query or filters changes
    useEffect(() => {
        const timer = setTimeout(() => {
            search(query, filters);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, filters, search]);

    const addRecentSearch = useCallback((stock: StockSearchResult) => {
        setRecentSearches((prev) => {
            // Remove if already exists
            const filtered = prev.filter((s) => s.symbol !== stock.symbol);
            // Add to front and limit
            const updated = [stock, ...filtered].slice(0, MAX_RECENT);
            // Save to localStorage
            try {
                localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save recent searches:', e);
            }
            return updated;
        });
    }, []);

    const clearRecentSearches = useCallback(() => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_SEARCH_KEY);
    }, []);

    const toggleFilter = useCallback((type: 'market' | 'size', value: string) => {
        setFilters(prev => {
            const current = prev[type];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];

            return {
                ...prev,
                [type]: updated
            };
        });
    }, []);

    return {
        query,
        setQuery,
        filters,
        toggleFilter,
        results,
        isLoading,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
    };
}
