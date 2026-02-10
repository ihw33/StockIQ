import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnalysisReport {
    id: string;
    dbId?: number; // Database ID from backend
    symbol: string;
    symbolName: string;
    mode: 'algo' | 'llm' | 'company';
    analysis: string;
    timestamp: Date;
    sessionId?: string;
    positionInfo?: {
        avgPrice: number;
        quantity: number;
        profitRate: number;
    };
}

interface ReportStore {
    reports: AnalysisReport[];
    deletedDbIds: number[]; // Track deleted DB IDs to prevent re-adding
    addReport: (report: Omit<AnalysisReport, 'id'> & { timestamp?: Date }) => string;
    getReportsBySymbol: (symbol: string) => AnalysisReport[];
    getReportsBySession: (sessionId: string) => AnalysisReport[];
    getRecentReports: (limit?: number) => AnalysisReport[];
    deleteReport: (id: string) => void;
    deleteSession: (sessionId: string) => void;
    clearOldReports: (daysToKeep?: number) => void;
}

export const useReportStore = create<ReportStore>()(
    persist(
        (set, get) => ({
            reports: [],
            deletedDbIds: [],

            addReport: (report) => {
                const newReport: AnalysisReport = {
                    ...report,
                    id: `${report.symbol}_${report.mode}_${Date.now()}`,
                    timestamp: report.timestamp || new Date(),
                };

                set((state) => ({
                    // Add new report without removing duplicates (keep all reports)
                    reports: [newReport, ...state.reports].slice(0, 100),
                }));

                return newReport.id;
            },

            getReportsBySymbol: (symbol) => {
                return get().reports.filter((r) => r.symbol === symbol);
            },

            getReportsBySession: (sessionId) => {
                return get().reports
                    .filter((r) => r.sessionId === sessionId)
                    .sort((a, b) => (a.mode === 'algo' ? -1 : 1));
            },

            getRecentReports: (limit = 20) => {
                return get().reports.slice(0, limit);
            },

            deleteReport: (id) => {
                set((state) => {
                    const report = state.reports.find(r => r.id === id);
                    const newDeletedIds = report?.dbId ? [...state.deletedDbIds, report.dbId] : state.deletedDbIds;
                    return {
                        reports: state.reports.filter((r) => r.id !== id),
                        deletedDbIds: newDeletedIds,
                    };
                });
            },

            deleteSession: (sessionId) => {
                set((state) => ({
                    reports: state.reports.filter((r) => r.sessionId !== sessionId),
                }));
            },

            clearOldReports: (daysToKeep = 30) => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

                set((state) => ({
                    reports: state.reports.filter(
                        (r) => new Date(r.timestamp) > cutoffDate
                    ),
                }));
            },
        }),
        {
            name: 'stockiq-reports',
            onRehydrateStorage: () => (state) => {
                // Clean up duplicate IDs after loading from storage
                if (state) {
                    const seen = new Set<string>();
                    const cleaned = state.reports.filter(r => {
                        if (seen.has(r.id)) return false;
                        seen.add(r.id);
                        return true;
                    });
                    if (cleaned.length !== state.reports.length) {
                        state.reports = cleaned;
                    }
                }
            },
        }
    )
);
