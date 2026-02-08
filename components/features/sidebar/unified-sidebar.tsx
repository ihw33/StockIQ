'use client';

import React, { useState } from 'react';
import { usePortfolioStore } from '@/lib/stores/portfolio-store';
import { WatchlistItem, WATCHLIST_GROUPS } from '@/lib/hooks/use-watchlist';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PositionModal } from '@/components/features/portfolio/trade-modal';
import {
    ChevronLeft, ChevronRight, Wallet, Star, Plus,
    Pencil, Trash2, ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'portfolio' | 'watchlist';

interface UnifiedSidebarProps {
    currentSymbol: string;
    onSelectSymbol: (symbol: string, name: string) => void;
    watchlist: WatchlistItem[];
    activeGroup: number;
    onChangeGroup: (groupId: number) => void;
    onRemoveFromWatchlist: (symbol: string) => void;
    onOpenSearch: () => void;
    onMoveToGroup?: (symbol: string, groupId: number) => void;
}

export function UnifiedSidebar({
    currentSymbol,
    onSelectSymbol,
    watchlist,
    activeGroup,
    onChangeGroup,
    onRemoveFromWatchlist,
    onOpenSearch,
    onMoveToGroup,
}: UnifiedSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('portfolio');
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => { setMounted(true); }, []);

    const positions = usePortfolioStore((s) => s.positions);
    const removePosition = usePortfolioStore((s) => s.removePosition);
    const totalValue = usePortfolioStore((s) => s.getTotalValue());
    const totalProfit = usePortfolioStore((s) => s.getTotalProfit());
    const totalProfitRate = totalValue > 0 ? (totalProfit / (totalValue - totalProfit)) * 100 : 0;

    const [positionModal, setPositionModal] = useState<{
        isOpen: boolean; mode: 'add' | 'edit'; symbol?: string; symbolName?: string;
    }>({ isOpen: false, mode: 'add' });

    const groupWatchlist = watchlist.filter(item => item.group === activeGroup);

    if (!mounted) return <div className="w-12 h-full bg-slate-900" />;

    const handleIconClick = (tab: Tab) => {
        if (collapsed) {
            setCollapsed(false);
            setActiveTab(tab);
        } else if (activeTab === tab) {
            setCollapsed(true);
        } else {
            setActiveTab(tab);
        }
    };

    // Collapsed state
    if (collapsed) {
        return (
            <div className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-2 shrink-0">
                <button
                    onClick={() => handleIconClick('portfolio')}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="보유종목"
                >
                    <Wallet className="w-5 h-5" />
                </button>
                <button
                    onClick={() => handleIconClick('watchlist')}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="관심종목"
                >
                    <Star className="w-5 h-5" />
                </button>
                <div className="flex-1" />
                <button
                    onClick={() => setCollapsed(false)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // Expanded state
    return (
        <>
            <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-200">
                {/* Header with tabs */}
                <div className="p-2 border-b border-slate-800 flex items-center gap-1">
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-1 bg-slate-800/50 rounded-lg p-0.5">
                        <button
                            onClick={() => setActiveTab('portfolio')}
                            className={cn(
                                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1',
                                activeTab === 'portfolio'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            )}
                        >
                            <Wallet className="w-3.5 h-3.5" />
                            보유종목
                        </button>
                        <button
                            onClick={() => setActiveTab('watchlist')}
                            className={cn(
                                'flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1',
                                activeTab === 'watchlist'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            )}
                        >
                            <Star className="w-3.5 h-3.5" />
                            관심종목
                        </button>
                    </div>
                </div>

                {/* Tab content */}
                {activeTab === 'portfolio' ? (
                    <PortfolioTab
                        positions={positions}
                        totalValue={totalValue}
                        totalProfit={totalProfit}
                        totalProfitRate={totalProfitRate}
                        currentSymbol={currentSymbol}
                        onSelectSymbol={onSelectSymbol}
                        onAdd={() => setPositionModal({ isOpen: true, mode: 'add' })}
                        onEdit={(s, n) => setPositionModal({ isOpen: true, mode: 'edit', symbol: s, symbolName: n })}
                        onDelete={(symbol) => {
                            if (confirm('이 종목을 삭제하시겠습니까?')) {
                                removePosition(symbol);
                            }
                        }}
                        nameMap={Object.fromEntries(watchlist.map(w => [w.symbol, w.name]))}
                    />
                ) : (
                    <WatchlistTab
                        watchlist={groupWatchlist}
                        allWatchlist={watchlist}
                        activeGroup={activeGroup}
                        activeSymbol={currentSymbol}
                        onChangeGroup={onChangeGroup}
                        onSelectStock={(symbol) => {
                            const found = watchlist.find(s => s.symbol === symbol);
                            onSelectSymbol(symbol, found?.name || symbol);
                        }}
                        onRemove={onRemoveFromWatchlist}
                        onOpenSearch={onOpenSearch}
                        onMoveToGroup={onMoveToGroup}
                    />
                )}
            </div>

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

// Portfolio Tab
function PortfolioTab({
    positions, totalValue, totalProfit, totalProfitRate, currentSymbol, onSelectSymbol, onAdd, onEdit, onDelete, nameMap,
}: {
    positions: { symbol: string; symbolName: string; avgPrice: number; quantity: number; currentPrice: number; profitRate: number; profitAmount: number }[];
    totalValue: number; totalProfit: number; totalProfitRate: number;
    currentSymbol: string;
    onSelectSymbol: (s: string, n: string) => void;
    onAdd: () => void;
    onEdit: (symbol: string, symbolName: string) => void;
    onDelete: (symbol: string) => void;
    nameMap: Record<string, string>;
}) {
    const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

    // Resolve names for positions not in watchlist
    React.useEffect(() => {
        const missing = positions.filter(p => !nameMap[p.symbol] && p.symbolName === p.symbol);
        if (missing.length === 0) return;
        missing.forEach(async (p) => {
            try {
                const res = await fetch(`/api/company/${p.symbol}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.data?.stk_nm) {
                        setResolvedNames(prev => ({ ...prev, [p.symbol]: json.data.stk_nm }));
                    }
                }
            } catch { /* ignore */ }
        });
    }, [positions, nameMap]);

    const getName = (pos: { symbol: string; symbolName: string }) => {
        return nameMap[pos.symbol] || resolvedNames[pos.symbol] || (pos.symbolName !== pos.symbol ? pos.symbolName : pos.symbol);
    };
    return (
        <>
            {/* Summary */}
            <div className="p-3 border-b border-slate-800">
                <div className="bg-slate-800/50 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400">총 평가</span>
                        <span className="text-white font-mono font-bold">{totalValue.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400">총 손익</span>
                        <span className={cn('font-mono font-bold', totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원
                            <span className="text-[10px] ml-1">({totalProfitRate >= 0 ? '+' : ''}{totalProfitRate.toFixed(2)}%)</span>
                        </span>
                    </div>
                </div>
                <button
                    onClick={onAdd}
                    className="w-full mt-2 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors border border-blue-800/50"
                >
                    <Plus className="w-3.5 h-3.5" /> 종목 등록
                </button>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                {positions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-slate-500">
                        <Wallet className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-xs text-center mb-2">보유 종목이 없습니다</p>
                        <button
                            onClick={onAdd}
                            className="text-blue-400 hover:underline text-xs"
                        >
                            종목 등록
                        </button>
                    </div>
                ) : (
                    <div className="p-2 space-y-1.5">
                        {positions.map((pos) => (
                            <div
                                key={pos.symbol}
                                className={cn(
                                    'rounded-lg p-2.5 cursor-pointer transition-all border',
                                    currentSymbol === pos.symbol
                                        ? 'border-purple-600 bg-slate-800/80'
                                        : 'border-transparent hover:bg-slate-800/40'
                                )}
                                onClick={() => onSelectSymbol(pos.symbol, getName(pos))}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <h3 className="text-white font-semibold text-sm">{getName(pos)}</h3>
                                        <p className="text-[10px] text-slate-500">{pos.symbol}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-mono text-xs">{pos.currentPrice.toLocaleString()}</p>
                                        <p className={cn('text-[10px] font-mono', pos.profitRate >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                            {pos.profitRate >= 0 ? '+' : ''}{pos.profitRate.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                                    <span>평단 {pos.avgPrice.toLocaleString()}</span>
                                    <span>{pos.quantity}주</span>
                                </div>
                                <div className="flex gap-1.5">
                                    <Button
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); onEdit(pos.symbol, getName(pos)); }}
                                        className="flex-1 h-6 text-[10px] bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 border border-amber-800"
                                    >
                                        <Pencil className="w-3 h-3 mr-0.5" /> 수정
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); onDelete(pos.symbol); }}
                                        className="flex-1 h-6 text-[10px] bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800"
                                    >
                                        <Trash2 className="w-3 h-3 mr-0.5" /> 삭제
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </>
    );
}

// Watchlist Tab
function WatchlistTab({
    watchlist, allWatchlist, activeGroup, activeSymbol, onChangeGroup, onSelectStock, onRemove, onOpenSearch, onMoveToGroup,
}: {
    watchlist: WatchlistItem[];
    allWatchlist: WatchlistItem[];
    activeGroup: number;
    activeSymbol: string;
    onChangeGroup: (id: number) => void;
    onSelectStock: (symbol: string) => void;
    onRemove: (symbol: string) => void;
    onOpenSearch: () => void;
    onMoveToGroup?: (symbol: string, groupId: number) => void;
}) {
    return (
        <>
            {/* Group tabs */}
            <div className="flex border-b border-slate-800">
                {WATCHLIST_GROUPS.map((group) => {
                    const count = allWatchlist.filter(i => i.group === group.id).length;
                    const isActive = activeGroup === group.id;
                    const colors: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', purple: '#a855f7' };
                    return (
                        <button
                            key={group.id}
                            onClick={() => onChangeGroup(group.id)}
                            className={cn(
                                'flex-1 py-2 text-xs font-medium transition-all',
                                isActive ? 'text-white border-b-2' : 'text-slate-500 hover:text-slate-300'
                            )}
                            style={isActive ? { borderBottomColor: colors[group.color] } : {}}
                        >
                            {group.name}
                            {count > 0 && <span className="ml-1 text-[10px] text-slate-600">({count})</span>}
                        </button>
                    );
                })}
            </div>

            {/* Stock list */}
            <ScrollArea className="flex-1">
                {watchlist.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                        <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">비어있습니다</p>
                        <button onClick={onOpenSearch} className="mt-2 text-blue-400 hover:underline text-xs">
                            종목 추가
                        </button>
                    </div>
                ) : (
                    watchlist.map((stock) => (
                        <WatchlistRow
                            key={stock.symbol}
                            stock={stock}
                            isActive={activeSymbol === stock.symbol}
                            currentGroup={activeGroup}
                            onSelect={() => onSelectStock(stock.symbol)}
                            onRemove={() => onRemove(stock.symbol)}
                            onMoveToGroup={onMoveToGroup}
                        />
                    ))
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-2 border-t border-slate-800">
                <button
                    onClick={onOpenSearch}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> 종목 검색
                </button>
            </div>
        </>
    );
}

// Watchlist Row
function WatchlistRow({
    stock, isActive, currentGroup, onSelect, onRemove, onMoveToGroup,
}: {
    stock: WatchlistItem; isActive: boolean; currentGroup: number;
    onSelect: () => void; onRemove: () => void; onMoveToGroup?: (s: string, g: number) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const others = WATCHLIST_GROUPS.filter(g => g.id !== currentGroup);
    const colors: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', purple: '#a855f7' };

    return (
        <div className={cn('relative group', isActive ? 'bg-slate-800 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/50')}>
            <button onClick={onSelect} className="w-full text-left px-3 py-2.5 border-b border-slate-800/50 transition-colors">
                <span className={cn('text-sm font-medium', isActive ? 'text-white' : 'text-slate-300')}>{stock.name}</span>
                <span className="block text-[10px] text-slate-600">{stock.symbol}</span>
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {onMoveToGroup && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                    >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            {showMenu && onMoveToGroup && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                        <div className="px-3 py-1 text-[10px] text-slate-500 border-b border-slate-700">이동</div>
                        {others.map((g) => (
                            <button
                                key={g.id}
                                onClick={(e) => { e.stopPropagation(); onMoveToGroup(stock.symbol, g.id); setShowMenu(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[g.color] }} />
                                {g.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
