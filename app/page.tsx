"use client";
import { useState, useEffect } from "react";

import { WarRoomLayout } from "@/components/features/war-room/war-room-layout";
import { ChatCommand } from "@/components/features/war-room/chat-window";
import { DetailedStockCard } from "@/components/features/stock/detailed-stock-card";
import { AccountStatus } from "@/components/features/stock/account-status";
import { StockSearchModal } from "@/components/features/stock/stock-search-modal";
import { WatchlistSidebar } from "@/components/features/stock/watchlist-sidebar";
import { ScreenerModal } from "@/components/features/stock/screener-modal";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, MessageCircle, Power, Search, Filter } from "lucide-react";

export default function Home() {
    const [activeSymbol, setActiveSymbol] = useState<string>("005930"); // Default to Samsung Electronics
    const [activeName, setActiveName] = useState<string>("삼성전자");
    const [isTradeOpen, setIsTradeOpen] = useState(false);
    const [botRunning, setBotRunning] = useState(false);
    const [botLoading, setBotLoading] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isScreenerOpen, setIsScreenerOpen] = useState(false);

    // Watchlist Hook
    const {
        watchlist,
        activeGroup,
        setActiveGroup,
        isLoaded,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        getItemGroup,
        changeGroup,
    } = useWatchlist();

    // Global Key Listener for Cmd + .
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '.') {
                e.preventDefault();
                setIsTradeOpen(prev => !prev);
            }
            // Cmd + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 봇 서버 상태 체크
    useEffect(() => {
        const checkBotStatus = async () => {
            try {
                const res = await fetch('/api/bot');
                const data = await res.json();
                setBotRunning(data.running);
            } catch {
                setBotRunning(false);
            }
        };
        checkBotStatus();
        const interval = setInterval(checkBotStatus, 5000); // 5초마다 확인
        return () => clearInterval(interval);
    }, []);

    // 봇 서버 시작/종료
    const toggleBot = async () => {
        setBotLoading(true);
        try {
            const res = await fetch('/api/bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: botRunning ? 'stop' : 'start' }),
            });
            const data = await res.json();
            if (data.success) {
                setBotRunning(!botRunning);
            }
        } catch (error) {
            console.error('Bot toggle failed:', error);
        } finally {
            setBotLoading(false);
        }
    };

    const handleChatCommand = (cmd: ChatCommand) => {
        if (cmd.type === 'SHOW_CHART' && cmd.symbol) {
            setActiveSymbol(cmd.symbol);
            // Find name from watchlist or use symbol
            const found = watchlist.find(s => s.symbol === cmd.symbol);
            setActiveName(found?.name || cmd.symbol);
        }
        if (cmd.type === 'TOGGLE_TRADE') {
            setIsTradeOpen(prev => !prev);
        }
    };

    const handleSelectStock = (symbol: string, name: string) => {
        setActiveSymbol(symbol);
        setActiveName(name);
    };

    const handleWatchlistSelect = (symbol: string) => {
        const found = watchlist.find(s => s.symbol === symbol);
        setActiveSymbol(symbol);
        setActiveName(found?.name || symbol);
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <WarRoomLayout
                onChatCommand={handleChatCommand}
                currentSymbol={activeSymbol}
                currentName={activeName}
            >
                <div className="max-w-[1920px] mx-auto h-[calc(100vh-2rem)] flex flex-col">
                    {/* Header */}
                    <header className="mb-2 shrink-0 flex justify-between items-center px-4 py-2 bg-slate-900/50 rounded-lg mx-2 mt-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                                StockIQ
                            </h1>
                            <span className="text-slate-500 font-light text-xs border-l border-slate-700 pl-3">Kiwoom Pro Terminal</span>
                        </div>
                        <div className="flex gap-2">
                            {/* Stock Search Button */}
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700"
                            >
                                <Search size={12} className="text-blue-400" />
                                종목 검색
                                <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-slate-700 rounded">⌘K</kbd>
                            </button>

                            {/* Account Status Popup (0198) */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700">
                                        <Wallet size={12} className="text-emerald-400" />
                                        0198 계좌
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[700px] bg-slate-950 border-slate-800 text-slate-100">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Wallet size={16} className="text-emerald-500" />
                                            계좌현황 (0198)
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="h-[400px]">
                                        <AccountStatus />
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Bot Server Control */}
                            <button
                                onClick={toggleBot}
                                disabled={botLoading}
                                className={`flex items-center gap-1.5 px-3 py-1 text-white text-xs font-bold rounded transition-colors ${botRunning
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-green-600 hover:bg-green-700'
                                    } ${botLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Power size={12} className={botLoading ? 'animate-pulse' : ''} />
                                {botLoading ? '...' : botRunning ? '봇 종료' : '봇 시작'}
                            </button>

                            <span className={`px-1.5 py-0.5 text-[10px] rounded border flex items-center ${botRunning
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                {botRunning ? '🟢 Bot ON' : '🔴 Bot OFF'}
                            </span>

                            {/* Screener Button */}
                            <button
                                onClick={() => setIsScreenerOpen(true)}
                                className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                            >
                                <Filter size={12} />
                                스크리너
                            </button>

                            <button
                                onClick={() => window.open('https://t.me/stocktome_bot', '_blank')}
                                className="ml-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                            >
                                <MessageCircle size={12} />
                                자동매매 설정
                            </button>
                            <button
                                onClick={() => window.location.href = '/alpha-hr'}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors"
                            >
                                Alpha-HR →
                            </button>
                        </div>
                    </header>

                    {/* Main Workspace */}
                    <div className="flex flex-1 overflow-hidden px-2 pb-2 gap-2">
                        {/* Sidebar: Watch List */}
                        {isLoaded && (
                            <WatchlistSidebar
                                watchlist={watchlist}
                                activeSymbol={activeSymbol}
                                activeGroup={activeGroup}
                                onSelectStock={handleWatchlistSelect}
                                onRemoveFromWatchlist={removeFromWatchlist}
                                onOpenSearch={() => setIsSearchOpen(true)}
                                onChangeGroup={setActiveGroup}
                                onMoveToGroup={changeGroup}
                            />
                        )}

                        {/* Main Content: Single View */}
                        <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border">
                            <DetailedStockCard
                                symbol={activeSymbol}
                                name={activeName}
                                isMaximized={false}
                                isTradeOpen={isTradeOpen}
                                onToggleTrade={() => setIsTradeOpen(!isTradeOpen)}
                            />
                        </div>
                    </div>
                </div>
            </WarRoomLayout>

            {/* Stock Search Modal */}
            <StockSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={addToWatchlist}
                isInWatchlist={isInWatchlist}
            />

            {/* Screener Modal */}
            <ScreenerModal
                isOpen={isScreenerOpen}
                onClose={() => setIsScreenerOpen(false)}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={addToWatchlist}
                isInWatchlist={isInWatchlist}
                getItemGroup={getItemGroup}
            />
        </main >
    );
}
