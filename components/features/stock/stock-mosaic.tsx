import { useState } from 'react';
import { DetailedStockCard } from './detailed-stock-card';

interface StockMosaicProps {
    stocks: {
        symbol: string;
        name: string;
        price?: number;
        change?: number;
        changePercent?: number;
        volume?: number;
    }[];
    externalExpandedSymbol?: string | null;
    onCollapse?: () => void;
    onExpand?: (symbol: string) => void;
}

export function StockMosaic({ stocks, externalExpandedSymbol, onCollapse, onExpand }: StockMosaicProps) {
    const [internalExpandedSymbol, setInternalExpandedSymbol] = useState<string | null>(null);

    // Prioritize External Prop if present (controlled mode), else use internal
    const expandedSymbol = externalExpandedSymbol !== undefined ? externalExpandedSymbol : internalExpandedSymbol;
    const handleExpand = (symbol: string | null) => {
        if (symbol === null) {
            if (onCollapse) onCollapse();
            else setInternalExpandedSymbol(null);
        } else {
            if (onExpand) onExpand(symbol);
            else setInternalExpandedSymbol(symbol);
        }
    };

    if (!stocks || stocks.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
                Select a theme to view stocks
            </div>
        );
    }

    // If Expanded, show only one
    if (expandedSymbol) {
        // If we are in pagination mode, the 'expandedSymbol' might not be in the current 'stocks' slice (visible 4).
        // But for data fetching purposes, DetailedStockCard just needs symbol/name.
        // We need to find the name from the stocks array. If pagination slices stocks, we might miss it if we only pass visible stocks.
        // However, in ThemeDashboard, we passed 'visibleStocks'. If user clicked a number in list that IS NOT VISIBLE in mosaic, 'visibleStocks' wont have it.
        // But ThemeDashboard logic: "list shows ALL 8". User clicks item 6. `expandedSymbol` becomes item 6.
        // `StockMosaic` receives `visibleStocks` (items 5-8). Item 6 is there.
        // Case 2: User clicks item 1 (page 1). `expandedSymbol` is item 1. `visibleStocks` is items 5-8.
        // `StockMosaic` won't find item 1 in `stocks` prop.
        // ERROR: We should probably pass ALL stocks to StockMosaic if we want it to resolve names for expanded items outside current page?
        // OR `ThemeDashboard` should handle the single view if expanded?

        // BETTER APPROACH for this iteration:
        // `ThemeDashboard` handles the "Single View" if expanded.
        // But `StockMosaic` currently has the code for Single View.
        // Let's just fix StockMosaic to render the expanded card even if not in 'stocks' array? 
        // We need 'name'. 'stocks' prop usually has name.
        // If 'stocks' only has 4 items, we might miss the name if cross-page.
        // BUT, since 'expanded' overrides everything, let's assume valid data is passed or we fallback.
        // Actually, if we use `ThemeDashboard` to slice, `StockMosaic` blindly renders what it gets.
        // If expanded, `ThemeDashboard` passes visibleStocks.

        // Issue: If I expand Item 1, but I am on Page 2 (Items 5-8).
        // `ThemeDashboard` says `expandedSymbol = Item 1`.
        // `visibleStocks` = [5,6,7,8].
        // `StockMosaic` receives `expanded=Item1` and `stocks=[5,6,7,8]`.
        // `stocks.find(Item1)` fails.
        // Returns null.

        // FIX: The `stocks` prop passed to StockMosaic when expanded should probably be ALL stocks or at least include the expanded one.
        // However, `ThemeDashboard` logic `const visibleStocks = stocks.slice...` happens before return.

        // Quick Fix in `ThemeDashboard`: If expanded, pass ALL stocks or special handling?
        // Let's stick to modifying `StockMosaic` here first.

        const stock = stocks.find(s => s.symbol === expandedSymbol) || { symbol: expandedSymbol, name: expandedSymbol }; // Fallback name = symbol

        return (
            <div className="w-full h-full p-0">
                <DetailedStockCard
                    symbol={stock.symbol}
                    name={stock.name}
                    isMaximized={true}
                    onToggleMaximize={() => handleExpand(null)}
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <div className="grid grid-cols-4 gap-2 h-full">
                {stocks.map((stock) => (
                    <div key={stock.symbol} className="h-full min-h-[220px]">
                        <DetailedStockCard
                            symbol={stock.symbol}
                            name={stock.name}
                            onToggleMaximize={() => handleExpand(stock.symbol)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
