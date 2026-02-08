import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Position {
    symbol: string;
    symbolName: string;
    avgPrice: number;      // 평균단가
    quantity: number;      // 보유량
    currentPrice: number;  // 현재가 (실시간 업데이트)
    profitRate: number;    // 수익률 (%)
    profitAmount: number;  // 수익금액
    totalValue: number;    // 총 평가금액
}

interface PortfolioState {
    positions: Position[];

    // Actions
    addPosition: (pos: { symbol: string; symbolName: string; avgPrice: number; quantity: number }) => void;
    updatePosition: (symbol: string, updates: { avgPrice?: number; quantity?: number }) => void;
    removePosition: (symbol: string) => void;
    updateCurrentPrice: (symbol: string, price: number) => void;
    getPosition: (symbol: string) => Position | undefined;
    getTotalValue: () => number;
    getTotalProfit: () => number;
    clearAllPositions: () => void;
}

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set, get) => ({
            positions: [],

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
                    };
                    // 같은 symbol이 있으면 덮어쓰기
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
            }
        }),
        {
            name: 'portfolio-storage',
            version: 2,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>;
                if (version < 2) {
                    // 기존 trades 기반 데이터 → positions만 유지, trades 제거
                    return {
                        positions: (state.positions as Position[]) || [],
                    };
                }
                return state as unknown as PortfolioState;
            },
        }
    )
);
