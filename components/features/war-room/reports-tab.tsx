'use client';

import { useState, useEffect } from 'react';
import { useReportStore, AnalysisReport } from '@/lib/store/report-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterMode = 'all' | 'algo' | 'llm' | 'company';

const FILTER_TABS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'algo', label: '알고리즘' },
    { key: 'llm', label: '종합' },
    { key: 'company', label: '기업' },
];

interface ReportsTabProps {
    initialFilter?: FilterMode;
}

export function ReportsTab({ initialFilter }: ReportsTabProps = {}) {
    const reports = useReportStore((s) => s.reports);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterMode>(initialFilter ?? 'all');

    // Sort by timestamp descending
    const sorted = [...reports].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply filter
    const filtered = filter === 'all' ? sorted : sorted.filter(r => r.mode === filter);

    const selectedReport = selectedId ? reports.find(r => r.id === selectedId) : null;

    // Format timestamp as "MM/DD HH:MM"
    const formatTimestamp = (timestamp: Date) => {
        const d = new Date(timestamp);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Tabs */}
            <div className="flex border-b border-slate-800 shrink-0 px-2 pt-1.5">
                {FILTER_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setFilter(tab.key); setSelectedId(null); }}
                        className={cn(
                            'px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors',
                            filter === tab.key
                                ? 'text-white bg-slate-800'
                                : 'text-slate-500 hover:text-slate-300'
                        )}
                    >
                        {tab.label}
                        {filter !== tab.key && countByMode(sorted, tab.key) > 0 && (
                            <span className="ml-1 text-slate-600">{countByMode(sorted, tab.key)}</span>
                        )}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6">
                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm text-center">
                        {filter === 'all' ? (
                            <>보고서가 없습니다<br />AI 분석 탭에서 분석을 실행하면<br />보고서가 자동 생성됩니다</>
                        ) : (
                            <>{FILTER_TABS.find(t => t.key === filter)?.label} 보고서가 없습니다</>
                        )}
                    </p>
                </div>
            ) : (
                <>
                    {/* Report list */}
                    <ScrollArea className={selectedReport ? 'h-48 shrink-0' : 'flex-1'}>
                        <div className="p-2 space-y-1">
                            {filtered.map((report) => (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedId(report.id)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                                        selectedId === report.id
                                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    )}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className={cn(
                                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                            report.mode === 'algo' ? 'bg-blue-500/15 text-blue-400' :
                                            report.mode === 'company' ? 'bg-amber-500/15 text-amber-400' :
                                            'bg-purple-500/15 text-purple-400'
                                        )}>
                                            {modeBadge(report.mode)}
                                        </span>
                                        <span className="font-medium">{report.symbolName || report.symbol}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {formatTimestamp(report.timestamp)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Selected report content */}
                    {selectedReport && (
                        <div className="flex-1 border-t border-slate-700 flex flex-col min-h-0">
                            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
                                <span className="text-xs font-medium text-slate-300">
                                    {selectedReport.symbolName} - {modeLabel(selectedReport.mode)}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                    {formatTimestamp(selectedReport.timestamp)}
                                </span>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-3 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedReport.analysis}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </>
            )}

            {/* Footer */}
            <div className="p-2 border-t border-slate-800 shrink-0">
                <button
                    onClick={() => window.location.href = '/reports'}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ExternalLink className="w-3 h-3" /> 전체 보기
                </button>
            </div>
        </div>
    );
}

function modeLabel(mode: string): string {
    switch (mode) {
        case 'algo': return '알고리즘 분석';
        case 'llm': return '종합 분석';
        case 'company': return '기업 분석';
        default: return mode;
    }
}

function modeBadge(mode: string): string {
    switch (mode) {
        case 'algo': return '알고';
        case 'llm': return '종합';
        case 'company': return '기업';
        default: return mode;
    }
}

function countByMode(reports: AnalysisReport[], filter: FilterMode): number {
    if (filter === 'all') return reports.length;
    return reports.filter(r => r.mode === filter).length;
}
