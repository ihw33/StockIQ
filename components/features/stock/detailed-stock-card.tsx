'use client';

import { useEffect, useState } from 'react';
import { StockQuote, StockChartData } from '@/lib/providers/stock-provider';
import { StockChart } from './stock-chart';
import { Plus, Pencil, RefreshCw } from 'lucide-react';
import { PositionModal } from '@/components/features/portfolio/trade-modal';
import { usePortfolioStore } from '@/lib/stores/portfolio-store';

interface InvestorTrends {
    foreign: number | null;
    institution: number | null;
    individual: number | null;
}

function formatNumber(num: number) {
    return new Intl.NumberFormat('ko-KR').format(num);
}

function formatCompact(num: number): string {
    const abs = Math.abs(num);
    const sign = num > 0 ? '+' : '';
    if (abs >= 100000000) return `${sign}${(num / 100000000).toFixed(1)}억`;
    if (abs >= 10000) return `${sign}${(num / 10000).toFixed(1)}만`;
    return `${sign}${formatNumber(num)}`;
}

function formatEok(num: number): string {
    const sign = num > 0 ? '+' : '';
    const abs = Math.abs(num);
    if (abs >= 10000) return `${sign}${(num / 10000).toFixed(1)}조`;
    return `${sign}${formatNumber(num)}억`;
}

function InvestorRow({ label, data, unit }: { label: string; data: InvestorTrends; unit?: 'eok' }) {
    const items = [
        { key: '외인', value: data.foreign },
        { key: '기관', value: data.institution },
        { key: '개인', value: data.individual },
    ];
    return (
        <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[10px] w-6">{label}</span>
            {items.map(item => (
                <span key={item.key} className="whitespace-nowrap">
                    <span className="text-gray-500">{item.key}</span>
                    <span className={`ml-0.5 font-semibold ${
                        (item.value ?? 0) > 0 ? 'text-red-500' : (item.value ?? 0) < 0 ? 'text-blue-500' : 'text-gray-500'
                    }`}>
                        {item.value != null ? (unit === 'eok' ? formatEok(item.value) : formatCompact(item.value)) : '-'}
                    </span>
                </span>
            ))}
        </div>
    );
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
}: {
    symbol: string;
    name: string;
    onToggleMaximize?: () => void;
    isMaximized?: boolean;
}) {

    const [quote, setQuote] = useState<StockQuote | null>(null);
    const [chartData, setChartData] = useState<StockChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [interval, setIntervalType] = useState('D');
    const [showBollinger, setShowBollinger] = useState(true);
    const [showMACD, setShowMACD] = useState(true);
    const [showRSI, setShowRSI] = useState(true);
    const [positionModal, setPositionModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit' } | null>(null);
    const existingPosition = usePortfolioStore((s) => s.getPosition(symbol));
    const [afterHours, setAfterHours] = useState<{ cur_price: number | null; change: number | null; change_rate: number | null; volume: number | null; source?: string } | null>(null);
    const [investorTrends, setInvestorTrends] = useState<InvestorTrends | null>(null);
    const [marketTrends, setMarketTrends] = useState<InvestorTrends | null>(null);
    const [trendsLoading, setTrendsLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            setLoading(true);
            try {
                const [quoteRes, chartRes] = await Promise.all([
                    fetch(`/api/stock/quote?symbol=${symbol}`),
                    fetch(`/api/stock/chart?symbol=${symbol}&interval=${interval}`),
                ]);

                if (ignore) return;

                if (quoteRes.ok) setQuote(await quoteRes.json());
                if (chartRes.ok) setChartData(await chartRes.json());
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

    // After-hours price (fetch once, no polling)
    useEffect(() => {
        let ignore = false;
        setAfterHours(null);
        const loadAH = async () => {
            try {
                const res = await fetch(`/api/stock/after-hours?symbol=${symbol}`);
                if (res.ok) {
                    const json = await res.json();
                    if (!ignore && json.status === 'success' && json.data?.cur_price) {
                        setAfterHours(json.data);
                    }
                }
            } catch { /* silently fail */ }
        };
        loadAH();
        return () => { ignore = true; };
    }, [symbol]);

    // Investor trends: per-stock + market (삼성전자 proxy)
    const loadTrends = async () => {
        setTrendsLoading(true);
        try {
            const [stockRes, marketRes] = await Promise.all([
                fetch(`/api/stock/investor-trends?symbol=${symbol}`),
                fetch('/api/market/investor-trends'),
            ]);
            if (stockRes.ok) {
                const json = await stockRes.json();
                if (json.status === 'success' && json.data) setInvestorTrends(json.data);
            }
            if (marketRes.ok) {
                const json = await marketRes.json();
                if (json.status === 'success' && json.data) setMarketTrends(json.data);
            }
        } catch { /* silently fail */ }
        setTrendsLoading(false);
    };
    useEffect(() => {
        setInvestorTrends(null);
        setMarketTrends(null);
        loadTrends();
    }, [symbol]);

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
                            {afterHours && afterHours.cur_price && (afterHours.source?.startsWith('NEXT') || afterHours.cur_price !== quote.price || (afterHours.volume ?? 0) > 0) && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                                        {afterHours.source?.startsWith('NEXT') ? '넥스트' : '시간외'}
                                    </span>
                                    <span className={`text-sm font-semibold ${(afterHours.change ?? 0) > 0 ? 'text-red-500' : (afterHours.change ?? 0) < 0 ? 'text-blue-500' : 'text-gray-600'}`}>
                                        {formatNumber(Math.abs(afterHours.cur_price))}
                                    </span>
                                    {afterHours.change != null && afterHours.change !== 0 && (
                                        <span className={`text-xs ${afterHours.change > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {afterHours.change > 0 ? '+' : ''}{formatNumber(afterHours.change)}
                                            {afterHours.change_rate != null && ` (${afterHours.change_rate > 0 ? '+' : ''}${afterHours.change_rate.toFixed(2)}%)`}
                                        </span>
                                    )}
                                    {afterHours.volume != null && afterHours.volume > 0 && (
                                        <span className="text-[10px] text-gray-400">vol {formatNumber(afterHours.volume)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        {/* Investor Trends + Refresh */}
                        {(investorTrends || marketTrends) && (
                            <div className="hidden sm:flex items-center gap-2 border-r border-gray-200 pr-4">
                                <div className="flex flex-col gap-0.5 text-xs">
                                    {marketTrends && <InvestorRow label="시장" data={marketTrends} unit="eok" />}
                                    {investorTrends && <InvestorRow label="종목" data={investorTrends} />}
                                </div>
                                <button
                                    onClick={() => loadTrends()}
                                    disabled={trendsLoading}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400 hover:text-gray-600"
                                    title="수급 새로고침"
                                >
                                    <RefreshCw size={12} className={trendsLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        )}

                        {/* Info */}
                        <div className="text-right text-xs text-gray-500 hidden sm:block whitespace-nowrap">
                            <div>거래량 {formatNumber(quote.volume)}</div>
                            <div>시가 {formatNumber(quote.open)}</div>
                        </div>

                        {/* Position Buttons */}
                        <div className="flex gap-2">
                            {existingPosition ? (
                                <button
                                    onClick={() => setPositionModal({ isOpen: true, mode: 'edit' })}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1"
                                >
                                    <Pencil size={14} />
                                    수정
                                </button>
                            ) : (
                                <button
                                    onClick={() => setPositionModal({ isOpen: true, mode: 'add' })}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    등록
                                </button>
                            )}
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

                <div className="flex-1 min-h-0 flex flex-col">
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
            </div>

            {/* Position Modal */}
            {positionModal && (
                <PositionModal
                    isOpen={positionModal.isOpen}
                    onClose={() => setPositionModal(null)}
                    mode={positionModal.mode}
                    symbol={symbol}
                    symbolName={name}
                />
            )}
        </>
    );
}
