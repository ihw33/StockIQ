"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Brain } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { chatService, ChatMessage } from "@/lib/services/chat-service";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useReportStore } from "@/lib/store/report-store";
import { AnalysisReportModal } from "./analysis-report-modal";


export interface ChatCommand {
    type: 'SHOW_CHART' | 'SHOW_MOSAIC' | 'TOGGLE_TRADE';
    symbol?: string;
}

interface ChatWindowProps {
    onCommand?: (command: ChatCommand) => void;
    isOpen?: boolean;
    currentSymbol?: string;
    currentName?: string;
    pendingMessage?: string | null;
    onPendingConsumed?: () => void;
}

export function ChatWindow({ onCommand, isOpen = true, currentSymbol, currentName, pendingMessage, onPendingConsumed }: ChatWindowProps) {
    const positions = usePortfolioStore((state) => state.positions);
    const addReport = useReportStore((state) => state.addReport);


    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "안녕하세요! **AI 기술적 분석가**입니다.\n현재 선택된 종목의 **일봉/주봉/분봉 및 보조지표**를 종합 분석하여 트레이딩 전략을 제안해 드립니다.\n\n분석을 시작하려면 하단의 **'Analyze Strategy'** 버튼을 눌러주세요.",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<{ symbol: string; symbolName?: string; analysis: string; mode: 'algo' | 'llm' } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Handle pending message injection (from CompanyInfoCard AI button)
    useEffect(() => {
        if (!pendingMessage || isLoading) return;

        const runAnalysis = async () => {
            setIsLoading(true);
            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: pendingMessage,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMsg]);
            onPendingConsumed?.();

            try {
                const response = await chatService.analyzeCompany(currentSymbol!, pendingMessage);
                setMessages(prev => [...prev, response]);

                // Save to report store
                addReport({
                    symbol: currentSymbol!,
                    symbolName: currentName || currentSymbol!,
                    mode: 'llm',
                    analysis: response.content,
                    sessionId: `company_${currentSymbol}_${Date.now()}`,
                });
            } catch (error) {
                console.error(error);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: '기업분석 요청에 실패했습니다.',
                    timestamp: new Date()
                }]);
            } finally {
                setIsLoading(false);
            }
        };

        runAnalysis();
    }, [pendingMessage]);

    const handleAnalyze = async () => {
        if (!currentSymbol) return;
        setIsLoading(true);

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: `Analyze Strategy for ${currentName || currentSymbol} (${currentSymbol})`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            // Get position info for personalized analysis
            const position = positions.find(p => p.symbol === currentSymbol);
            const response = await chatService.analyzeChart(currentSymbol, 'algo', undefined, position);
            setMessages(prev => [...prev, response]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            // Small timeout to allow transition/render
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);


    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const content = inputValue.trim();
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsLoading(true);


        // Command Parsing Logic (Client-side simple regex for now)
        // Patterns: "Show NVDA", "NVDA Chart", "엔비디아 차트", "엔비디아", "NVDA"


        // 1. Detect Symbol
        const symbolMatch = content.match(/([A-Z]{2,5})/i); // Matches NVDA, TSLA
        const isChartRequest = /chart|차트|보여줘|show|분석|가격/i.test(content);

        // Trading Intents
        const isBuy = /매수|사줘|buy|롱/i.test(content);
        const isSell = /매도|팔아줘|sell|숏/i.test(content);

        // Simple mapping for demo (Hardcoded mapping for Korean names)
        let targetSymbol = symbolMatch ? symbolMatch[0].toUpperCase() : null;
        if (content.includes("엔비디아")) targetSymbol = "NVDA";
        if (content.includes("테슬라")) targetSymbol = "TSLA";
        if (content.includes("애플")) targetSymbol = "AAPL";
        if (content.includes("삼성")) targetSymbol = "005930"; // Samsung Electronics
        if (content.includes("하이닉스")) targetSymbol = "000660";
        if (content.includes("구글") || content.includes("알파벳")) targetSymbol = "GOOGL";
        if (content.includes("시스코")) targetSymbol = "CSCO";
        if (content.includes("마이크로소프트") || content.includes("마소")) targetSymbol = "MSFT";
        if (content.includes("아마존")) targetSymbol = "AMZN";
        if (content.includes("넷플릭스")) targetSymbol = "NFLX";


        // Logic: 
        // 1. Specific commands like "Mosaic", "전체" -> Show Mosaic
        // 2. Contains Symbol Name -> Show Chart (Implicitly "Show Chart" even if no verb)

        if ((content.includes("전체") || content.includes("모자이크")) && onCommand) {
            onCommand({ type: 'SHOW_MOSAIC' });
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `Switching to **Mosaic View**...`,
                    timestamp: new Date()
                }]);
                setIsLoading(false);
            }, 600);
            return;
        }

        // --- TRADING LOGIC ---
        if (targetSymbol && (isBuy || isSell)) {
            // Parse Quantity
            const qtyMatch = content.match(/(\d+)주/);
            const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1; // Default 1

            // Parse Price
            const priceMatch = content.match(/(\d+)원/);
            const price = priceMatch ? parseInt(priceMatch[1]) : 0; // 0 = Market Price
            const isMarket = content.includes("시장가");

            const finalPrice = isMarket ? 0 : price;
            const type = isBuy ? 'BUY' : 'SELL';

            // Confirm msg
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `⚡ **Executing Order**...\n${type} **${targetSymbol}** ${quantity} shares @ ${finalPrice === 0 ? 'Market Price' : finalPrice + ' KRW'}`,
                timestamp: new Date()
            }]);

            // Call API
            fetch('/api/stock/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: targetSymbol,
                    type: type,
                    price: finalPrice,
                    quantity: quantity
                })
            }).then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString() + '_res',
                        role: 'assistant',
                        content: `✅ **Order Sent!**\nWindows Bridge accepted the order. Check Execution Log.`,
                        timestamp: new Date()
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString() + '_err',
                        role: 'assistant',
                        content: `❌ **Order Failed**: ${data.error || 'Unknown Error'}`,
                        timestamp: new Date()
                    }]);
                }
            }).catch(err => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '_err',
                    role: 'assistant',
                    content: `❌ **Network Error**: ${err.message}`,
                    timestamp: new Date()
                }]);
            }).finally(() => setIsLoading(false));

            return;
        }

        if (targetSymbol && onCommand) {
            // Even if "Chart" is not explicitly said, we assume looking up a stock means showing it.
            // Unless "Mosaic" was also in sentence (handled above).

            onCommand({ type: 'SHOW_CHART', symbol: targetSymbol });
            // Simulate AI response
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `Checking the chart for **${targetSymbol}**...`,
                    timestamp: new Date()
                }]);
                setIsLoading(false);
            }, 600);
            return;
        }


        // Default: Call Chat Service (LLM) if symbol is selected
        if (currentSymbol) {
            try {
                // Extract position info for personalized analysis
                const position = positions.find(p => p.symbol === currentSymbol);
                console.log("LLM Chat Request - Symbol:", currentSymbol, "Query:", content, "Position:", position);

                // Pass user content as query and position info
                const response = await chatService.analyzeChart(currentSymbol, 'llm', content, position);
                setMessages(prev => [...prev, response]);
            } catch (error) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "⚠️ Failed to get AI response.",
                    timestamp: new Date()
                }]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Fallback for no symbol selected
        setTimeout(() => {
            const reply = "I didn't recognize any specific stock symbol in your command. Please select a stock first.";

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: reply,
                timestamp: new Date()
            }]);
            setIsLoading(false);
        }, 1000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return; // Fix for Korean IME
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };



    const handleDeepAnalyze = async () => {
        if (!currentSymbol) return;
        setIsLoading(true);

        try {
            const position = positions.find(p => p.symbol === currentSymbol);
            const posInfo = position ? {
                avgPrice: position.avgPrice,
                quantity: position.quantity,
                profitRate: position.profitRate
            } : undefined;

            // 백엔드에 백그라운드 심층분석 요청 (즉시 응답, 서버에서 비동기 실행)
            const res = await fetch('/api/ai/deep-analysis-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: currentSymbol, position_info: posInfo }),
            });

            if (!res.ok) throw new Error('Failed to start deep analysis');

            // 채팅에 시작 메시지 표시
            const startMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `🧠 **${currentName || currentSymbol}** 심층분석이 백그라운드에서 진행 중입니다.\n\n다른 페이지로 이동해도 분석은 계속됩니다. 완료되면 **보고서 탭**에 알림이 표시됩니다.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, startMsg]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '심층분석 시작에 실패했습니다. AI 엔진 연결을 확인하세요.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" />
                        AI Commander
                    </h2>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex gap-3 max-w-[90%]",
                                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    msg.role === 'user' ? "bg-blue-600" : "bg-emerald-600"
                                )}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>

                                <div className={cn(
                                    "p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap",
                                    msg.role === 'user'
                                        ? "bg-blue-600/20 text-blue-100 rounded-tr-none"
                                        : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                                )}>
                                    {/* Simple Markdown-like bold parsing for demo */}
                                    {msg.content.split('**').map((part, i) =>
                                        i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 animate-pulse">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="bg-slate-800 p-3 rounded-lg rounded-tl-none border border-slate-700">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex gap-2">
                        {/* Quick Actions */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={isLoading || !currentSymbol}
                            className="bg-emerald-900/20 border-emerald-800 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-all font-mono text-xs"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Analyze {currentSymbol}
                        </Button>

                        {/* Deep Analysis Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeepAnalyze}
                            disabled={isLoading || !currentSymbol}
                            className="bg-purple-900/20 border-purple-800 text-purple-400 hover:bg-purple-900/40 hover:text-purple-300 transition-all font-mono text-xs"
                        >
                            <Brain className="w-4 h-4 mr-2" />
                            심층 분석
                        </Button>

                        {/* Input Field */}
                        <div className="flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}

                                onKeyDown={handleKeyDown}
                                placeholder="Type a command (e.g., 'Show NVDA', '엔비디아 차트')..."
                                className="w-full bg-slate-800 border-none text-slate-200 placeholder:text-slate-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="relative">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="hover:bg-slate-800 text-slate-400 hover:text-emerald-400"
                                onClick={handleSendMessage}
                                disabled={isLoading || !inputValue.trim()}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Report Modal */}
            {reportData && (
                <AnalysisReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    symbol={reportData.symbol}
                    symbolName={reportData.symbolName}
                    analysis={reportData.analysis}
                    mode={reportData.mode}
                />
            )}

        </>
    );
}
