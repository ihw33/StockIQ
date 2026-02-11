'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ScreenerResult } from '@/lib/types/screener';

export default function ScreenerPage() {
    const [stocks, setStocks] = useState<ScreenerResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('http://localhost:8001/api/screener/v2/run', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({profile: 'semiconductor_equipment'})
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            setStocks(data.results || []);
            setLastUpdate(new Date());
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
            // 현재는 loadData와 동일 (향후 별도 업데이트 API 추가 가능)
            await loadData();
        } finally {
            setUpdating(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-2">로딩 중...</div>
                    <div className="text-sm text-slate-400">반도체 장비 종목을 불러오는 중입니다</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center max-w-md">
                    <div className="text-2xl font-bold text-red-400 mb-2">오류 발생</div>
                    <div className="text-sm text-slate-400 mb-4">{error}</div>
                    <Button onClick={loadData}>다시 시도</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">
                        스크리너 프로토타입
                    </h1>
                    <p className="text-sm text-slate-400">
                        반도체 장비 업종 · 총 <span className="text-indigo-400 font-semibold">{stocks.length}</span>개 종목
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {lastUpdate && (
                        <span className="text-sm text-slate-500">
                            마지막 업데이트: {lastUpdate.toLocaleString('ko-KR', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    )}
                    <Button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {updating ? '업데이트 중...' : '데이터 업데이트'}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    종목코드
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    종목명
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    업종
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    시가총액
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    PER
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    PBR
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    ROE
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    EPS
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {stocks.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                        검색 결과가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                stocks.map((stock) => (
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
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-slate-600">
                데이터 출처: FinanceDataReader (종목 정보) + Kiwoom API (재무 지표)
            </div>
        </div>
    );
}
