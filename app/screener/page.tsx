'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ScreenerResult } from '@/lib/types/screener';

type SortField = 'symbol' | 'name' | 'market_cap' | 'per' | 'pbr' | 'roe' | 'eps' | 'cur_price' | 'volume';
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
            // 현재 정렬된 상위 20개 종목만
            const top20Symbols = sortedStocks.slice(0, 20).map(s => s.symbol);

            const res = await fetch('http://localhost:8001/api/screener/v2/realtime', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ symbols: top20Symbols })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();

            // 실시간 데이터로 stocks 업데이트
            setStocks(prevStocks => {
                const updated = [...prevStocks];
                data.results.forEach((rt: any) => {
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
                                {realtimeUpdating ? '업데이트 중...' : '실시간 정보 (상위 20개)'}
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
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                <th
                                    onClick={() => handleSort('symbol')}
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        종목코드
                                        {sortField === 'symbol' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('name')}
                                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        종목명
                                        {sortField === 'name' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    시장
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    업종
                                </th>
                                <th
                                    onClick={() => handleSort('market_cap')}
                                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        시가총액
                                        {sortField === 'market_cap' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('per')}
                                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        PER
                                        {sortField === 'per' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('pbr')}
                                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        PBR
                                        {sortField === 'pbr' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('roe')}
                                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        ROE
                                        {sortField === 'roe' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('eps')}
                                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        EPS
                                        {sortField === 'eps' && (
                                            <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {sortedStocks.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                                        검색 결과가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                sortedStocks.map((stock) => (
                                    <tr
                                        key={stock.symbol}
                                        className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3 text-sm font-mono text-slate-300">
                                            {stock.symbol}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-white">
                                            {stock.name}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                stock.market === 'KOSPI'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : stock.market.includes('GLOBAL') || stock.market === 'KONEX'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-green-500/20 text-green-400'
                                            }`}>
                                                {stock.market}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {stock.industry}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-slate-300">
                                            {stock.market_cap > 0
                                                ? `${(stock.market_cap / 100000000).toFixed(0)}억`
                                                : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.per ? stock.per.toFixed(2) : <span className="text-slate-600">N/A</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.pbr ? stock.pbr.toFixed(2) : <span className="text-slate-600">N/A</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.roe ? (
                                                <span className={stock.roe > 10 ? 'text-emerald-400' : ''}>
                                                    {stock.roe.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-600">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.eps ? `${stock.eps.toLocaleString()}원` : <span className="text-slate-600">N/A</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    ) : (
                    /* 거래 정보 테이블 */
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                <th onClick={() => handleSort('symbol')} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors">
                                    <div className="flex items-center gap-1">
                                        종목코드 {sortField === 'symbol' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('name')} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors">
                                    <div className="flex items-center gap-1">
                                        종목명 {sortField === 'name' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('cur_price')} className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors">
                                    <div className="flex items-center justify-end gap-1">
                                        현재가 {sortField === 'cur_price' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    전일대비
                                </th>
                                <th onClick={() => handleSort('volume')} className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors">
                                    <div className="flex items-center justify-end gap-1">
                                        거래량 {sortField === 'volume' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    거래대금
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {sortedStocks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        검색 결과가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                sortedStocks.map((stock) => (
                                    <tr key={stock.symbol} className="hover:bg-slate-800/50 transition-colors cursor-pointer">
                                        <td className="px-4 py-3 text-sm font-mono text-slate-300">{stock.symbol}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-white">{stock.name}</td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.cur_price ? `${stock.cur_price.toLocaleString()}원` : <span className="text-slate-600">N/A</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono">
                                            {stock.change != null ? (
                                                <div className={stock.change > 0 ? 'text-red-400' : stock.change < 0 ? 'text-blue-400' : 'text-slate-300'}>
                                                    <div>{stock.change > 0 ? '▲' : stock.change < 0 ? '▼' : '-'} {Math.abs(stock.change).toLocaleString()}원</div>
                                                    <div className="text-xs">{stock.change_pct != null ? `${stock.change_pct > 0 ? '+' : ''}${stock.change_pct}%` : ''}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.volume ? stock.volume.toLocaleString() : <span className="text-slate-600">N/A</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                                            {stock.trade_amount ? `${(stock.trade_amount / 100000000).toFixed(0)}억` : <span className="text-slate-600">N/A</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-slate-600">
                데이터 출처: FinanceDataReader (종목 정보) + Kiwoom API (재무 지표)
            </div>
        </div>
    );
}
