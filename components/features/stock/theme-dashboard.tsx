// ... (Imports remain similar, adding useCallback)
import { useEffect, useState, useCallback } from 'react';
import { StockTheme, StockQuote } from '@/lib/providers/stock-provider';
import { StockMosaic } from './stock-mosaic';

function formatNumber(num: number) {
    return new Intl.NumberFormat('ko-KR').format(num);
}

function formatPercent(num: number) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num / 100);
}

export function ThemeDashboard() {
    const [themes, setThemes] = useState<StockTheme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<StockTheme | null>(null);
    const [stocks, setStocks] = useState<StockQuote[]>([]);
    const [loadingThemes, setLoadingThemes] = useState(true);
    const [loadingStocks, setLoadingStocks] = useState(false);

    // UI State
    const [page, setPage] = useState(0); // 0: 1-4, 1: 5-8
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        fetch('/api/stock/themes')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setThemes(data);
                    if (data.length > 0) {
                        handleSelectTheme(data[0]);
                    }
                } else {
                    console.error('Invalid themes data:', data);
                    setThemes([]);
                }
            })
            .finally(() => setLoadingThemes(false));
    }, []);

    const handleSelectTheme = async (theme: StockTheme) => {
        setSelectedTheme(theme);
        setPage(0); // Reset page on theme switch
        setExpandedSymbol(null);
        setLoadingStocks(true);
        try {
            const res = await fetch(`/api/stock/themes/${theme.code}/stocks`);
            const data = await res.json();
            setStocks(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStocks(false);
        }
    };

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Esc: Close Expanded View (Always allowed)
            if (e.key === 'Escape') {
                e.preventDefault();
                if (expandedSymbol) setExpandedSymbol(null);
                return;
            }

            // If Expanded, disable Dashboard navigation (allow TradingPanel to handle keys)
            if (expandedSymbol) return;

            // Arrow Left/Right: Iterate Themes
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (themes.length === 0 || !selectedTheme) return;
                const currentIndex = themes.findIndex(t => t.code === selectedTheme.code);
                let nextIndex;
                if (e.key === 'ArrowRight') {
                    nextIndex = (currentIndex + 1) % themes.length;
                } else {
                    nextIndex = (currentIndex - 1 + themes.length) % themes.length;
                }
                handleSelectTheme(themes[nextIndex]);
            }

            // Number Keys 1-4: Expand Visible Stock
            else if (['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                const actualIndex = (page * 4) + index;
                if (stocks[actualIndex]) {
                    setExpandedSymbol(stocks[actualIndex].symbol);
                }
            }

            // Arrow Up/Down: Toggle Page
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setPage(prev => (prev === 0 ? 1 : 0));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [themes, selectedTheme, expandedSymbol, page, stocks]);

    if (loadingThemes) return <div className="p-8 text-center">Loading Market Themes...</div>;

    // Determine Visible Stocks
    // If Expanded, we MUST pass the expanded stock so StockMosaic can render it.
    // If NOT Expanded, we pass the current page's 4 stocks.
    const visibleStocks = expandedSymbol
        ? stocks.filter(s => s.symbol === expandedSymbol)
        : stocks.slice(page * 4, (page + 1) * 4); // Show 4 items (2x2 or 4x1?) -> User wants 4 split view

    return (
        <div className="flex flex-col h-[calc(100vh-60px)]">
            {/* Top: Theme Ribbon (Compacted) */}
            <div className="flex gap-2 p-2 overflow-x-auto bg-white border-b shadow-sm no-scrollbar min-h-[60px] flex-shrink-0 z-10 relative">
                {themes.map(theme => {
                    const isSelected = selectedTheme?.code === theme.code;
                    const isPositive = theme.avgChange > 0;
                    const colorClass = isPositive ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700';

                    return (
                        <button
                            key={theme.code}
                            onClick={() => handleSelectTheme(theme)}
                            className={`
                      flex flex-col min-w-[140px] p-2 rounded-lg border transition-all
                      ${isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : 'hover:bg-gray-50'}
                      ${isSelected ? colorClass : 'bg-white border-gray-200 text-gray-500'}
                   `}
                        >
                            <span className="text-xs font-bold text-left">{theme.name}</span>
                            <div className="flex justify-between items-end mt-1">
                                <span className="text-sm font-bold">
                                    {isPositive ? '+' : ''}{theme.avgChange}%
                                </span>
                                <span className="text-[10px] opacity-70">{theme.sentiment}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left: Stock List (Narrower) */}
                <div className="w-[220px] bg-white border-r overflow-y-auto flex-shrink-0">
                    <div className="p-3 border-b bg-gray-50">
                        <h2 className="font-bold text-gray-700 text-sm">
                            {selectedTheme?.name} 종목 ({stocks.length})
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">PAGE {page + 1} / {Math.ceil(stocks.length / 4)}</p>
                    </div>
                    <div>
                        {loadingStocks ? (
                            <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
                        ) : (
                            stocks.map((stock, idx) => {
                                // Highlight visible stocks in the list
                                const isVisible = idx >= page * 4 && idx < (page + 1) * 4;
                                const isPositive = stock.change > 0;
                                return (
                                    <div
                                        key={stock.symbol}
                                        className={`p-2 border-b flex justify-between items-center hover:bg-gray-50 ${isVisible ? 'bg-yellow-50/30' : 'opacity-60'}`}
                                    >
                                        <div>
                                            <div className="font-medium text-xs flex items-center gap-1.5">
                                                {/* Rank Badge - Click to Expand */}
                                                <button
                                                    onClick={() => setExpandedSymbol(stock.symbol)}
                                                    className={`text-[10px] px-1.5 rounded-sm hover:scale-110 transition-transform ${isVisible ? 'bg-yellow-400 text-white font-bold' : 'bg-gray-200 text-gray-500'}`}
                                                >
                                                    {idx + 1}
                                                </button>
                                                <span className="font-bold text-gray-800 truncate max-w-[80px]">{stock.name || stock.symbol}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 pl-6">
                                                {stock.symbol}
                                            </div>
                                        </div>
                                        <div className={`text-right ${isPositive ? 'text-red-600' : 'text-blue-600'}`}>
                                            <div className="font-bold text-xs">{formatNumber(stock.price)}</div>
                                            <div className="text-[10px]">{isPositive ? '+' : ''}{formatPercent(stock.changePercent)}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: Mosaic View (4 at a time) */}
                <div className="flex-1 p-4 bg-gray-100 relative">
                    {/* Pass expandedSymbol props if StockMosaic supported or we refactor it.
                        Since StockMosaic handles expansion internally, we need to restructure it or control it.
                        Simplest way: Modify StockMosaic to accept 'expandedState' or just render 'DetailedStockCard' directly here if expanded?
                        Actually, StockMosaic is designed to show a grid.
                        Let's update StockMosaic signature to accept `expandedSymbol` and `onToggleInternal`.
                        BUT for now, I will modify the props passed to StockMosaic to force it to show what we want.
                        Actually, StockMosaic logic is: if local expandedSymbol is set, show 1.
                        We want 'ThemeDashboard' to control it.

                        I will pass `expandedSymbol` prop to StockMosaic (I need to update StockMosaic next).
                    */}
                    <StockMosaic
                        stocks={visibleStocks.map(s => ({ symbol: s.symbol, name: s.name || s.symbol }))}
                        externalExpandedSymbol={expandedSymbol}
                        onCollapse={() => setExpandedSymbol(null)}
                        onExpand={(sym) => setExpandedSymbol(sym)}
                    />
                </div>
            </div>
        </div>
    );
}
