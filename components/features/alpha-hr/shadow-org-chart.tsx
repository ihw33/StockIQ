import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface JobSnapshot {
    job_title: string;
    team_name: string;
    status: "OPEN" | "CLOSED";
}

interface TeamStats {
    count_t1: number;
    count_t2: number;
    change: number;
    pct_change: number;
}

interface DiffReport {
    new_jobs: JobSnapshot[];
    team_stats: Record<string, TeamStats>;
    spikes: string[];
}

export function ShadowOrgChart({ diffReport, loading }: { diffReport: DiffReport | null, loading: boolean }) {
    if (loading) return <div className="h-64 bg-slate-900 animate-pulse rounded-lg" />;
    if (!diffReport) return <div className="h-64 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500">No Data</div>;

    // Convert team_stats to array and sort by hiring volume (count_t2)
    const teams = Object.entries(diffReport.team_stats)
        .sort(([, a], [, b]) => b.count_t2 - a.count_t2);

    return (
        <Card className="bg-slate-950 border-slate-800 text-slate-100 flex flex-col h-full">
            <CardHeader className="py-3 border-b border-slate-800">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-bold text-slate-300">그림자 조직도 (Shadow Org)</CardTitle>
                    <span className="text-[10px] text-slate-500">실시간 채용 데이터 기반 추정</span>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(([teamName, stats]) => {
                        const isSpike = diffReport.spikes.includes(teamName);
                        return (
                            <div
                                key={teamName}
                                className={`
                                    relative p-4 rounded-xl border transition-all hover:scale-[1.02]
                                    ${isSpike
                                        ? 'bg-emerald-900/10 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'}
                                `}
                            >
                                {isSpike && (
                                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                                        AGGRESSIVE HIRING
                                    </div>
                                )}

                                <h4 className="font-bold text-sm text-slate-200 mb-1">{teamName}</h4>

                                <div className="flex justify-between items-end mt-2">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase">추정 인원 (Headcount)</div>
                                        <div className="text-xl font-mono font-bold text-white">
                                            {stats.count_t2}
                                            <span className="text-xs text-slate-500 font-normal ml-1">건 채용중</span>
                                        </div>
                                    </div>

                                    <div className={`text-right ${stats.change > 0 ? 'text-emerald-400' : stats.change < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                        <div className="text-xs font-bold">
                                            {stats.change > 0 ? '+' : ''}{stats.change}
                                        </div>
                                        <div className="text-[10px]">
                                            {stats.pct_change > 0 ? '+' : ''}{stats.pct_change}%
                                        </div>
                                    </div>
                                </div>

                                {/* Mini list of new roles if spike */}
                                {isSpike && (
                                    <div className="mt-3 pt-2 border-t border-emerald-500/20">
                                        <div className="text-[10px] text-emerald-400/80 mb-1">Recent Openings:</div>
                                        <ul className="space-y-0.5">
                                            {diffReport.new_jobs
                                                .filter(j => j.team_name === teamName)
                                                .slice(0, 2)
                                                .map((j, idx) => (
                                                    <li key={idx} className="text-[10px] text-slate-400 truncate">• {j.job_title}</li>
                                                ))}
                                            {diffReport.new_jobs.filter(j => j.team_name === teamName).length > 2 && (
                                                <li className="text-[10px] text-slate-500 italic">+ more...</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
