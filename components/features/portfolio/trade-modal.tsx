"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, RefreshCw, PlusCircle } from 'lucide-react';
import { usePortfolioStore, Broker } from '@/lib/stores/portfolio-store';

const BROKER_LABELS: Record<Broker, string> = {
    kiwoom: '키움',
    toss: '토스',
    manual: '직접입력',
};
const BROKER_COLORS: Record<Broker, string> = {
    kiwoom: 'border-red-500 text-red-400 bg-red-500/10',
    toss: 'border-blue-500 text-blue-400 bg-blue-500/10',
    manual: 'border-slate-500 text-slate-400 bg-slate-500/10',
};

interface PositionModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    symbol?: string;
    symbolName?: string;
}

export function PositionModal({
    isOpen,
    onClose,
    mode,
    symbol: initialSymbol,
    symbolName: initialName,
}: PositionModalProps) {
    const [symbol, setSymbol] = useState('');
    const [symbolName, setSymbolName] = useState('');
    const [avgPrice, setAvgPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [broker, setBroker] = useState<Broker>('toss');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [fetchingPrice, setFetchingPrice] = useState(false);
    const [lookingUpName, setLookingUpName] = useState(false);
    const [nameResults, setNameResults] = useState<{ symbol: string; name: string }[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const nameSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const addPosition = usePortfolioStore((s) => s.addPosition);
    const updatePosition = usePortfolioStore((s) => s.updatePosition);
    const updateCurrentPrice = usePortfolioStore((s) => s.updateCurrentPrice);
    const removePosition = usePortfolioStore((s) => s.removePosition);
    const getPosition = usePortfolioStore((s) => s.getPosition);

    // 현재가 자동 조회
    const fetchPrice = async (sym: string) => {
        if (!sym) return;
        setFetchingPrice(true);
        setCurrentPrice(null);
        try {
            const res = await fetch('/api/screener/v2/realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: [sym] }),
            });
            if (res.ok) {
                const data = await res.json();
                const result = data.results?.[0];
                if (result?.cur_price) {
                    setCurrentPrice(result.cur_price);
                    updateCurrentPrice(sym, result.cur_price);
                }
            }
        } catch { /* ignore */ }
        setFetchingPrice(false);
    };

    // 종목코드 → 종목명 자동 조회
    const lookupName = async (sym: string) => {
        if (sym.length !== 6 || !/^\d{6}$/.test(sym)) return;
        setLookingUpName(true);
        try {
            const res = await fetch(`/api/screener/search?q=${sym}`);
            if (res.ok) {
                const data = await res.json();
                const found = data.results?.[0];
                if (found?.symbol === sym && found?.name) {
                    setSymbolName(found.name);
                }
            }
        } catch { /* ignore */ }
        setLookingUpName(false);
    };

    // 종목명 입력 → 검색 드롭다운 (300ms 디바운스)
    const searchByName = (query: string) => {
        setSymbolName(query);
        if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current);
        if (query.length < 2) { setNameResults([]); setShowDropdown(false); return; }
        nameSearchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/screener/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setNameResults((data.results || []).slice(0, 6));
                    setShowDropdown(true);
                }
            } catch { /* ignore */ }
        }, 300);
    };

    const selectStock = (sym: string, name: string) => {
        setSymbol(sym);
        setSymbolName(name);
        setNameResults([]);
        setShowDropdown(false);
        fetchPrice(sym);
    };

    useEffect(() => {
        if (!isOpen) return;
        setNameResults([]);
        setShowDropdown(false);
        if (mode === 'edit' && initialSymbol) {
            setSymbol(initialSymbol);
            setSymbolName(initialName || '');
            const pos = getPosition(initialSymbol);
            if (pos) {
                setAvgPrice(pos.avgPrice.toString());
                setQuantity(pos.quantity.toString());
                setBroker(pos.broker ?? 'manual');
            }
            fetchPrice(initialSymbol);
        } else {
            setSymbol(initialSymbol || '');
            setSymbolName(initialName || '');
            setAvgPrice('');
            setQuantity('');
            setBroker('toss');
            setCurrentPrice(null);
            // 추가 모드에서 심볼이 미리 정해져 있으면 현재가 조회
            if (initialSymbol) fetchPrice(initialSymbol);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mode, initialSymbol, initialName]);

    // 추가 모드에서 이미 보유 중인 종목인지 확인
    const targetSymbol = symbol || initialSymbol || '';
    const existingPos = mode === 'add' ? getPosition(targetSymbol) : null;
    const isMergeMode = !!existingPos;

    // 입력값
    const addPrice = parseFloat(avgPrice || '0');
    const addQty = parseInt(quantity || '0');

    // 합산 계산 (추가매수 모드)
    const mergedQty = existingPos ? existingPos.quantity + (addQty || 0) : addQty;
    const mergedAvg = existingPos && addQty > 0 && addPrice > 0
        ? Math.round((existingPos.avgPrice * existingPos.quantity + addPrice * addQty) / mergedQty)
        : existingPos?.avgPrice ?? addPrice;

    // 수정 모드 계산
    const editAvg = parseFloat(avgPrice || '0');
    const editQty = parseInt(quantity || '0');
    const cur = currentPrice ?? (mode === 'edit' ? editAvg : (existingPos?.currentPrice ?? addPrice));
    const evalQty = mode === 'edit' ? editQty : (isMergeMode ? mergedQty : addQty);
    const evalAvg = mode === 'edit' ? editAvg : (isMergeMode ? mergedAvg : addPrice);
    const evalAmount = cur * evalQty;
    const profitAmount = (cur - evalAvg) * evalQty;
    const profitRate = evalAvg > 0 ? ((cur - evalAvg) / evalAvg) * 100 : 0;
    const isProfit = profitAmount >= 0;

    const handleSubmit = () => {
        const price = parseFloat(avgPrice);
        const q = parseInt(quantity);
        if (isNaN(price) || isNaN(q) || price <= 0 || q <= 0) {
            alert('올바른 단가와 수량을 입력하세요');
            return;
        }

        if (mode === 'add') {
            if (!targetSymbol) {
                alert('종목코드를 입력하세요');
                return;
            }
            if (!isMergeMode && !symbolName.trim()) {
                alert('종목명을 입력하세요');
                return;
            }
            if (isMergeMode && existingPos) {
                // 추가매수: 가중평균 합산
                updatePosition(existingPos.symbol, {
                    avgPrice: mergedAvg,
                    quantity: mergedQty,
                });
            } else {
                // 신규 등록
                addPosition({
                    symbol: targetSymbol.trim(),
                    symbolName: symbolName.trim(),
                    avgPrice: price,
                    quantity: q,
                    broker,
                });
            }
            if (currentPrice) updateCurrentPrice(targetSymbol.trim(), currentPrice);
        } else {
            updatePosition(symbol, { avgPrice: price, quantity: q });
            if (currentPrice) updateCurrentPrice(symbol, currentPrice);
        }
        onClose();
    };

    const handleDelete = () => {
        if (confirm(`${symbolName || symbol} 종목을 삭제하시겠습니까?`)) {
            removePosition(symbol);
            onClose();
        }
    };

    const isAdd = mode === 'add';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                        {isAdd ? (
                            isMergeMode ? (
                                <>
                                    <PlusCircle className="w-5 h-5 text-amber-500" />
                                    <span className="text-amber-400">추가매수</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-white">{symbolName || initialName || targetSymbol}</span>
                                    <span className="text-slate-500 text-xs">({targetSymbol})</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5 text-blue-500" />
                                    <span className="text-blue-400">보유 종목 수동 등록</span>
                                    {initialSymbol && (
                                        <>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-white">{initialName || initialSymbol}</span>
                                        </>
                                    )}
                                </>
                            )
                        ) : (
                            <>
                                <Pencil className="w-5 h-5 text-amber-500" />
                                <span className="text-amber-400">종목 수정</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-white">{symbolName}</span>
                                <span className="text-slate-500">({symbol})</span>
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">

                    {/* 추가매수 모드: 기존 보유 현황 표시 */}
                    {isMergeMode && existingPos && (
                        <div className="bg-slate-800/60 rounded-lg p-3 border border-amber-700/30">
                            <p className="text-[10px] text-amber-400 mb-2 font-medium">현재 보유</p>
                            <div className="flex justify-between text-xs text-slate-300">
                                <span>평단 {existingPos.avgPrice.toLocaleString()}원</span>
                                <span>{existingPos.quantity}주</span>
                                <span className="text-slate-400">{(existingPos.avgPrice * existingPos.quantity).toLocaleString()}원</span>
                            </div>
                        </div>
                    )}

                    {/* 증권사 선택 (신규 등록 모드만) */}
                    {isAdd && !isMergeMode && (
                        <div className="space-y-2">
                            <Label className="text-slate-300">증권사</Label>
                            <div className="flex gap-2">
                                {(['toss', 'kiwoom', 'manual'] as Broker[]).map(b => (
                                    <button
                                        key={b}
                                        onClick={() => setBroker(b)}
                                        className={`flex-1 py-1.5 rounded border text-xs font-medium transition-colors ${broker === b ? BROKER_COLORS[b] : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
                                    >
                                        {BROKER_LABELS[b]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 종목코드/종목명 (신규 등록 모드만) */}
                    {isAdd && !isMergeMode && (
                        <>
                            <div className="space-y-2">
                                <Label className="text-slate-300">종목코드</Label>
                                {!initialSymbol ? (
                                    <Input
                                        value={symbol}
                                        onChange={(e) => {
                                            setSymbol(e.target.value);
                                            lookupName(e.target.value);
                                        }}
                                        className="bg-slate-900 border-slate-700 text-white"
                                        placeholder="예: 000660"
                                        maxLength={6}
                                    />
                                ) : (
                                    <div className="bg-slate-900/50 rounded-md px-3 py-2 text-slate-400 text-sm">{symbol}</div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">
                                    종목명 {lookingUpName && <span className="text-[10px] text-blue-400 font-normal">조회중...</span>}
                                </Label>
                                {!initialName ? (
                                    <div className="relative">
                                        <Input
                                            value={symbolName}
                                            onChange={(e) => searchByName(e.target.value)}
                                            onFocus={() => nameResults.length > 0 && setShowDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                            className="bg-slate-900 border-slate-700 text-white"
                                            placeholder={lookingUpName ? '자동 조회중...' : '이름 또는 코드로 검색'}
                                            autoComplete="off"
                                        />
                                        {showDropdown && nameResults.length > 0 && (
                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                                {nameResults.map((r) => (
                                                    <button
                                                        key={r.symbol}
                                                        type="button"
                                                        onMouseDown={() => selectStock(r.symbol, r.name)}
                                                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-700 transition-colors text-left"
                                                    >
                                                        <span className="text-white">{r.name}</span>
                                                        <span className="text-slate-500 text-xs font-mono">{r.symbol}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/50 rounded-md px-3 py-2 text-slate-400 text-sm">{symbolName}</div>
                                )}
                            </div>
                        </>
                    )}

                    {/* 평균단가 */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">
                            {isMergeMode ? '추가 매수가' : (mode === 'edit' ? '평균단가' : '평균단가')}
                        </Label>
                        <div className="relative">
                            <Input type="number" value={avgPrice}
                                onChange={(e) => setAvgPrice(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white pr-12"
                                placeholder={isMergeMode ? '이번에 산 가격' : '0'} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">원</span>
                        </div>
                    </div>

                    {/* 수량 */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">
                            {isMergeMode ? '추가 수량' : '수량'}
                        </Label>
                        <div className="relative">
                            <Input type="number" value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white pr-12"
                                placeholder={isMergeMode ? '추가로 산 수량' : '0'} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">주</span>
                        </div>
                    </div>

                    {/* 추가매수 결과 미리보기 */}
                    {isMergeMode && addPrice > 0 && addQty > 0 && (
                        <div className="bg-amber-500/5 border border-amber-700/40 rounded-lg p-3 space-y-1.5">
                            <p className="text-[10px] text-amber-400 font-medium mb-2">합산 후 결과</p>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">새 평단</span>
                                <span className="text-white font-mono font-semibold">{mergedAvg.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">총 수량</span>
                                <span className="text-white font-mono">{mergedQty}주</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">총 매수금액</span>
                                <span className="text-white font-mono">{(mergedAvg * mergedQty).toLocaleString()}원</span>
                            </div>
                        </div>
                    )}

                    {/* 현재가 + 평가 요약 */}
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">현재가</span>
                                <button
                                    type="button"
                                    onClick={() => fetchPrice(targetSymbol || symbol)}
                                    disabled={fetchingPrice}
                                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-2.5 h-2.5 ${fetchingPrice ? 'animate-spin' : ''}`} />
                                    {fetchingPrice ? '조회중...' : '갱신'}
                                </button>
                            </div>
                            <span className={`font-mono text-sm font-semibold ${fetchingPrice ? 'text-slate-500' : currentPrice ? 'text-white' : 'text-slate-500'}`}>
                                {fetchingPrice ? '조회중...' : currentPrice ? currentPrice.toLocaleString() + '원' : '—'}
                            </span>
                        </div>

                        <div className="border-t border-slate-800 pt-2 space-y-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">총 평가금액</span>
                                <span className="text-xl font-bold text-white font-mono">
                                    {evalAmount > 0 ? evalAmount.toLocaleString() + '원' : '—'}
                                </span>
                            </div>
                            {currentPrice && evalAvg > 0 && evalQty > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">평가손익</span>
                                    <div className="text-right">
                                        <span className={`font-mono font-semibold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isProfit ? '+' : ''}{profitAmount.toLocaleString()}원
                                        </span>
                                        <span className={`ml-1.5 text-xs ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                                            ({isProfit ? '+' : ''}{profitRate.toFixed(2)}%)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {isAdd ? (
                        <>
                            <Button variant="outline" onClick={onClose}
                                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                                취소
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className={`flex-1 text-white ${isMergeMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isMergeMode ? '추가매수 합산' : '등록'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleDelete}
                                className="flex-1 border-red-800 text-red-400 hover:bg-red-900/30">
                                삭제
                            </Button>
                            <Button onClick={handleSubmit} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                                수정 완료
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
