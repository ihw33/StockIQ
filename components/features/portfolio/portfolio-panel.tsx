"use client";

import React, { useState } from 'react';
import { usePortfolioStore } from '@/lib/stores/portfolio-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2, Wallet, Plus, RefreshCw } from 'lucide-react';
import { PositionModal } from './trade-modal';
import { cn } from '@/lib/utils';

interface PortfolioPanelProps {
    currentSymbol?: string;
    onSelectSymbol?: (symbol: string, name: string) => void;
}

export function PortfolioPanel({ currentSymbol, onSelectSymbol }: PortfolioPanelProps) {
    const [mounted, setMounted] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const positions = usePortfolioStore((state) => state.positions);
    const removePosition = usePortfolioStore((state) => state.removePosition);
    const syncFromKiwoom = usePortfolioStore((state) => state.syncFromKiwoom);
    const lastSyncedAt = usePortfolioStore((state) => state.lastSyncedAt);
    const totalValue = usePortfolioStore((state) => state.getTotalValue());
    const totalProfit = usePortfolioStore((state) => state.getTotalProfit());

    React.useEffect(() => {
        setMounted(true);
        // 마운트 시 자동 싱크 (마지막 싱크가 1시간 이상 지났으면)
        const last = usePortfolioStore.getState().lastSyncedAt;
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (!last || new Date(last).getTime() < hourAgo) {
            syncFromKiwoom();
        }
    }, []);

    const [positionModal, setPositionModal] = useState<{
        isOpen: boolean;
        mode: 'add' | 'edit';
        symbol?: string;
        symbolName?: string;
    }>({ isOpen: false, mode: 'add' });

    const totalProfitRate = totalValue > 0 ? (totalProfit / (totalValue - totalProfit)) * 100 : 0;

    if (!mounted) return <div className="w-80 h-full bg-slate-950 border-r border-slate-800" />;

    return (
        <>
            <div className="w-80 h-full bg-slate-950 border-r border-slate-800 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-purple-400" />
                            <h2 className="text-lg font-bold text-white">포트폴리오</h2>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={async () => {
                                    setSyncing(true);
                                    await syncFromKiwoom();
                                    setSyncing(false);
                                }}
                                disabled={syncing}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg transition-colors border border-emerald-800/50"
                                title="키움 보유종목 동기화"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
                                {syncing ? '동기화...' : '키움 싱크'}
                            </button>
                            <button
                                onClick={() => setPositionModal({ isOpen: true, mode: 'add' })}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors border border-blue-800/50"
                            >
                                <Plus className="w-3.5 h-3.5" /> 등록
                            </button>
                        </div>
                    </div>

                    {lastSyncedAt && (
                        <p className="text-[10px] text-slate-600 mb-2">
                            키움 동기화: {new Date(lastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}

                    {/* Total Summary */}
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">총 평가금액</span>
                            <span className="text-white font-mono font-bold">
                                {totalValue.toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">총 손익</span>
                            <span className={cn(
                                "font-mono font-bold",
                                totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원
                                <span className="text-xs ml-1">
                                    ({totalProfitRate >= 0 ? '+' : ''}{totalProfitRate.toFixed(2)}%)
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Positions List */}
                <ScrollArea className="flex-1">
                    {positions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
                            <Wallet className="w-12 h-12 mb-3 opacity-50" />
                            <p className="text-sm text-center mb-2">보유 종목이 없습니다</p>
                            <button
                                onClick={() => setPositionModal({ isOpen: true, mode: 'add' })}
                                className="text-blue-400 hover:underline text-sm"
                            >
                                종목 등록
                            </button>
                        </div>
                    ) : (
                        <div className="p-2 space-y-2">
                            {positions.map((position) => (
                                <div
                                    key={position.symbol}
                                    className={cn(
                                        "bg-slate-900/30 hover:bg-slate-900/60 rounded-lg p-3 cursor-pointer transition-all border",
                                        currentSymbol === position.symbol
                                            ? "border-purple-600 bg-slate-900/80"
                                            : "border-transparent"
                                    )}
                                    onClick={() => onSelectSymbol?.(position.symbol, position.symbolName)}
                                >
                                    {/* Symbol Name */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h3 className="text-white font-semibold">{position.symbolName}</h3>
                                            <p className="text-xs text-slate-500">{position.symbol}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-mono">{position.currentPrice.toLocaleString()}원</p>
                                            <p className={cn(
                                                "text-xs font-mono",
                                                position.profitRate >= 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {position.profitRate >= 0 ? '+' : ''}{position.profitRate.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Position Details */}
                                    <div className="flex justify-between text-xs text-slate-400 mb-3">
                                        <span>평단 {position.avgPrice.toLocaleString()}원</span>
                                        <span>{position.quantity}주</span>
                                    </div>

                                    {/* Profit/Loss */}
                                    <div className={cn(
                                        "text-sm font-mono font-bold text-right mb-3",
                                        position.profitAmount >= 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {position.profitAmount >= 0 ? '+' : ''}{position.profitAmount.toLocaleString()}원
                                    </div>

                                    {/* Edit/Delete Buttons */}
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPositionModal({ isOpen: true, mode: 'edit', symbol: position.symbol, symbolName: position.symbolName });
                                            }}
                                            className="flex-1 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-800"
                                        >
                                            <Pencil className="w-3 h-3 mr-1" />
                                            수정
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`${position.symbolName} 종목을 삭제하시겠습니까?`)) {
                                                    removePosition(position.symbol);
                                                }
                                            }}
                                            className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800"
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            삭제
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Position Modal */}
            <PositionModal
                isOpen={positionModal.isOpen}
                onClose={() => setPositionModal({ isOpen: false, mode: 'add' })}
                mode={positionModal.mode}
                symbol={positionModal.symbol}
                symbolName={positionModal.symbolName}
            />
        </>
    );
}
