'use client';

import { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Star, TrendingUp, Clock, X } from 'lucide-react';
import { useStockSearch, StockSearchResult, SearchFilters } from '@/lib/hooks/use-stock-search';

interface StockSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectStock: (symbol: string, name: string) => void;
    onAddToWatchlist: (symbol: string, name: string) => void;
    isInWatchlist: (symbol: string) => boolean;
}

export function StockSearchModal({
    isOpen,
    onClose,
    onSelectStock,
    onAddToWatchlist,
    isInWatchlist,
}: StockSearchModalProps) {
    const {
        query,
        setQuery,
        filters,
        toggleFilter,
        results,
        isLoading,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
    } = useStockSearch();

    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            setQuery('');
            // Optional: reset filters on close? keeping them might be better UX
        }
    }, [isOpen, setQuery]);

    const handleSelectStock = (stock: StockSearchResult) => {
        addRecentSearch(stock);
        // 차트만 변경 (관심종목 추가는 ⭐ 버튼으로만)
        onSelectStock(stock.symbol, stock.name);
        onClose();
    };

    const handleAddToWatchlist = (e: React.MouseEvent, stock: StockSearchResult) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[SearchModal] Add to watchlist clicked:', stock.symbol, stock.name);
        onAddToWatchlist(stock.symbol, stock.name);
    };

    // Popular stocks (fallback if no server data)
    const popularStocks: StockSearchResult[] = [
        { symbol: '005930', name: '삼성전자', market: 'KOSPI', size: 'Large' },
        { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI', size: 'Large' },
        { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI', size: 'Large' },
        { symbol: '247540', name: '에코프로비엠', market: 'KOSDAQ', size: 'Large' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-slate-950 border-slate-800 text-slate-100 p-0">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Search className="w-5 h-5 text-blue-400" />
                        종목 검색
                    </DialogTitle>
                </DialogHeader>

                {/* Search Input */}
                <div className="px-4 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="종목명 또는 종목코드 입력..."
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        <div className="flex bg-slate-900 rounded-md p-1 gap-1">
                            {(['KOSPI', 'KOSDAQ'] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => toggleFilter('market', m)}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${filters.market.includes(m)
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="flex bg-slate-900 rounded-md p-1 gap-1">
                            {([
                                { val: 'Large', label: '대형주' },
                                { val: 'Mid', label: '중형주' },
                                { val: 'Small', label: '소형주' }
                            ]).map((s) => (
                                <button
                                    key={s.val}
                                    onClick={() => toggleFilter('size', s.val)}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${filters.size.includes(s.val)
                                            ? 'bg-purple-600 text-white font-medium'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Results / Empty States */}
                <div className="max-h-[400px] overflow-y-auto px-2 pb-4">
                    {/* Search Results */}
                    {(query || filters.market.length > 0 || filters.size.length > 0) && results.length > 0 ? (
                        <div className="mb-4">
                            <div className="px-2 py-1 text-xs text-slate-500 font-medium">검색 결과 ({results.length})</div>
                            <div className="space-y-1">
                                {results.map((stock) => (
                                    <StockResultItem
                                        key={stock.symbol}
                                        stock={stock}
                                        onSelect={handleSelectStock}
                                        onAddToWatchlist={handleAddToWatchlist}
                                        isInWatchlist={isInWatchlist(stock.symbol)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* No Results */}
                    {(query || filters.market.length > 0 || filters.size.length > 0) && !isLoading && results.length === 0 && (
                        <div className="py-8 text-center text-slate-500">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">검색 결과가 없습니다</p>
                        </div>
                    )}

                    {/* Loading */}
                    {isLoading && (
                        <div className="py-8 text-center text-slate-500">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm">검색 중...</p>
                        </div>
                    )}

                    {/* Default State: Recent + Popular */}
                    {!query && filters.market.length === 0 && filters.size.length === 0 && (
                        <>
                            {/* Recent Searches */}
                            {recentSearches.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex justify-between items-center px-2 py-1">
                                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            최근 검색
                                        </span>
                                        <button
                                            onClick={clearRecentSearches}
                                            className="text-xs text-slate-600 hover:text-slate-400"
                                        >
                                            전체 삭제
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {recentSearches.map((stock) => (
                                            <StockResultItem
                                                key={stock.symbol}
                                                stock={stock}
                                                onSelect={handleSelectStock}
                                                onAddToWatchlist={handleAddToWatchlist}
                                                isInWatchlist={isInWatchlist(stock.symbol)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Popular Stocks */}
                            <div>
                                <div className="px-2 py-1 text-xs text-slate-500 font-medium flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    인기 종목
                                </div>
                                <div className="space-y-1">
                                    {popularStocks.map((stock) => (
                                        <StockResultItem
                                            key={stock.symbol}
                                            stock={stock}
                                            onSelect={handleSelectStock}
                                            onAddToWatchlist={handleAddToWatchlist}
                                            isInWatchlist={isInWatchlist(stock.symbol)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Helper for badges
function getSizeLabel(size?: string) {
    if (!size) return '';
    switch (size) {
        case 'Large': return '대형주';
        case 'Mid': return '중형주';
        case 'Small': return '소형주';
        default: return size;
    }
}

function getBadgeColor(type: 'market' | 'size') {
    if (type === 'market') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
}

// Individual Result Item
function StockResultItem({
    stock,
    onSelect,
    onAddToWatchlist,
    isInWatchlist,
}: {
    stock: StockSearchResult;
    onSelect: (stock: StockSearchResult) => void;
    onAddToWatchlist: (e: React.MouseEvent, stock: StockSearchResult) => void;
    isInWatchlist: boolean;
}) {
    return (
        <div
            onClick={() => onSelect(stock)}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-800/50 cursor-pointer group transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                    {stock.name.charAt(0)}
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-100">{stock.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{stock.symbol}</span>

                        {/* Market Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getBadgeColor('market')}`}>
                            {stock.market}
                        </span>

                        {/* Size Badge */}
                        {stock.size && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getBadgeColor('size')}`}>
                                {getSizeLabel(stock.size)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddToWatchlist(e, stock);
                    }}
                    className={`p-2 rounded-md transition-colors ${isInWatchlist
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'hover:bg-slate-700 text-slate-400 hover:text-yellow-400'
                        }`}
                    title={isInWatchlist ? '관심종목에 추가됨' : '관심종목 추가'}
                >
                    <Star className={`w-5 h-5 ${isInWatchlist ? 'fill-current' : ''}`} />
                </button>
            </div>
        </div>
    );
}
