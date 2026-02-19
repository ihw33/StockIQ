"use client";

import React, { useRef } from 'react';
import { AnalysisReport } from '@/lib/store/report-store';
import { AlgoReportView } from './algo-report-view';
import { LlmReportView } from './llm-report-view';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CombinedReportViewProps {
    algoReport?: AnalysisReport;
    llmReport?: AnalysisReport;
    companyReport?: AnalysisReport;
}

export function CombinedReportView({ algoReport, llmReport, companyReport }: CombinedReportViewProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const report = companyReport || llmReport || algoReport;
    if (!report) return null;

    const handlePrint = () => window.print();

    const handleDownload = () => {
        const parts: string[] = [];
        if (algoReport) parts.push('# 기술적 분석\n\n' + algoReport.analysis);
        if (llmReport) parts.push('# AI 종합 분석\n\n' + llmReport.analysis);
        if (companyReport) parts.push('# 기업 분석\n\n' + companyReport.analysis);
        const content = parts.join('\n\n---\n\n');

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.symbol}_analysis_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div ref={contentRef} className="max-w-4xl mx-auto">
            {/* Report Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between print:static">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {report.symbolName} ({report.symbol})
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(report.timestamp), 'yyyy년 M월 d일 (EEE) HH:mm', { locale: ko })}
                    </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-1.5" />
                        저장
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-1.5" />
                        인쇄
                    </Button>
                </div>
            </div>

            {/* Position Info Banner */}
            {report.positionInfo && (
                <div className="mx-8 mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center gap-6 text-sm">
                        <span className="font-semibold text-indigo-900">💼 보유 포지션</span>
                        <span className="text-gray-700">
                            평단가 <b className="text-gray-900">{report.positionInfo.avgPrice.toLocaleString()}원</b>
                        </span>
                        <span className="text-gray-700">
                            수량 <b className="text-gray-900">{report.positionInfo.quantity}주</b>
                        </span>
                        <span className={report.positionInfo.profitRate >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                            수익률 <b>{report.positionInfo.profitRate >= 0 ? '+' : ''}{report.positionInfo.profitRate.toFixed(2)}%</b>
                        </span>
                    </div>
                </div>
            )}

            {/* Report Body */}
            <div className="px-8 py-6 space-y-8">
                {/* Algo Analysis Section */}
                {algoReport && (
                    <section>
                        <AlgoReportView analysis={algoReport.analysis} />
                    </section>
                )}

                {/* Divider */}
                {algoReport && llmReport && (
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-white text-sm text-gray-500 font-medium">
                                AI 종합 분석
                            </span>
                        </div>
                    </div>
                )}

                {/* LLM Analysis Section */}
                {llmReport && (
                    <section>
                        <LlmReportView analysis={llmReport.analysis} />
                    </section>
                )}

                {/* Company Divider */}
                {companyReport && (algoReport || llmReport) && (
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-white text-sm text-gray-500 font-medium">
                                기업 분석
                            </span>
                        </div>
                    </div>
                )}

                {/* Company Analysis Section */}
                {companyReport && (
                    <section>
                        <LlmReportView analysis={companyReport.analysis} />
                    </section>
                )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">
                    Generated at {format(new Date(report.timestamp), 'yyyy-MM-dd HH:mm:ss')} | StockIQ AI Analysis Engine
                </p>
            </div>
        </div>
    );
}
