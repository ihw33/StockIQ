'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReportStore, AnalysisReport } from '@/lib/store/report-store';
import { CombinedReportView } from '@/components/features/reports/combined-report-view';
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
    const reports = useReportStore((state) => state.reports);
    const deleteReport = useReportStore((state) => state.deleteReport);
    const deleteSession = useReportStore((state) => state.deleteSession);
    const searchParams = useSearchParams();
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'all' | 'algo' | 'llm' | 'company'>('all');

    // Group reports by sessionId (or standalone)
    const reportGroups = useMemo(() => {
        const groups: Map<string, ReportGroup> = new Map();

        for (const report of reports) {
            if (report.sessionId) {
                const existing = groups.get(report.sessionId);
                if (existing) {
                    if (report.mode === 'algo') existing.algoReport = report;
                    if (report.mode === 'llm') existing.llmReport = report;
                    if (report.mode === 'company') existing.companyReport = report;
                    existing.hasAlgo = existing.hasAlgo || report.mode === 'algo';
                    existing.hasLlm = existing.hasLlm || report.mode === 'llm';
                    existing.hasCompany = existing.hasCompany || report.mode === 'company';
                    existing.hasPosition = existing.hasPosition || !!report.positionInfo;
                } else {
                    groups.set(report.sessionId, {
                        id: report.sessionId,
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
                    });
                }
            } else {
                groups.set(report.id, {
                    id: report.id,
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
                });
            }
        }

        return Array.from(groups.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [reports]);

    // Filter groups
    const filteredGroups = useMemo(() => {
        if (filterMode === 'all') return reportGroups;
        if (filterMode === 'algo') return reportGroups.filter(g => g.hasAlgo);
        if (filterMode === 'llm') return reportGroups.filter(g => g.hasLlm);
        if (filterMode === 'company') return reportGroups.filter(g => g.hasCompany);
        return reportGroups;
    }, [reportGroups, filterMode]);

    // Group by symbol for sidebar
    const groupedBySymbol = useMemo(() => {
        const map: Record<string, ReportGroup[]> = {};
        for (const group of filteredGroups) {
            if (!map[group.symbol]) map[group.symbol] = [];
            map[group.symbol].push(group);
        }
        return map;
    }, [filteredGroups]);

    // Auto-select from URL query
    useEffect(() => {
        const sessionParam = searchParams.get('session');
        if (sessionParam && reportGroups.length > 0) {
            const found = reportGroups.find(g => g.sessionId === sessionParam);
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
        if (group.sessionId) {
            deleteSession(group.sessionId);
        } else {
            if (group.algoReport) deleteReport(group.algoReport.id);
            if (group.llmReport) deleteReport(group.llmReport.id);
        }
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
                                {mode === 'all' ? '전체' : mode === 'algo' ? '알고리즘' : mode === 'llm' ? '심층' : '기업'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Report List */}
                <ScrollArea className="flex-1">
                    {Object.keys(groupedBySymbol).length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-sm text-slate-500">보고서가 없습니다</p>
                            <p className="text-xs text-slate-600 mt-1">War Room에서 심층 분석을 실행하세요</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {Object.entries(groupedBySymbol).map(([symbol, groups]) => (
                                <div key={symbol} className="mb-1">
                                    {/* Symbol Header */}
                                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {groups[0].symbolName} ({symbol})
                                    </div>

                                    {/* Report Items */}
                                    {groups.map((group) => (
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
                                                {group.hasAlgo && group.hasLlm ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-900/50 text-indigo-300">
                                                        종합
                                                    </span>
                                                ) : group.hasCompany ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/50 text-amber-300">
                                                        기업
                                                    </span>
                                                ) : group.hasLlm ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/50 text-purple-300">
                                                        심층
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-300">
                                                        알고
                                                    </span>
                                                )}
                                                {group.hasPosition && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-900/50 text-emerald-300">
                                                        보유
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-slate-500 ml-auto">
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
                    <CombinedReportView
                        algoReport={selectedGroup.algoReport}
                        llmReport={selectedGroup.llmReport}
                        companyReport={selectedGroup.companyReport}
                    />
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
