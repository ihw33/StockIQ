'use client';

import { OrderBookItem } from '@/lib/providers/stock-provider';

interface StockOrderBookProps {
    bids: OrderBookItem[];
    asks: OrderBookItem[];
    onPriceClick?: (price: number) => void;
}

export function StockOrderBook({ bids, asks, onPriceClick }: StockOrderBookProps) {
    // Asks need to be reversed for display if they are sorted Ascending (Lowest Price first).
    // We want High prices on top, Low prices (near current) on bottom for Asks.
    const displayAsks = [...asks].reverse();

    // Find max volume for bar width
    const maxVolume = Math.max(
        ...bids.map(b => b.volume),
        ...asks.map(a => a.volume)
    );

    // Calculate Totals
    const totalAskVolume = asks.reduce((sum, item) => sum + item.volume, 0);
    const totalBidVolume = bids.reduce((sum, item) => sum + item.volume, 0);

    // Helper for deterministic mock execution strength
    const getExecStrength = (price: number) => {
        // Pseudo-random based on price to be stable
        const val = (price * 13) % 100;
        return val < 20 ? 20 + val : val; // Min 20%
    };

    const colExec = "w-[15%] border-r border-gray-100";
    const colLeft = "w-[28%]"; // Ask Vol or Empty
    const colCenter = "w-[28%]"; // Price
    const colRight = "w-[29%]"; // Bid Vol or Empty

    return (
        <div className="text-xs w-full flex flex-col font-mono select-none">
            {/* Asks (Sell Orders) - Blueish background */}
            <div className="flex flex-col bg-blue-50">
                {/* Total Ask Volume (Top) */}
                <div className="flex items-center h-6 border-b border-blue-200 bg-blue-100 font-bold text-gray-700">
                    <div className={colExec}></div>
                    <div className={`${colLeft} text-right pr-2`}>{new Intl.NumberFormat('ko-KR').format(totalAskVolume)}</div>
                    <div className={`${colCenter} text-center text-xs text-gray-500`}>매도잔량</div>
                    <div className={colRight}></div>
                </div>

                {displayAsks.map((item, i) => {
                    const execRate = getExecStrength(item.price);
                    return (
                        <div
                            key={`ask-${i}`}
                            onClick={() => onPriceClick?.(item.price)}
                            className="flex items-center h-6 relative border-b border-blue-100 text-[11px] cursor-pointer hover:bg-blue-100 transition-colors"
                        >
                            {/* Execution Rate Column */}
                            <div className={`${colExec} h-full relative flex items-center justify-end pr-1 bg-white`}>
                                <div className="absolute left-0 top-1 bottom-1 bg-gray-200" style={{ width: `${execRate}%` }}></div>
                                <span className="z-10 text-gray-500 text-[10px]">{execRate}%</span>
                            </div>

                            {/* Ask Volume */}
                            <div className={`${colLeft} relative h-full flex items-center justify-end pr-2`}>
                                <div className="absolute right-0 h-full bg-blue-200 opacity-50" style={{ width: `${(item.volume / maxVolume) * 100}%` }}></div>
                                <span className="z-10 text-gray-800">{new Intl.NumberFormat('ko-KR').format(item.volume)}</span>
                            </div>

                            {/* Price */}
                            <div className={`${colCenter} text-center text-blue-600 font-bold bg-blue-50`}>{new Intl.NumberFormat('ko-KR').format(item.price)}</div>

                            {/* Right Empty */}
                            <div className={colRight}></div>
                        </div>
                    );
                })}
            </div>

            {/* Bids (Buy Orders) - Reddish background */}
            <div className="flex flex-col bg-red-50">
                {bids.map((item, i) => {
                    const execRate = getExecStrength(item.price);
                    return (
                        <div
                            key={`bid-${i}`}
                            onClick={() => onPriceClick?.(item.price)}
                            className="flex items-center h-6 relative border-b border-red-100 text-[11px] cursor-pointer hover:bg-red-100 transition-colors"
                        >
                            {/* Execution Rate Column */}
                            <div className={`${colExec} h-full relative flex items-center justify-end pr-1 bg-white`}>
                                <div className="absolute left-0 top-1 bottom-1 bg-gray-200" style={{ width: `${execRate}%` }}></div>
                                <span className="z-10 text-gray-500 text-[10px]">{execRate}%</span>
                            </div>

                            {/* Left Empty */}
                            <div className={colLeft}></div>

                            {/* Price */}
                            <div className={`${colCenter} text-center text-red-600 font-bold bg-red-50`}>{new Intl.NumberFormat('ko-KR').format(item.price)}</div>

                            {/* Bid Volume */}
                            <div className={`${colRight} relative h-full flex items-center justify-start pl-2`}>
                                <div className="absolute left-0 h-full bg-red-200 opacity-50" style={{ width: `${(item.volume / maxVolume) * 100}%` }}></div>
                                <span className="z-10 text-gray-800">{new Intl.NumberFormat('ko-KR').format(item.volume)}</span>
                            </div>
                        </div>
                    );
                })}

                {/* Total Bid Volume (Bottom) */}
                <div className="flex items-center h-6 border-t border-red-200 bg-red-100 font-bold text-gray-700">
                    <div className={colExec}></div>
                    <div className={colLeft}></div>
                    <div className={`${colCenter} text-center text-xs text-gray-500`}>매수잔량</div>
                    <div className={`${colRight} text-left pl-2`}>{new Intl.NumberFormat('ko-KR').format(totalBidVolume)}</div>
                </div>
            </div>
        </div>
    );
}
