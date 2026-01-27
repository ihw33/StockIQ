'use client';

import { useState } from 'react';
import { Star, Trash2, Plus, ArrowRightLeft } from 'lucide-react';
import { WatchlistItem, WATCHLIST_GROUPS } from '@/lib/hooks/use-watchlist';

interface WatchlistSidebarProps {
    watchlist: WatchlistItem[];
    activeSymbol: string;
    activeGroup: number;
    onSelectStock: (symbol: string) => void;
    onRemoveFromWatchlist: (symbol: string) => void;
    onOpenSearch: () => void;
    onChangeGroup: (groupId: number) => void;
    onMoveToGroup?: (symbol: string, groupId: number) => void;
}

export function WatchlistSidebar({
    watchlist,
    activeSymbol,
    activeGroup,
    onSelectStock,
    onRemoveFromWatchlist,
    onOpenSearch,
    onChangeGroup,
    onMoveToGroup,
}: WatchlistSidebarProps) {
    // 현재 그룹의 종목만 필터링
    const groupWatchlist = watchlist.filter(item => item.group === activeGroup);
    const currentGroupInfo = WATCHLIST_GROUPS[activeGroup];

    return (
        <div className="w-56 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="text-gray-900 font-bold text-sm flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    관심종목
                </span>
                <button
                    onClick={onOpenSearch}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="종목 추가"
                >
                    <Plus className="w-3.5 h-3.5" />
                    추가
                </button>
            </div>

            {/* Group Tabs */}
            <div className="flex border-b bg-gray-50/50">
                {WATCHLIST_GROUPS.map((group) => {
                    const count = watchlist.filter(i => i.group === group.id).length;
                    const isActive = activeGroup === group.id;

                    return (
                        <button
                            key={group.id}
                            onClick={() => onChangeGroup(group.id)}
                            className={`flex-1 py-2 text-xs font-medium transition-all relative ${isActive
                                    ? `text-${group.color}-600 bg-white border-b-2 border-${group.color}-500`
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            style={isActive ? {
                                borderBottomColor: group.color === 'blue' ? '#3b82f6' : group.color === 'green' ? '#22c55e' : '#a855f7',
                                color: group.color === 'blue' ? '#2563eb' : group.color === 'green' ? '#16a34a' : '#9333ea',
                            } : {}}
                        >
                            {group.name}
                            {count > 0 && (
                                <span className="ml-1 text-[10px] text-gray-400">
                                    ({count})
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Stock List */}
            <div className="flex-1 overflow-y-auto">
                {groupWatchlist.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                        <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>{currentGroupInfo.name}이 비어있습니다</p>
                        <button
                            onClick={onOpenSearch}
                            className="mt-2 text-blue-500 hover:underline text-xs"
                        >
                            종목 추가하기
                        </button>
                    </div>
                ) : (
                    groupWatchlist.map((stock) => (
                        <WatchlistItemRow
                            key={stock.symbol}
                            stock={stock}
                            isActive={activeSymbol === stock.symbol}
                            currentGroup={activeGroup}
                            onSelect={() => onSelectStock(stock.symbol)}
                            onRemove={() => onRemoveFromWatchlist(stock.symbol)}
                            onMoveToGroup={onMoveToGroup}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {groupWatchlist.length > 0 && (
                <div className="p-2 border-t bg-gray-50/50">
                    <button
                        onClick={onOpenSearch}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        종목 검색
                    </button>
                </div>
            )}
        </div>
    );
}

// Individual Watchlist Item
function WatchlistItemRow({
    stock,
    isActive,
    currentGroup,
    onSelect,
    onRemove,
    onMoveToGroup,
}: {
    stock: WatchlistItem;
    isActive: boolean;
    currentGroup: number;
    onSelect: () => void;
    onRemove: () => void;
    onMoveToGroup?: (symbol: string, groupId: number) => void;
}) {
    const [showMoveMenu, setShowMoveMenu] = useState(false);
    const otherGroups = WATCHLIST_GROUPS.filter(g => g.id !== currentGroup);

    return (
        <div
            className={`relative group ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                }`}
        >
            <button
                onClick={onSelect}
                className="w-full text-left px-4 py-3 border-b flex justify-between items-center transition-colors"
            >
                <div className="flex flex-col">
                    <span
                        className={`text-sm font-bold ${isActive ? 'text-blue-700' : 'text-gray-800'
                            }`}
                    >
                        {stock.name}
                    </span>
                    <span className="text-[10px] text-gray-500">{stock.symbol}</span>
                </div>
            </button>

            {/* Action Buttons - Hover Visible */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {/* Move Group Button */}
                {onMoveToGroup && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMoveMenu(!showMoveMenu);
                        }}
                        className="p-1.5 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                        title="그룹 이동"
                    >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Delete Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="관심종목 삭제"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Move Group Dropdown */}
            {showMoveMenu && onMoveToGroup && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMoveMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                        <div className="px-3 py-1 text-[10px] text-gray-400 border-b">이동할 그룹</div>
                        {otherGroups.map((group) => (
                            <button
                                key={group.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveToGroup(stock.symbol, group.id);
                                    setShowMoveMenu(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2"
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                        backgroundColor: group.color === 'blue' ? '#3b82f6' : group.color === 'green' ? '#22c55e' : '#a855f7'
                                    }}
                                />
                                {group.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
