'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ScreenerResult } from '@/lib/types/screener';

type SortField = 'symbol' | 'name' | 'market_cap' | 'per' | 'pbr' | 'roe' | 'eps' | 'cur_price' | 'volume' | 'change' | 'change_pct' | 'revenue' | 'operating_profit_growth';
type SortOrder = 'asc' | 'desc';

export default function ScreenerPage() {
    const [stocks, setStocks] = useState<ScreenerResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [realtimeUpdating, setRealtimeUpdating] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('market_cap');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 캐시에서 조회 (빠름)
            const res = await fetch('http://localhost:8001/api/screener/v2/list', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'theme',
                    name: '반도체 장비'
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            setStocks(data.results || []);
            if (data.last_updated) {
                setLastUpdate(new Date(data.last_updated));
            }
        } catch (err: any) {
            console.error('[Screener] Load error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        setUpdating(true);
        try {
            // Kiwoom API 조회 후 캐시 업데이트 (느림)
            const res = await fetch('http://localhost:8001/api/screener/v2/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'theme',
                    name: '반도체 장비'
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            setStocks(data.results || []);
            setLastUpdate(new Date());
        } catch (err: any) {
            console.error('[Screener] Update error:', err);
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // 같은 필드 클릭 시 정렬 순서 반전
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // 새 필드 클릭 시 내림차순으로 시작
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleRealtimeUpdate = async () => {
        setRealtimeUpdating(true);
        try {
            // 전체 종목 실시간 정보 조회 (배치로 나눠서)
            const allSymbols = sortedStocks.map(s => s.symbol);
            const batchSize = 30;
            const batches = [];

            for (let i = 0; i < allSymbols.length; i += batchSize) {
                batches.push(allSymbols.slice(i, i + batchSize));
            }

            console.log(`[Screener] Fetching realtime data in ${batches.length} batches...`);

            // 모든 배치 병렬 처리
            const batchResults = await Promise.all(
                batches.map(async (batch) => {
                    const res = await fetch('http://localhost:8001/api/screener/v2/realtime', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ symbols: batch })
                    });

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }

                    return res.json();
                })
            );

            // 모든 결과 합치기
            const allResults = batchResults.flatMap(data => data.results || []);

            // 실시간 데이터로 stocks 업데이트
            setStocks(prevStocks => {
                const updated = [...prevStocks];
                allResults.forEach((rt: any) => {
                    const idx = updated.findIndex(s => s.symbol === rt.symbol);
                    if (idx !== -1) {
                        updated[idx] = {
                            ...updated[idx],
                            cur_price: rt.cur_price,
                            change: rt.change,
                            change_pct: rt.change_pct,
                            volume: rt.volume,
                            trade_amount: rt.trade_amount
                        };
                    }
                });
                return updated;
            });
        } catch (err: any) {
            console.error('[Screener] Realtime update error:', err);
            setError(err.message);
        } finally {
            setRealtimeUpdating(false);
        }
    };

    // 정렬된 데이터
    const sortedStocks = [...stocks].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        // null/undefined 처리
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // 숫자 비교
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // 문자열 비교
        const aStr = String(aVal);
        const bStr = String(bVal);
        const comparison = aStr.localeCompare(bStr, 'ko');
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">로딩 중...</div>
                    <div className="text-sm text-gray-600">반도체 장비 종목을 불러오는 중입니다</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center max-w-md">
                    <div className="text-2xl font-bold text-red-600 mb-2">오류 발생</div>
                    <div className="text-sm text-gray-600 mb-4">{error}</div>
                    <Button onClick={loadData} className="bg-indigo-600 hover:bg-indigo-700 text-white">다시 시도</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                반도체 장비 스크리너
                            </h1>
                            <p className="text-sm text-gray-600">
                                총 <span className="text-indigo-600 font-semibold">{stocks.length}</span>개 종목
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {lastUpdate && (
                                <span className="text-sm text-gray-500">
                                    {lastUpdate.toLocaleString('ko-KR', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            )}
                            <Button
                                onClick={handleRealtimeUpdate}
                                disabled={realtimeUpdating}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {realtimeUpdating ? '업데이트 중...' : '실시간 정보 업데이트'}
                            </Button>
                            <Button
                                onClick={handleUpdate}
                                disabled={updating}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {updating ? '업데이트 중...' : '전체 업데이트'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-300 bg-gray-100">
                                    <th
                                        onClick={() => handleSort('symbol')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center gap-1">
                                            종목코드
                                            {sortField === 'symbol' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center gap-1">
                                            종목명
                                            {sortField === 'name' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        시장
                                    </th>
                                    <th
                                        onClick={() => handleSort('cur_price')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            현재가
                                            {sortField === 'cur_price' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('change_pct')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            전일대비
                                            {sortField === 'change_pct' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('volume')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            거래량
                                            {sortField === 'volume' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('market_cap')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            시가총액
                                            {sortField === 'market_cap' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('revenue')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex flex-col items-end gap-0.5">
                                            <div className="flex items-center gap-1">
                                                매출액
                                                {sortField === 'revenue' && (
                                                    <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                )}
                                            </div>
                                            {sortedStocks.length > 0 && sortedStocks[0].fiscal_period && (
                                                <span className="text-[10px] font-normal text-gray-500 normal-case">
                                                    ({sortedStocks[0].fiscal_period})
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('operating_profit_growth')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex flex-col items-end gap-0.5">
                                            <div className="flex items-center gap-1">
                                                영업이익증가율
                                                {sortField === 'operating_profit_growth' && (
                                                    <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                                )}
                                            </div>
                                            {sortedStocks.length > 0 && sortedStocks[0].fiscal_period && (
                                                <span className="text-[10px] font-normal text-gray-500 normal-case">
                                                    (전년 동기 대비)
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('per')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            PER
                                            {sortField === 'per' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('pbr')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            PBR
                                            {sortField === 'pbr' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('roe')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            ROE
                                            {sortField === 'roe' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('eps')}
                                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            EPS
                                            {sortField === 'eps' && (
                                                <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sortedStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                                            검색 결과가 없습니다
                                        </td>
                                    </tr>
                                ) : (
                                    sortedStocks.map((stock) => (
                                        <tr
                                            key={stock.symbol}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                                {stock.symbol}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                                {stock.name}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                    stock.market === 'KOSPI'
                                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                        : stock.market.includes('GLOBAL') || stock.market === 'KONEX'
                                                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                                        : 'bg-green-100 text-green-700 border border-green-200'
                                                }`}>
                                                    {stock.market}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.cur_price ? `${stock.cur_price.toLocaleString()}원` : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono">
                                                {stock.change != null ? (
                                                    <div className={stock.change > 0 ? 'text-red-600' : stock.change < 0 ? 'text-blue-600' : 'text-gray-900'}>
                                                        <div className="font-semibold">
                                                            {stock.change > 0 ? '▲' : stock.change < 0 ? '▼' : '-'} {Math.abs(stock.change).toLocaleString()}
                                                        </div>
                                                        <div className="text-xs">
                                                            {stock.change_pct != null ? `${stock.change_pct > 0 ? '+' : ''}${stock.change_pct}%` : ''}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.volume ? stock.volume.toLocaleString() : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.market_cap > 0
                                                    ? `${(stock.market_cap / 100000000).toFixed(0)}억`
                                                    : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.revenue && stock.revenue > 0
                                                    ? `${(stock.revenue / 100000000).toFixed(0)}억`
                                                    : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.operating_profit_growth != null ? (
                                                    <span className={stock.operating_profit_growth > 0 ? 'text-green-600 font-semibold' : stock.operating_profit_growth < 0 ? 'text-red-600' : ''}>
                                                        {stock.operating_profit_growth > 0 ? '+' : ''}{stock.operating_profit_growth.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.per ? stock.per.toFixed(2) : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.pbr ? stock.pbr.toFixed(2) : <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.roe ? (
                                                    <span className={stock.roe > 10 ? 'text-green-600 font-semibold' : ''}>
                                                        {stock.roe.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                                                {stock.eps ? `${stock.eps.toLocaleString()}원` : <span className="text-gray-400">N/A</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-gray-500">
                데이터 출처: FinanceDataReader (종목 정보) + Kiwoom API (재무 지표)
            </div>
        </div>
    );
}
