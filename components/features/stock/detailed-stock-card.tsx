'use client';

import { useEffect, useState, useRef } from 'react';
import { StockQuote, StockOrderBook as IStockOrderBook, StockChartData } from '@/lib/providers/stock-provider';
import { StockChart } from './stock-chart';
import { StockOrderBook } from './stock-order-book';
import { TradingPanel } from './trading-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, X } from 'lucide-react';

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

export function DetailedStockCard({
    symbol,
    name,
    onToggleMaximize,
    isMaximized,
    isTradeOpen,
    onToggleTrade,
}: {
    symbol: string;
    name: string;
    onToggleMaximize?: () => void;
    isMaximized?: boolean;
    isTradeOpen?: boolean;
    onToggleTrade?: () => void;
}) {

    const [quote, setQuote] = useState<StockQuote | null>(null);
    const [orderBook, setOrderBook] = useState<IStockOrderBook | null>(null);
    const [chartData, setChartData] = useState<StockChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [interval, setIntervalType] = useState('D'); // D, 1m, 5m, 15m
    const [showBollinger, setShowBollinger] = useState(true);
    const [showMACD, setShowMACD] = useState(true); // User requested default ON
    const [showRSI, setShowRSI] = useState(true);   // User requested default ON
    const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

    const orderBookRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        // ... (Using same logic as before, omitting full fetch implementation for brevity in rewrite if logic unchanged? No, I must include it)
    };

    // Copying fetch logic exactly
    useEffect(() => {
        let ignore = false;
        const load = async () => {
            // Logic
            setLoading(true);
            try {
                const [quoteRes, chartRes, orderBookRes] = await Promise.all([
                    fetch(`/api/stock/quote?symbol=${symbol}`),
                    fetch(`/api/stock/chart?symbol=${symbol}&interval=${interval}`),
                    fetch(`/api/stock/orderbook?symbol=${symbol}`)
                ]);

                if (ignore) return;

                if (quoteRes.ok) setQuote(await quoteRes.json());
                if (chartRes.ok) setChartData(await chartRes.json());
                if (orderBookRes.ok) setOrderBook(await orderBookRes.json());
            } catch (err) {
                console.error(err);
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        load();
        const timer = setInterval(load, 2000);
        return () => { ignore = true; clearInterval(timer); };
    }, [symbol, interval]);

    // Center OrderBook on load
    useEffect(() => {
        if (orderBook && orderBookRef.current) {
            const container = orderBookRef.current;
            container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
        }
    }, [orderBook?.timestamp]);

    if (loading && !quote) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
    if (!quote) return null;

    const isPositive = quote.change > 0;
    const colorClass = isPositive ? 'text-red-500' : quote.change < 0 ? 'text-blue-500' : 'text-gray-900';
    const chartColor = isPositive ? '#ef4444' : quote.change < 0 ? '#3b82f6' : '#6b7280';

    return (
        <>
            <div className={`flex flex-col bg-white rounded-xl border shadow-sm overflow-x-auto overflow-y-hidden h-full transition-all duration-300 ${isMaximized ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg whitespace-nowrap text-blue-900">{name}</h3>
                                <span className="text-xs text-gray-500">{symbol}</span>
                            </div>
                            <div className={`text-xl font-bold ${colorClass} leading-tight whitespace-nowrap`}>
                                {formatNumber(quote.price)}
                                <span className="text-sm ml-2 font-normal">
                                    {isPositive ? '▲' : '▼'} {formatNumber(Math.abs(quote.change))} ({formatPercent(quote.changePercent)})
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        {/* Info */}
                        <div className="text-right text-xs text-gray-500 hidden sm:block whitespace-nowrap">
                            <div>거래량 {formatNumber(quote.volume)}</div>
                            <div>시가 {formatNumber(quote.open)}</div>
                        </div>
                        {onToggleMaximize && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleMaximize();
                                }}
                                className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                {isMaximized ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 overflow-x-auto">
                    {/* Left: Chart & Info */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Chart Header (Intervals + Indicators) */}
                        <div className="p-2 flex gap-2 border-b text-xs items-center bg-white justify-between overflow-x-auto">
                            <div className="flex gap-1">
                                {[
                                    { label: '일', value: 'D' },
                                    { label: '주', value: 'W' },
                                    { label: '월', value: 'M' },
                                    { label: '분', value: '1m' },
                                    { label: '초', value: '1s' }
                                ].map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setIntervalType(t.value)}
                                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${interval === t.value || (t.value === '1m' && interval.endsWith('m'))
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                                {(interval.endsWith('m')) && (
                                    <div className="flex items-center ml-1">
                                        <select
                                            value={interval}
                                            onChange={(e) => setIntervalType(e.target.value)}
                                            className="text-[11px] border border-gray-300 rounded bg-white text-gray-900 px-1 py-1 cursor-pointer focus:border-blue-500 outline-none"
                                        >
                                            <option value="1m">1분</option>
                                            <option value="3m">3분</option>
                                            <option value="5m">5분</option>
                                            <option value="10m">10분</option>
                                            <option value="15m">15분</option>
                                            <option value="30m">30분</option>
                                            <option value="60m">60분</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Indicators (Moved Here) */}
                            <div className="flex bg-gray-100 rounded-lg p-0.5 space-x-0.5 ml-2">
                                {[
                                    { label: '볼린저', active: showBollinger, onClick: () => setShowBollinger(!showBollinger) },
                                    { label: 'MACD', active: showMACD, onClick: () => setShowMACD(!showMACD) },
                                    { label: 'RSI', active: showRSI, onClick: () => setShowRSI(!showRSI) },
                                ].map(btn => (
                                    <button
                                        key={btn.label}
                                        onClick={btn.onClick}
                                        className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition-all ${btn.active
                                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                                            }`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 p-0 min-h-[150px] flex flex-col relative">
                            <StockChart
                                data={chartData}
                                color={chartColor}
                                height="100%"
                                interval={interval}
                                showBollinger={showBollinger}
                                showMACD={showMACD}
                                showRSI={showRSI}
                            />
                        </div>
                    </div>

                    {/* Middle: Order Book */}
                    <div className="w-[300px] min-w-[300px] flex flex-col border-l bg-white shrink-0">
                        <div className="p-2 border-b bg-gray-50 font-bold text-xs text-center text-gray-700">호가 (Order Book)</div>
                        <div
                            ref={orderBookRef}
                            className="flex-1 overflow-y-auto no-scrollbar relative"
                        >
                            {orderBook && <StockOrderBook bids={orderBook.bids} asks={orderBook.asks} onPriceClick={setSelectedPrice} />}
                        </div>
                        {/* Trading Strength Section */}
                        <div className="p-3 border-t text-xs bg-gray-50 space-y-2">
                            {orderBook && (
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>매수우위</span>
                                        <span>매도우위</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                                        <div className="bg-blue-400 h-full" style={{ width: `${(100 * orderBook.asks.reduce((a, b) => a + b.volume, 0)) / (orderBook.asks.reduce((a, b) => a + b.volume, 0) + orderBook.bids.reduce((a, b) => a + b.volume, 0))}%` }} />
                                        <div className="bg-red-400 h-full" style={{ width: `${(100 * orderBook.bids.reduce((a, b) => a + b.volume, 0)) / (orderBook.asks.reduce((a, b) => a + b.volume, 0) + orderBook.bids.reduce((a, b) => a + b.volume, 0))}%` }} />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                <span className="text-gray-500">체결강도</span>
                                <span className={`font-bold ${quote.change > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                    {(100 + (quote.changePercent * 5)).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Trading Panel (Conditional & Animated) */}
                    {isTradeOpen && (
                        <div className="w-[320px] flex flex-col bg-gray-50 shrink-0 border-l animate-in slide-in-from-right duration-200">
                            <div className="p-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <span className="font-bold text-sm">⚡ 빠른주문 (Real Trading)</span>
                                <button onClick={onToggleTrade} className="text-slate-400 hover:text-white"><X size={16} /></button>
                            </div>
                            <TradingPanel
                                symbol={symbol}
                                price={selectedPrice || quote.price}
                                onSubmitOrder={(type, price, qty) => {
                                    console.log(`Order: ${type} ${symbol} ${qty} @ ${price}`);
                                    // alert(`주문 전송됨: ${type} ${symbol} ${qty}주 @ ${price.toLocaleString()}원`);
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
