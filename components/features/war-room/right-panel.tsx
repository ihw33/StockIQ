'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { AIControlPanel } from './ai-control-panel';
import { BarChart3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/lib/store/report-store';

const ReportsTab = dynamic(() => import('./reports-tab').then(m => ({ default: m.ReportsTab })), {
    loading: () => <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">로딩...</div>,
});

type Tab = 'analysis' | 'reports';

export interface RecentAlert {
    id: number;
    symbol: string;
    stockName: string;
    analysisType: string;
    mode: 'algo' | 'llm' | 'company';
    analyzedAt: string;
}

export interface RightPanelHandle {
    switchToAnalysis: () => void;
    switchToReports: () => void;
}

interface RightPanelProps {
    currentSymbol: string;
    currentName: string;
}

export const RightPanel = forwardRef<RightPanelHandle, RightPanelProps>(function RightPanel({ currentSymbol, currentName }, ref) {
    const [activeTab, setActiveTab] = useState<Tab>('analysis');
    const [newReportCount, setNewReportCount] = useState(0);
    const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'algo' | 'llm' | 'company'>('all');
    const addReport = useReportStore((s) => s.addReport);
    const reports = useReportStore((s) => s.reports);

    useImperativeHandle(ref, () => ({
        switchToAnalysis: () => setActiveTab('analysis'),
        switchToReports: () => setActiveTab('reports'),
    }));

    const goToReports = useCallback((sessionId?: string, mode?: 'algo' | 'llm' | 'company') => {
        if (sessionId) setSelectedSessionId(sessionId);
        if (mode) setSelectedFilter(mode);
        setActiveTab('reports');
    }, []);

    // Poll for backend-saved analysis reports
    useEffect(() => {
        const checkPending = async () => {
            try {
                const res = await fetch('/api/reports/pending?minutes=10');
                if (!res.ok) return;
                const data = await res.json();
                if (!data.reports?.length) return;

                let newCount = 0;
                const newAlerts: RecentAlert[] = [];

                for (const r of data.reports) {
                    const sessionId = `db_${r.id}`;

                    // Skip if already in report store
                    if (reports.some(rpt => rpt.sessionId === sessionId)) continue;

                    const mode = r.analysis_type === 'algo' ? 'algo' as const
                        : r.analysis_type === 'company_fundamental' ? 'company' as const
                        : 'llm' as const;

                    addReport({
                        symbol: r.symbol,
                        symbolName: r.stock_name || r.symbol,
                        mode,
                        analysis: r.analysis,
                        sessionId,
                    });

                    newAlerts.push({
                        id: r.id,
                        symbol: r.symbol,
                        stockName: r.stock_name || r.symbol,
                        analysisType: r.analysis_type,
                        mode,
                        analyzedAt: r.analyzed_at,
                    });
                    newCount++;
                }

                if (newCount > 0) {
                    setNewReportCount(prev => prev + newCount);
                    setRecentAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
                }
            } catch {
                // silent
            }
        };

        // Build initial alerts from recent reports already in store (last 10 min)
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        const existingRecent = reports
            .filter(r => r.sessionId?.startsWith('db_') && new Date(r.timestamp).getTime() > tenMinAgo)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10)
            .map(r => ({
                id: parseInt(r.sessionId!.replace('db_', '')),
                symbol: r.symbol,
                stockName: r.symbolName,
                analysisType: r.mode === 'algo' ? 'algo' : r.mode === 'company' ? 'company_fundamental' : 'deep_llm',
                mode: r.mode,
                analyzedAt: new Date(r.timestamp).toISOString(),
            }));
        if (existingRecent.length > 0) {
            setRecentAlerts(existingRecent);
        }

        checkPending();
        const interval = setInterval(checkPending, 15000);
        return () => clearInterval(interval);
    }, [addReport, reports]);

    // Clear badge when switching to reports tab
    useEffect(() => {
        if (activeTab === 'reports') {
            setNewReportCount(0);
        }
    }, [activeTab]);

    return (
        <div className="w-[520px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
            {/* Tab Header */}
            <div className="flex border-b border-slate-800 shrink-0">
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={cn(
                        'flex-1 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                        activeTab === 'analysis'
                            ? 'text-white border-b-2 border-blue-500 bg-slate-800/50'
                            : 'text-slate-500 hover:text-slate-300'
                    )}
                >
                    <BarChart3 className="w-3.5 h-3.5" />
                    AI 분석
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={cn(
                        'flex-1 py-2.5 text-xs font-medium transition-all flex items-center justify-center gap-1.5 relative',
                        activeTab === 'reports'
                            ? 'text-white border-b-2 border-indigo-500 bg-slate-800/50'
                            : 'text-slate-500 hover:text-slate-300'
                    )}
                >
                    <FileText className="w-3.5 h-3.5" />
                    보고서
                    {newReportCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                            {newReportCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 flex flex-col">
                {activeTab === 'analysis' ? (
                    <AIControlPanel
                        currentSymbol={currentSymbol}
                        currentName={currentName}
                        recentAlerts={recentAlerts}
                        onGoToReports={goToReports}
                    />
                ) : (
                    <ReportsTab initialSessionId={selectedSessionId} initialFilter={selectedFilter} />
                )}
            </div>
        </div>
    );
});
