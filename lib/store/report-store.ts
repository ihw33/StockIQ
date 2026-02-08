import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnalysisReport {
    id: string;
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
    addReport: (report: Omit<AnalysisReport, 'id' | 'timestamp'>) => string;
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

            addReport: (report) => {
                const newReport: AnalysisReport = {
                    ...report,
                    id: `${report.symbol}_${Date.now()}`,
                    timestamp: new Date(),
                };

                const today = new Date().toDateString();

                set((state) => ({
                    // Remove same symbol + same mode + same day before adding
                    reports: [
                        newReport,
                        ...state.reports.filter((r) => {
                            if (r.symbol !== report.symbol || r.mode !== report.mode) return true;
                            return new Date(r.timestamp).toDateString() !== today;
                        }),
                    ].slice(0, 100),
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
                set((state) => ({
                    reports: state.reports.filter((r) => r.id !== id),
                }));
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
        }
    )
);
