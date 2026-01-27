'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WatchlistItem {
    symbol: string;
    name: string;
    addedAt: number;
    group: number; // 0, 1, 2 (3개 그룹)
}

export const WATCHLIST_GROUPS = [
    { id: 0, name: '관심 1', color: 'blue' },
    { id: 1, name: '관심 2', color: 'green' },
    { id: 2, name: '관심 3', color: 'purple' },
];

const WATCHLIST_STORAGE_KEY = 'stockiq-watchlist-v2';
const DEFAULT_WATCHLIST: WatchlistItem[] = [
    { symbol: '005930', name: '삼성전자', addedAt: Date.now(), group: 0 },
    { symbol: '000660', name: 'SK하이닉스', addedAt: Date.now(), group: 0 },
    { symbol: '035420', name: 'NAVER', addedAt: Date.now(), group: 0 },
    { symbol: '035720', name: '카카오', addedAt: Date.now(), group: 0 },
];

export function useWatchlist() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [activeGroup, setActiveGroup] = useState<number>(0);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // 기존 데이터에 group이 없으면 0으로 설정
                    const migrated = parsed.map((item: WatchlistItem) => ({
                        ...item,
                        group: item.group ?? 0,
                    }));
                    setWatchlist(migrated);
                } else {
                    setWatchlist(DEFAULT_WATCHLIST);
                }
            } else {
                // 이전 버전 데이터 마이그레이션
                const oldStored = localStorage.getItem('stockiq-watchlist');
                if (oldStored) {
                    const oldParsed = JSON.parse(oldStored);
                    if (Array.isArray(oldParsed)) {
                        const migrated = oldParsed.map((item: WatchlistItem) => ({
                            ...item,
                            group: 0,
                        }));
                        setWatchlist(migrated);
                    }
                } else {
                    setWatchlist(DEFAULT_WATCHLIST);
                }
            }
        } catch (e) {
            console.error('Failed to load watchlist:', e);
            setWatchlist(DEFAULT_WATCHLIST);
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage when watchlist changes
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
        }
    }, [watchlist, isLoaded]);

    // 특정 그룹의 종목만 반환
    const getGroupWatchlist = useCallback((group: number) => {
        return watchlist.filter(item => item.group === group);
    }, [watchlist]);

    // 현재 활성 그룹의 종목
    const activeGroupWatchlist = getGroupWatchlist(activeGroup);

    const addToWatchlist = useCallback((symbol: string, name: string, group: number = 0) => {
        console.log('[Watchlist] Adding:', symbol, name, 'to group', group);
        setWatchlist((prev) => {
            // Check if already exists in any group
            const existing = prev.find((item) => item.symbol === symbol);
            if (existing) {
                // 이미 있으면 그룹만 변경
                if (existing.group === group) {
                    console.log('[Watchlist] Already exists in same group:', symbol);
                    return prev;
                }
                console.log('[Watchlist] Moving to group', group);
                return prev.map((item) =>
                    item.symbol === symbol ? { ...item, group } : item
                );
            }
            console.log('[Watchlist] Added successfully:', symbol);
            return [...prev, { symbol, name, addedAt: Date.now(), group }];
        });
    }, []);

    const removeFromWatchlist = useCallback((symbol: string) => {
        setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
    }, []);

    const isInWatchlist = useCallback(
        (symbol: string) => {
            return watchlist.some((item) => item.symbol === symbol);
        },
        [watchlist]
    );

    const getItemGroup = useCallback(
        (symbol: string): number | null => {
            const item = watchlist.find((i) => i.symbol === symbol);
            return item ? item.group : null;
        },
        [watchlist]
    );

    const changeGroup = useCallback((symbol: string, newGroup: number) => {
        setWatchlist((prev) =>
            prev.map((item) =>
                item.symbol === symbol ? { ...item, group: newGroup } : item
            )
        );
    }, []);

    const reorderWatchlist = useCallback((fromIndex: number, toIndex: number) => {
        setWatchlist((prev) => {
            const result = [...prev];
            const [removed] = result.splice(fromIndex, 1);
            result.splice(toIndex, 0, removed);
            return result;
        });
    }, []);

    const clearWatchlist = useCallback(() => {
        setWatchlist([]);
    }, []);

    return {
        watchlist,
        activeGroupWatchlist,
        activeGroup,
        setActiveGroup,
        isLoaded,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        getItemGroup,
        changeGroup,
        getGroupWatchlist,
        reorderWatchlist,
        clearWatchlist,
        groups: WATCHLIST_GROUPS,
    };
}
