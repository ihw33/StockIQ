"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/portfolio-store';

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

    const addPosition = usePortfolioStore((s) => s.addPosition);
    const updatePosition = usePortfolioStore((s) => s.updatePosition);
    const removePosition = usePortfolioStore((s) => s.removePosition);
    const getPosition = usePortfolioStore((s) => s.getPosition);

    useEffect(() => {
        if (!isOpen) return;
        if (mode === 'edit' && initialSymbol) {
            setSymbol(initialSymbol);
            setSymbolName(initialName || '');
            const pos = getPosition(initialSymbol);
            if (pos) {
                setAvgPrice(pos.avgPrice.toString());
                setQuantity(pos.quantity.toString());
            }
        } else {
            setSymbol(initialSymbol || '');
            setSymbolName(initialName || '');
            setAvgPrice('');
            setQuantity('');
        }
    }, [isOpen, mode, initialSymbol, initialName, getPosition]);

    const totalAmount = parseFloat(avgPrice || '0') * parseInt(quantity || '0');

    const handleSubmit = () => {
        const price = parseFloat(avgPrice);
        const qty = parseInt(quantity);

        if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
            alert('올바른 평균단가와 수량을 입력하세요');
            return;
        }

        if (mode === 'add') {
            if (!symbol.trim() || !symbolName.trim()) {
                alert('종목코드와 종목명을 입력하세요');
                return;
            }
            addPosition({ symbol: symbol.trim(), symbolName: symbolName.trim(), avgPrice: price, quantity: qty });
        } else {
            updatePosition(symbol, { avgPrice: price, quantity: qty });
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
                    <DialogTitle className="flex items-center gap-2">
                        {isAdd ? (
                            <>
                                <Plus className="w-5 h-5 text-blue-500" />
                                <span className="text-blue-400">종목 등록</span>
                                {initialSymbol && (
                                    <>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-white">{initialName || initialSymbol}</span>
                                        <span className="text-slate-500">({initialSymbol})</span>
                                    </>
                                )}
                            </>
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
                    {/* 종목코드 */}
                    <div className="space-y-2">
                        <Label htmlFor="symbol" className="text-slate-300">종목코드</Label>
                        {isAdd && !initialSymbol ? (
                            <Input
                                id="symbol"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white"
                                placeholder="예: 005930"
                            />
                        ) : (
                            <div className="bg-slate-900/50 rounded-md px-3 py-2 text-slate-400 text-sm">{symbol}</div>
                        )}
                    </div>

                    {/* 종목명 */}
                    <div className="space-y-2">
                        <Label htmlFor="symbolName" className="text-slate-300">종목명</Label>
                        {isAdd && !initialName ? (
                            <Input
                                id="symbolName"
                                value={symbolName}
                                onChange={(e) => setSymbolName(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white"
                                placeholder="예: 삼성전자"
                            />
                        ) : (
                            <div className="bg-slate-900/50 rounded-md px-3 py-2 text-slate-400 text-sm">{symbolName}</div>
                        )}
                    </div>

                    {/* 평균단가 */}
                    <div className="space-y-2">
                        <Label htmlFor="avgPrice" className="text-slate-300">평균단가</Label>
                        <div className="relative">
                            <Input
                                id="avgPrice"
                                type="number"
                                value={avgPrice}
                                onChange={(e) => setAvgPrice(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white pr-12"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">원</span>
                        </div>
                    </div>

                    {/* 수량 */}
                    <div className="space-y-2">
                        <Label htmlFor="quantity" className="text-slate-300">수량</Label>
                        <div className="relative">
                            <Input
                                id="quantity"
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="bg-slate-900 border-slate-700 text-white pr-12"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">주</span>
                        </div>
                    </div>

                    {/* 총 평가금액 */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">총 평가금액</span>
                            <span className="text-xl font-bold text-white font-mono">
                                {isNaN(totalAmount) ? 0 : totalAmount.toLocaleString()}원
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {isAdd ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                                취소
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                등록
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleDelete}
                                className="flex-1 border-red-800 text-red-400 hover:bg-red-900/30"
                            >
                                삭제
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                수정 완료
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
