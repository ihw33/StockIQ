'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReportStore, AnalysisReport } from '@/lib/store/report-store';
import { AlgoReportView } from '@/components/features/reports/algo-report-view';
import { LlmReportView } from '@/components/features/reports/llm-report-view';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, FileText, Trash2 } from 'lucide-react';

interface ReportGroup {
    id: string; // sessionId or report.id
    sessionId?: string;
    symbol: string;
    symbolName: string;
    timestamp: Date;
    hasAlgo: boolean;
    hasLlm: boolean;
    hasCompany: boolean;
    hasPosition: boolean;
    algoReport?: AnalysisReport;
    llmReport?: AnalysisReport;
    companyReport?: AnalysisReport;
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">로딩 중...</div>}>
            <ReportsContent />
        </Suspense>
    );
}

function ReportsContent() {
    const reports = useReportStore((state) => state.reports);
    const deleteReport = useReportStore((state) => state.deleteReport);
    const deleteSession = useReportStore((state) => state.deleteSession);
    const searchParams = useSearchParams();
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'all' | 'algo' | 'llm' | 'company'>('all');

    // Convert reports to individual items (no grouping)
    const reportGroups = useMemo(() => {
        return reports
            .map((report): ReportGroup => ({
                id: report.id,
                sessionId: report.sessionId,
                symbol: report.symbol,
                symbolName: report.symbolName,
                timestamp: new Date(report.timestamp),
                hasAlgo: report.mode === 'algo',
                hasLlm: report.mode === 'llm',
                hasCompany: report.mode === 'company',
                hasPosition: !!report.positionInfo,
                algoReport: report.mode === 'algo' ? report : undefined,
                llmReport: report.mode === 'llm' ? report : undefined,
                companyReport: report.mode === 'company' ? report : undefined,
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [reports]);

    // Filter groups
    const filteredGroups = useMemo(() => {
        if (filterMode === 'all') return reportGroups;
        if (filterMode === 'algo') return reportGroups.filter(g => g.hasAlgo);
        if (filterMode === 'llm') return reportGroups.filter(g => g.hasLlm);
        if (filterMode === 'company') return reportGroups.filter(g => g.hasCompany);
        return reportGroups;
    }, [reportGroups, filterMode]);

    // No grouping by symbol - display all reports individually
    const displayGroups = filteredGroups;

    // Auto-select from URL query (by report ID)
    useEffect(() => {
        const reportIdParam = searchParams.get('id');
        if (reportIdParam && reportGroups.length > 0) {
            const found = reportGroups.find(g => g.id === reportIdParam);
            if (found) {
                setSelectedGroupId(found.id);
            }
        }
    }, [searchParams, reportGroups]);

    // Auto-select first report if none selected
    useEffect(() => {
        if (!selectedGroupId && reportGroups.length > 0) {
            setSelectedGroupId(reportGroups[0].id);
        }
    }, [reportGroups, selectedGroupId]);

    const selectedGroup = reportGroups.find(g => g.id === selectedGroupId);

    const handleDelete = (group: ReportGroup) => {
        if (!confirm('이 보고서를 삭제하시겠습니까?')) return;
        if (group.algoReport) deleteReport(group.algoReport.id);
        if (group.llmReport) deleteReport(group.llmReport.id);
        if (group.companyReport) deleteReport(group.companyReport.id);
        if (selectedGroupId === group.id) {
            setSelectedGroupId(null);
        }
    };

    return (
        <div className="flex h-screen">
            {/* Left Sidebar */}
            <aside className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <h1 className="text-lg font-bold text-white">분석 보고서</h1>
                        <span className="text-xs text-slate-500 ml-auto">{reportGroups.length}개</span>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                        {(['all', 'algo', 'llm', 'company'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setFilterMode(mode)}
                                className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                                    filterMode === mode
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:text-slate-300'
                                }`}
                            >
                                {mode === 'all' ? '전체' : mode === 'algo' ? '알고리즘' : mode === 'llm' ? '종합' : '기업'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Report List */}
                <ScrollArea className="flex-1">
                    {displayGroups.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-sm text-slate-500">보고서가 없습니다</p>
                            <p className="text-xs text-slate-600 mt-1">War Room에서 종합 분석을 실행하세요</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {displayGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`group px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                                        selectedGroupId === group.id
                                            ? 'bg-slate-800 border-l-indigo-500'
                                            : 'border-l-transparent hover:bg-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {group.hasAlgo && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-300">
                                                알고
                                            </span>
                                        )}
                                        {group.hasLlm && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/50 text-purple-300">
                                                종합
                                            </span>
                                        )}
                                        {group.hasCompany && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/50 text-amber-300">
                                                기업
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-400 flex-1">
                                            {group.symbolName}
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            {format(new Date(group.timestamp), 'M/d HH:mm')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-400 line-clamp-1 flex-1">
                                            {(group.companyReport?.analysis || group.llmReport?.analysis || group.algoReport?.analysis || '').substring(0, 60)}...
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(group);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 ml-2 p-1 hover:bg-slate-700 rounded transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3 text-slate-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Back Button */}
                <div className="p-3 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => window.location.href = '/'}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        대시보드로 돌아가기
                    </Button>
                </div>
            </aside>

            {/* Right Content Area */}
            <main className="flex-1 bg-white overflow-y-auto">
                {selectedGroup ? (
                    <div className="max-w-4xl mx-auto p-8">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                {selectedGroup.hasAlgo && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">알고리즘</Badge>}
                                {selectedGroup.hasLlm && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">종합 분석</Badge>}
                                {selectedGroup.hasCompany && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">기업 분석</Badge>}
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {selectedGroup.symbolName} ({selectedGroup.symbol})
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {format(new Date(selectedGroup.timestamp), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                            </p>
                        </div>

                        {/* Report Content */}
                        {selectedGroup.algoReport && (
                            <AlgoReportView analysis={selectedGroup.algoReport.analysis} />
                        )}
                        {selectedGroup.llmReport && (
                            <LlmReportView analysis={selectedGroup.llmReport.analysis} />
                        )}
                        {selectedGroup.companyReport && (
                            <LlmReportView
                                analysis={selectedGroup.companyReport.analysis}
                                mode="company"
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-lg text-gray-400">보고서를 선택하세요</p>
                            <p className="text-sm text-gray-300 mt-1">
                                왼쪽 목록에서 보고서를 클릭하면 여기에 표시됩니다
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
