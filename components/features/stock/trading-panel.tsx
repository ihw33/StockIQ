'use client';

import { useState, useEffect } from 'react';
import { StockOrderBook as IStockOrderBook } from '@/lib/providers/stock-provider';

function formatNumber(num: number) {
    return new Intl.NumberFormat('ko-KR').format(num);
}

interface TradingPanelProps {
    symbol: string;
    price: number; // Current market price or selected price
    onSubmitOrder?: (type: 'BUY' | 'SELL' | 'CORRECT' | 'CANCEL', price: number, quantity: number, orderId?: string) => void;
}

interface UnexecutedOrder {
    id: string;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    time: string;
    symbol: string;
}

export function TradingPanel({ symbol, price, onSubmitOrder }: TradingPanelProps) {
    const [tab, setTab] = useState<'BUY' | 'SELL' | 'CORRECT'>('BUY');
    const [orderPrice, setOrderPrice] = useState<string>(Math.floor(price).toString());

    const [quantity, setQuantity] = useState<string>("1");
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isMarketPrice, setIsMarketPrice] = useState(false);

    // Real Data States
    const [availableAmount, setAvailableAmount] = useState<number>(0);
    const [ownedQuantity, setOwnedQuantity] = useState<number>(0);
    const [unexecutedOrders, setUnexecutedOrders] = useState<UnexecutedOrder[]>([]); // Currently empty as we don't have API yet

    // Fetch Account Balance & Holdings
    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const res = await fetch('/api/stock/account');
                if (res.ok) {
                    const data = await res.json();

                    // 1. Balance
                    if (data && typeof data.deposit === 'number') {
                        setAvailableAmount(data.deposit);
                    }

                    // 2. Holdings (Find current symbol)
                    // API returns 'positions', not 'stocks'
                    const positions = data.positions || data.stocks || [];
                    if (Array.isArray(positions)) {
                        // Kiwoom often returns code like 'A005930' or just '005930'. 
                        // Our symbol is '005930'. We should check both or loose match.
                        const holding = positions.find((s: any) =>
                            s.symbol === symbol || s.code === symbol || s.code === `A${symbol}` || s.symbol === `A${symbol}`
                        );
                        if (holding) {
                            setOwnedQuantity(holding.quantity || 0);
                        } else {
                            setOwnedQuantity(0);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch account balance", e);
            }
        };
        fetchAccount();
        // Refresh every 5s for real-time feel
        const timer = setInterval(fetchAccount, 5000);
        return () => clearInterval(timer);
    }, [symbol]);



    // Update local price if prop changes (e.g. from order book click)
    useEffect(() => {
        if (price && tab !== 'CORRECT') {
            setOrderPrice(Math.floor(price).toString());
            setIsMarketPrice(false);
        }
    }, [price, tab]);


    // Clear selection on tab change
    useEffect(() => {
        if (tab !== 'CORRECT') {
            setSelectedOrderId(null);
            setQuantity("1");
        }
    }, [tab]);

    // Handle Order Selection for Correction
    const handleOrderSelect = (order: UnexecutedOrder) => {
        setSelectedOrderId(order.id);
        setOrderPrice(order.price.toString());
        setQuantity(order.quantity.toString());
    };


    const handlePercentageClick = (percent: number) => {
        // Correction Mode: Base on selected order quantity
        if (tab === 'CORRECT' && selectedOrderId) {
            const order = unexecutedOrders.find(o => o.id === selectedOrderId);
            if (order) {
                setQuantity(Math.floor(order.quantity * (percent / 100)).toString());
                return;
            }
        }

        const currentPrice = Number(orderPrice) || price || 1;

        if (tab === 'BUY') {
            // Buy Mode: Base on Available Cash
            const maxQty = Math.floor(availableAmount / currentPrice);
            setQuantity(Math.max(1, Math.floor(maxQty * (percent / 100))).toString());
        } else if (tab === 'SELL') {
            // Sell Mode: Base on Owned Quantity
            setQuantity(Math.max(1, Math.floor(ownedQuantity * (percent / 100))).toString());
        }
    };


    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
            if (isInput) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                onSubmitOrder?.(tab, Number(orderPrice), Number(quantity));
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setTab(prev => prev === 'BUY' ? 'CORRECT' : prev === 'SELL' ? 'BUY' : 'SELL');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setTab(prev => prev === 'BUY' ? 'SELL' : prev === 'SELL' ? 'CORRECT' : 'BUY');
            } else if (['1', 'q'].includes(e.key)) {
                handlePercentageClick(10);
            } else if (['2', 'w'].includes(e.key)) {
                handlePercentageClick(30);
            } else if (['3', 'e'].includes(e.key)) {
                handlePercentageClick(50);
            } else if (['4', 'r'].includes(e.key)) {
                handlePercentageClick(100);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tab, orderPrice, quantity, onSubmitOrder, selectedOrderId, availableAmount, ownedQuantity]);

    const isBuy = tab === 'BUY';
    const isSell = tab === 'SELL';
    const isCorrect = tab === 'CORRECT';

    const themeColor = isBuy ? 'red' : isSell ? 'blue' : 'gray';
    const btnColorClass = isBuy ? 'bg-red-500 hover:bg-red-600' : isSell ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600';

    return (
        <div className="flex flex-col h-full bg-white text-sm">
            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setTab('BUY')}
                    className={`flex-1 py-2 font-bold ${isBuy ? 'text-red-600 border-b-2 border-red-500 bg-red-50' : 'text-gray-500 bg-gray-50'}`}
                >
                    매수
                </button>
                <button
                    onClick={() => setTab('SELL')}
                    className={`flex-1 py-2 font-bold ${isSell ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50' : 'text-gray-500 bg-gray-50'}`}
                >
                    매도
                </button>
                <button
                    onClick={() => setTab('CORRECT')}
                    className={`flex-1 py-2 font-bold ${isCorrect ? 'text-gray-700 border-b-2 border-gray-500' : 'text-gray-500 bg-gray-50'}`}
                >
                    정정/취소
                </button>
            </div>

            {/* Form & List */}
            <div className="p-4 pr-14 flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-hide">
                {/* Unexecuted Orders List (Only in CORRECT tab) */}
                {isCorrect && (
                    <div className="mb-0 border rounded overflow-hidden flex flex-col h-[120px] shrink-0 bg-gray-50">

                        <div className="bg-gray-200 p-2 text-[10px] font-bold flex text-gray-600">
                            <span className="w-8">구분</span>
                            <span className="w-16 text-right">가격</span>
                            <span className="w-12 text-right">수량</span>
                            <span className="flex-1 text-right">시간</span>

                        </div>
                        <div className="overflow-y-auto flex-1 bg-white">
                            {unexecutedOrders.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center justify-center h-full">
                                    <span>미체결 내역 없음</span>
                                    {/* <span className="text-[10px] text-gray-300">(API 연동 예정)</span> */}
                                </div>
                            ) : (
                                unexecutedOrders.map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => handleOrderSelect(order)}
                                        className={`flex p-2 text-xs border-b cursor-pointer hover:bg-gray-100 items-center ${selectedOrderId === order.id ? 'bg-yellow-50 font-bold border-l-2 border-l-yellow-400' : 'text-gray-600'}`}
                                    >
                                        <span className={`w-8 ${order.type === 'BUY' ? 'text-red-500' : 'text-blue-500'}`}>
                                            {order.type === 'BUY' ? '매수' : '매도'}
                                        </span>
                                        <span className="w-16 text-right text-gray-900">{formatNumber(order.price)}</span>
                                        <span className="w-12 text-right text-gray-900">{order.quantity}</span>
                                        <span className="flex-1 text-right text-gray-400 text-[10px]">{order.time}</span>
                                    </div>

                                ))
                            )}
                        </div>
                    </div>
                )}

                {isCorrect && !selectedOrderId && unexecutedOrders.length > 0 && (
                    <div className="text-center py-4 text-xs text-gray-400 border border-dashed rounded bg-gray-50">
                        👆 위 목록에서 정정/취소할 주문을 선택하세요
                    </div>
                )}


                {/* Price Input */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-500">{isCorrect ? '변경할 가격' : '주문단가'}</label>
                        {!isCorrect && (

                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isMarketPrice}
                                    onChange={(e) => setIsMarketPrice(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`text-xs ${isMarketPrice ? 'font-bold text-gray-800' : 'text-gray-500'}`}>시장가</span>
                            </label>
                        )}
                    </div>
                    <div className={`flex items-center gap-1 ${isMarketPrice ? 'opacity-50 pointer-events-none' : ''}`}>

                        <input
                            type="number"
                            step="100"
                            className={`flex-1 h-9 border rounded-l px-2 text-right font-bold text-lg text-gray-900 focus:outline-none focus:border-${themeColor}-500 ${isCorrect && !selectedOrderId ? 'bg-gray-100 text-gray-400' : ''}`}
                            value={orderPrice}

                            onChange={(e) => setOrderPrice(e.target.value)}
                            disabled={isCorrect && !selectedOrderId}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onSubmitOrder?.(tab, Number(orderPrice), Number(quantity), selectedOrderId || undefined);
                                }
                            }}
                        />

                        {/* Grouped Plus/Minus Buttons on the Right */}
                        <div className="flex flex-col h-9 border-y border-r rounded-r overflow-hidden bg-gray-50">
                            <button
                                onClick={() => setOrderPrice(p => (Number(p) + 100).toString())}
                                className="w-8 h-[18px] flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 text-xs text-gray-600 border-b"
                                tabIndex={-1}
                                disabled={isCorrect && !selectedOrderId}
                            >▲</button>
                            <button
                                onClick={() => setOrderPrice(p => (Number(p) - 100).toString())}
                                className="w-8 h-[18px] flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 text-xs text-gray-600"
                                tabIndex={-1}
                                disabled={isCorrect && !selectedOrderId}
                            >▼</button>
                        </div>

                    </div>


                </div>

                {/* Quantity Input */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-500">{isCorrect ? '변경할 수량' : '주문수량'}</label>
                    <div className="flex items-center gap-1">

                        <input
                            type="number"
                            className={`flex-1 h-9 border rounded px-2 text-right font-bold text-lg text-gray-900 ${isCorrect && !selectedOrderId ? 'bg-gray-100 text-gray-400' : ''}`}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            disabled={isCorrect && !selectedOrderId}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onSubmitOrder?.(tab, Number(orderPrice), Number(quantity), selectedOrderId || undefined);
                                }
                            }}
                        />
                        <span className="text-gray-600 text-xs w-4">주</span>
                    </div>
                    {/* Percent Buttons */}
                    {!isCorrect && <div className="flex gap-1 mt-1">
                        {[10, 30, 50, 100].map(pct => (
                            <button
                                key={pct}
                                onClick={() => handlePercentageClick(pct)}
                                className="flex-1 py-1 text-[10px] border rounded bg-gray-50 hover:bg-gray-100 text-gray-600"
                                tabIndex={-1}
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>}
                </div>

                {/* Account Summary */}
                {!isCorrect && (
                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-500 flex justify-between">
                        <span>{isBuy ? '주문가능' : '보유수량'}</span>
                        <span className="font-bold text-gray-700">
                            {isBuy
                                ? `${formatNumber(availableAmount)} 원`
                                : `${formatNumber(ownedQuantity)} 주`
                            }
                        </span>
                    </div>
                )}

                <div className="flex-1"></div>

                {/* Submit Buttons */}
                {isCorrect ? (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onSubmitOrder && selectedOrderId && onSubmitOrder('CORRECT', Number(orderPrice), Number(quantity), selectedOrderId)}
                            className="flex-1 py-3 rounded-lg text-white font-bold text-lg shadow-md bg-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!selectedOrderId}
                        >
                            정정
                        </button>
                        <button
                            onClick={() => onSubmitOrder && selectedOrderId && onSubmitOrder('CANCEL', Number(orderPrice), Number(quantity), selectedOrderId)}
                            className="flex-1 py-3 rounded-lg text-gray-700 font-bold text-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                            disabled={!selectedOrderId}
                        >

                            취소

                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => onSubmitOrder && onSubmitOrder(tab, isMarketPrice ? 0 : Number(orderPrice), Number(quantity))}
                        className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-md transition-transform active:scale-95 ${btnColorClass}`}
                    >
                        {isMarketPrice ? (isBuy ? '시장가 매수' : '시장가 매도') : (isBuy ? '현금매수' : '현금매도')}
                    </button>
                )}

            </div>
        </div>
    );
}
