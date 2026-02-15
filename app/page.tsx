"use client";
import { useState, useEffect, useRef } from "react";

import { DetailedStockCard } from "@/components/features/stock/detailed-stock-card";
import { MacroSummaryBar } from "@/components/features/macro/macro-summary-bar";
import { UnifiedSidebar } from "@/components/features/sidebar/unified-sidebar";
import { RightPanel, RightPanelHandle } from "@/components/features/war-room/right-panel";
import { AccountStatus } from "@/components/features/stock/account-status";
import { StockSearchModal } from "@/components/features/stock/stock-search-modal";
import { ScreenerModal } from "@/components/features/stock/screener-modal";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, MessageCircle, Power, Search, Filter } from "lucide-react";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";

export default function Home() {
    const [activeSymbol, setActiveSymbol] = useState<string>("005930");
    const [activeName, setActiveName] = useState<string>("삼성전자");
    const [botRunning, setBotRunning] = useState(false);
    const [botLoading, setBotLoading] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isScreenerOpen, setIsScreenerOpen] = useState(false);

    const rightPanelRef = useRef<RightPanelHandle>(null);
    const updateCurrentPrice = usePortfolioStore((state) => state.updateCurrentPrice);

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

    // URL 쿼리 파라미터에서 종목 읽기
    useEffect(() => {
        const checkURL = () => {
            const params = new URLSearchParams(window.location.search);
            const stock = params.get('stock');

            if (stock && stock !== activeSymbol) {
                console.log('Setting stock from URL:', stock);
                setActiveSymbol(stock);
                fetchStockName(stock);
            }
        };

        // 초기 로드
        checkURL();

        // URL 변경 감지 (interval로 지속 체크)
        const interval = setInterval(checkURL, 500);

        // popstate 이벤트도 감지
        window.addEventListener('popstate', checkURL);

        return () => {
            clearInterval(interval);
            window.removeEventListener('popstate', checkURL);
        };
    }, [activeSymbol]);

    const fetchStockName = async (code: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/stocks/${code}`);
            const data = await res.json();
            if (data.name) {
                setActiveName(data.name);
            }
        } catch (error) {
            console.error('Failed to fetch stock name:', error);
        }
    };

    // Cmd+K for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Bot status check
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
        const interval = setInterval(checkBotStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleBot = async () => {
        setBotLoading(true);
        try {
            const res = await fetch('/api/bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: botRunning ? 'stop' : 'start' }),
            });
            const data = await res.json();
            if (data.success) setBotRunning(!botRunning);
        } catch (error) {
            console.error('Bot toggle failed:', error);
        } finally {
            setBotLoading(false);
        }
    };

    const handleSelectStock = (symbol: string, name: string) => {
        console.log('handleSelectStock called:', symbol, name);
        setActiveSymbol(symbol);
        setActiveName(name);
    };

    // activeSymbol 변경 감지
    useEffect(() => {
        console.log('activeSymbol changed to:', activeSymbol);
    }, [activeSymbol]);

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="h-screen flex flex-col">
                {/* Header */}
                <header className="shrink-0 flex justify-between items-center px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                            StockIQ
                        </h1>
                        <span className="text-slate-500 font-light text-xs border-l border-slate-700 pl-3">Kiwoom Pro Terminal</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700"
                        >
                            <Search size={12} className="text-blue-400" />
                            종목 검색
                            <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-slate-700 rounded">⌘K</kbd>
                        </button>

                        <button
                            onClick={() => window.location.href = '/reports'}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700"
                        >
                            보고서
                        </button>

                        <button
                            onClick={() => window.location.href = '/macro'}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-700"
                        >
                            매크로
                        </button>

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
                            {botRunning ? 'Bot ON' : 'Bot OFF'}
                        </span>

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
                            Alpha-HR
                        </button>
                    </div>
                </header>

                {/* 3-Column Layout */}
                <div className="flex flex-1 min-h-0">
                    {/* Left: Unified Sidebar */}
                    {isLoaded && (
                        <UnifiedSidebar
                            currentSymbol={activeSymbol}
                            onSelectSymbol={handleSelectStock}
                            watchlist={watchlist}
                            activeGroup={activeGroup}
                            onChangeGroup={setActiveGroup}
                            onRemoveFromWatchlist={removeFromWatchlist}
                            onOpenSearch={() => setIsSearchOpen(true)}
                            onMoveToGroup={changeGroup}
                        />
                    )}

                    {/* Center: Macro + Chart */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        <MacroSummaryBar />
                        <div className="flex-1 min-h-0">
                            <DetailedStockCard
                                symbol={activeSymbol}
                                name={activeName}
                            />
                        </div>
                    </div>

                    {/* Right: AI Analysis + Reports */}
                    <RightPanel
                        ref={rightPanelRef}
                        currentSymbol={activeSymbol}
                        currentName={activeName}
                    />
                </div>
            </div>

            {/* Modals */}
            <StockSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={addToWatchlist}
                isInWatchlist={isInWatchlist}
            />
            <ScreenerModal
                isOpen={isScreenerOpen}
                onClose={() => setIsScreenerOpen(false)}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={addToWatchlist}
                isInWatchlist={isInWatchlist}
                getItemGroup={getItemGroup}
            />
        </main>
    );
}
