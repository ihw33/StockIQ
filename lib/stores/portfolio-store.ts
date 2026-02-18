import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Broker = 'kiwoom' | 'toss' | 'manual';

export interface Position {
    symbol: string;
    symbolName: string;
    avgPrice: number;      // 평균단가
    quantity: number;      // 보유량
    currentPrice: number;  // 현재가 (실시간 업데이트)
    profitRate: number;    // 수익률 (%)
    profitAmount: number;  // 수익금액
    totalValue: number;    // 총 평가금액
    broker: Broker;        // 증권사 (kiwoom | toss | manual)
}

interface PortfolioState {
    positions: Position[];
    lastSyncedAt: string | null;

    // Actions
    addPosition: (pos: { symbol: string; symbolName: string; avgPrice: number; quantity: number; broker?: Broker }) => void;
    updatePosition: (symbol: string, updates: { avgPrice?: number; quantity?: number }) => void;
    removePosition: (symbol: string) => void;
    updateCurrentPrice: (symbol: string, price: number) => void;
    getPosition: (symbol: string) => Position | undefined;
    getTotalValue: () => number;
    getTotalProfit: () => number;
    clearAllPositions: () => void;
    syncFromKiwoom: () => Promise<boolean>;
}

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set, get) => ({
            positions: [],
            lastSyncedAt: null,

            addPosition: (pos) => {
                set((state) => {
                    const totalValue = pos.avgPrice * pos.quantity;
                    const newPosition: Position = {
                        symbol: pos.symbol,
                        symbolName: pos.symbolName,
                        avgPrice: pos.avgPrice,
                        quantity: pos.quantity,
                        currentPrice: pos.avgPrice,
                        profitRate: 0,
                        profitAmount: 0,
                        totalValue,
                        broker: pos.broker ?? 'manual',
                    };
                    const filtered = state.positions.filter((p) => p.symbol !== pos.symbol);
                    return { positions: [...filtered, newPosition] };
                });
            },

            updatePosition: (symbol, updates) => {
                set((state) => ({
                    positions: state.positions.map((pos) => {
                        if (pos.symbol !== symbol) return pos;
                        const avgPrice = updates.avgPrice ?? pos.avgPrice;
                        const quantity = updates.quantity ?? pos.quantity;
                        const profitAmount = (pos.currentPrice - avgPrice) * quantity;
                        const profitRate = avgPrice > 0 ? ((pos.currentPrice - avgPrice) / avgPrice) * 100 : 0;
                        const totalValue = pos.currentPrice * quantity;
                        return { ...pos, avgPrice, quantity, profitAmount, profitRate, totalValue };
                    }),
                }));
            },

            removePosition: (symbol) => {
                set((state) => ({
                    positions: state.positions.filter((p) => p.symbol !== symbol),
                }));
            },

            updateCurrentPrice: (symbol, price) => {
                set((state) => ({
                    positions: state.positions.map((pos) =>
                        pos.symbol === symbol
                            ? {
                                ...pos,
                                currentPrice: price,
                                profitRate: ((price - pos.avgPrice) / pos.avgPrice) * 100,
                                profitAmount: (price - pos.avgPrice) * pos.quantity,
                                totalValue: price * pos.quantity
                            }
                            : pos
                    )
                }));
            },

            getPosition: (symbol) => {
                return get().positions.find((p) => p.symbol === symbol);
            },

            getTotalValue: () => {
                return get().positions.reduce((sum, pos) => sum + pos.totalValue, 0);
            },

            getTotalProfit: () => {
                return get().positions.reduce((sum, pos) => sum + pos.profitAmount, 0);
            },

            clearAllPositions: () => {
                set({ positions: [] });
            },

            syncFromKiwoom: async () => {
                try {
                    const res = await fetch('/api/portfolio/holdings');
                    if (!res.ok) return false;
                    const data = await res.json();
                    const kiwoomPositions: Position[] = (data.holdings || []).map((h: any) => ({
                        symbol: h.symbol,
                        symbolName: h.symbolName,
                        avgPrice: h.avgPrice,
                        quantity: h.quantity,
                        currentPrice: h.currentPrice,
                        profitRate: h.profitRate,
                        profitAmount: h.profitAmount,
                        totalValue: h.totalValue,
                        broker: 'kiwoom' as Broker,
                    }));
                    // 키움이 아닌 종목(토스/수동)은 유지, 키움 종목만 교체
                    const nonKiwoom = get().positions.filter(p => p.broker !== 'kiwoom');
                    set({ positions: [...kiwoomPositions, ...nonKiwoom], lastSyncedAt: new Date().toISOString() });
                    return true;
                } catch {
                    return false;
                }
            }
        }),
        {
            name: 'portfolio-storage',
            version: 3,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>;
                // v2 → v3: broker 필드 추가 (기존 포지션은 kiwoom으로 간주)
                if (version < 3) {
                    const positions = ((state.positions as Position[]) || []).map(p => ({
                        ...p,
                        broker: (p.broker ?? 'kiwoom') as Broker,
                    }));
                    return { ...state, positions };
                }
                return state as unknown as PortfolioState;
            },
        }
    )
);
