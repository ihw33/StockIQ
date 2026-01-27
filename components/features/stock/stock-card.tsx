'use client';

import { useEffect, useState } from 'react';
import { StockQuote } from '@/lib/providers/stock-provider';

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

import { StockChart } from './stock-chart';
import { StockChartData } from '@/lib/providers/stock-provider';

export function StockCard({ symbol, name }: { symbol: string; name: string }) {
    const [quote, setQuote] = useState<StockQuote | null>(null);
    const [chartData, setChartData] = useState<StockChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        try {
            // Fetch Quote
            const quoteRes = await fetch(`/api/stock/quote?symbol=${symbol}`);
            if (!quoteRes.ok) throw new Error('Failed to fetch quote');
            const quoteData = await quoteRes.json();
            setQuote(quoteData);

            // Fetch Chart
            const chartRes = await fetch(`/api/stock/chart?symbol=${symbol}&interval=D`);
            if (chartRes.ok) {
                const chartData = await chartRes.json();
                setChartData(chartData);
            }

            setError('');
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [symbol]);

    if (loading && !quote) {
        return (
            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow w-full max-w-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded w-1/2"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-900 w-full max-w-sm">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!quote) return null;

    const isPositive = quote.change > 0;
    const isNegative = quote.change < 0;
    const colorClass = isPositive ? 'text-red-500' : isNegative ? 'text-blue-500' : 'text-gray-900';
    const chartColor = isPositive ? '#ef4444' : isNegative ? '#3b82f6' : '#6b7280'; // Red, Blue, Gray

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow w-full max-w-sm overflow-hidden bg-white hover:shadow-lg transition-shadow duration-200">
            <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-semibold leading-none tracking-tight text-lg">{name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{quote.symbol}</p>
                    </div>
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {quote.provider}
                    </div>
                </div>

                <div className="mt-4">
                    <div className={`text-3xl font-bold ${colorClass}`}>
                        {formatNumber(quote.price)}원
                    </div>
                    <div className={`flex items-center mt-1 text-sm font-medium ${colorClass}`}>
                        <span>{isPositive ? '▲' : isNegative ? '▼' : '-'} {formatNumber(Math.abs(quote.change))}</span>
                        <span className="ml-2">({formatPercent(quote.changePercent)})</span>
                    </div>
                </div>

                {/* Mini Chart Area */}
                <div className="mt-4 -mx-2">
                    <StockChart data={chartData} color={chartColor} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                        <span className="block text-xs text-gray-400">시가</span>
                        <span className="font-medium">{formatNumber(quote.open || 0)}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-gray-400">거래량</span>
                        <span className="font-medium">{formatNumber(quote.volume)}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-gray-400">고가</span>
                        <span className="text-red-500 font-medium">{formatNumber(quote.high || 0)}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-gray-400">저가</span>
                        <span className="text-blue-500 font-medium">{formatNumber(quote.low || 0)}</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex justify-between">
                    <span>{new Date(quote.timestamp).toLocaleTimeString()} 기준</span>
                </div>
            </div>
        </div>
    );
}
