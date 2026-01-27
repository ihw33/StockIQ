"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StockAccount } from '@/lib/providers/stock-provider';
import { RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AccountStatus() {
    const [account, setAccount] = useState<StockAccount | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchAccount = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/stock/account');
            const data = await res.json();

            if (res.ok) {
                setAccount(data);
            } else {
                setError(data.error || 'Failed to fetch account');
            }
        } catch (e) {
            setError('Network Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccount();
        // Poll every 10 seconds? Or just on mount/manual.
        // HTS 0198 is usually real-time or polled. Let's do manual refresh for now to save API quota.
    }, []);

    const formatPrice = (p: number) => p.toLocaleString();
    const formatColor = (val: number) => val > 0 ? 'text-red-400' : val < 0 ? 'text-blue-400' : 'text-white';

    if (!account && loading) return <div className="p-4 text-xs text-gray-500">Loading Account...</div>;
    if (error) return <div className="p-4 text-xs text-red-500">Error: {error}</div>;
    if (!account) return null;

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                    <Wallet size={14} />
                    계좌현황 (0198)
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white" onClick={fetchAccount} disabled={loading}>
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </Button>
            </CardHeader>
            <CardContent className="p-3">
                {/* Summary Section */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs bg-slate-950 p-3 rounded border border-slate-800">
                    <div className="text-gray-400">총매입(자산)</div>
                    <div className="text-right font-mono text-white text-sm font-semibold">{formatPrice(account.totalAsset)}원</div>

                    <div className="text-gray-400">예수금(D+2)</div>
                    <div className="text-right font-mono text-white text-sm font-semibold">{formatPrice(account.deposit)}원</div>

                    <div className="text-gray-400">총평가손익</div>
                    <div className={`text-right font-mono text-sm font-bold ${formatColor(account.totalReturn)}`}>
                        {formatPrice(account.totalReturn)}원
                    </div>

                    <div className="text-gray-400">총수익률</div>
                    <div className={`text-right font-mono text-sm font-bold ${formatColor(account.returnRate)}`}>
                        {account.returnRate}%
                    </div>
                </div>

                {/* Positions Table */}
                <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-slate-900 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-2 text-left">종목명</th>
                                <th className="p-2">보유</th>
                                <th className="p-2">매입가</th>
                                <th className="p-2">현재가</th>
                                <th className="p-2">평가손익</th>
                                <th className="p-2">수익률</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {account.positions.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">보유 종목이 없습니다.</td></tr>
                            ) : account.positions.map((pos) => (
                                <tr key={pos.symbol} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-2 text-left font-medium text-white">
                                        {pos.name}
                                        <div className="text-[10px] text-gray-500">{pos.symbol}</div>
                                    </td>
                                    <td className="p-2 text-gray-300">{pos.quantity}</td>
                                    <td className="p-2 text-gray-300">{formatPrice(pos.avgPrice)}</td>
                                    <td className={`p-2 ${formatColor(pos.currentPrice - pos.avgPrice)}`}>
                                        {formatPrice(pos.currentPrice)}
                                    </td>
                                    <td className={`p-2 ${formatColor(pos.totalReturn)}`}>
                                        {formatPrice(pos.totalReturn)}
                                    </td>
                                    <td className={`p-2 ${formatColor(pos.returnRate)}`}>
                                        {pos.returnRate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
