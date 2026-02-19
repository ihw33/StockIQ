"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Printer, Brain } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AnalysisReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
    symbolName?: string;
    analysis: string;
    mode: 'algo' | 'llm';
}

export function AnalysisReportModal({
    isOpen,
    onClose,
    symbol,
    symbolName,
    analysis,
    mode
}: AnalysisReportModalProps) {

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        const blob = new Blob([analysis], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${symbol}_${mode}_analysis_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 bg-slate-950 border-slate-800">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-900/20 to-slate-900">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-900/30 rounded-lg">
                                <Brain className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-white">
                                    {mode === 'llm' ? 'AI 종합 분석 보고서' : '기술적 분석 보고서'}
                                </DialogTitle>
                                <p className="text-sm text-slate-400 mt-1">
                                    {symbolName || symbol} ({symbol})
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDownload}
                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                저장
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePrint}
                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                인쇄
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <ScrollArea className="h-full px-8 py-6">
                    <div className="prose prose-invert prose-slate max-w-none">
                        <ReactMarkdown
                            components={{
                                h1: ({ node, ...props }) => (
                                    <h1 className="text-3xl font-bold text-white mb-6 pb-3 border-b border-purple-800" {...props} />
                                ),
                                h2: ({ node, ...props }) => (
                                    <h2 className="text-2xl font-bold text-purple-300 mt-8 mb-4" {...props} />
                                ),
                                h3: ({ node, ...props }) => (
                                    <h3 className="text-xl font-semibold text-slate-200 mt-6 mb-3" {...props} />
                                ),
                                p: ({ node, ...props }) => (
                                    <p className="text-slate-300 leading-relaxed mb-4" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                    <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4" {...props} />
                                ),
                                ol: ({ node, ...props }) => (
                                    <ol className="list-decimal list-inside text-slate-300 space-y-2 mb-4" {...props} />
                                ),
                                li: ({ node, ...props }) => (
                                    <li className="text-slate-300 ml-4" {...props} />
                                ),
                                blockquote: ({ node, ...props }) => (
                                    <blockquote className="border-l-4 border-purple-600 pl-4 italic text-slate-400 my-4" {...props} />
                                ),
                                code: ({ node, inline, ...props }: any) =>
                                    inline ? (
                                        <code className="bg-slate-800 text-purple-300 px-2 py-1 rounded text-sm" {...props} />
                                    ) : (
                                        <code className="block bg-slate-900 text-slate-300 p-4 rounded-lg my-4 overflow-x-auto" {...props} />
                                    ),
                                table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-6">
                                        <table className="min-w-full border border-slate-700" {...props} />
                                    </div>
                                ),
                                th: ({ node, ...props }) => (
                                    <th className="bg-slate-800 text-white px-4 py-2 text-left border border-slate-700" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                    <td className="px-4 py-2 border border-slate-700 text-slate-300" {...props} />
                                ),
                                hr: ({ node, ...props }) => (
                                    <hr className="border-slate-700 my-8" {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                    <strong className="text-white font-bold" {...props} />
                                ),
                            }}
                        >
                            {analysis}
                        </ReactMarkdown>
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50">
                    <p className="text-xs text-slate-500 text-center">
                        Generated at {new Date().toLocaleString('ko-KR')} • Powered by Claude Sonnet 4.5
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
