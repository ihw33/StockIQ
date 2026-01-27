import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvestmentSignal {
    signal_type: "BUY" | "SELL" | "HOLD";
    confidence_score: number;
    reason_summary: string;
    key_factors: {
        bullish: string[];
        bearish: string[];
    };
    company_id: string;
}

export function InvestmentCard({ signal, loading }: { signal: InvestmentSignal | null, loading: boolean }) {
    if (loading) {
        return (
            <Card className="w-full h-full animate-pulse bg-slate-900 border-slate-800">
                <CardHeader>
                    <div className="h-6 w-1/3 bg-slate-800 rounded"></div>
                </CardHeader>
                <CardContent>
                    <div className="h-20 bg-slate-800 rounded mb-4"></div>
                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                </CardContent>
            </Card>
        );
    }

    if (!signal) {
        return (
            <Card className="w-full h-full bg-slate-900 border-slate-800 text-slate-400 flex items-center justify-center">
                Select a company to specific analysis
            </Card>
        );
    }

    const isBuy = signal.signal_type === "BUY";
    const isSell = signal.signal_type === "SELL";
    const colorClass = isBuy ? "text-emerald-400" : isSell ? "text-rose-400" : "text-yellow-400";
    const bgClass = isBuy ? "bg-emerald-400/10 border-emerald-400/20" : isSell ? "bg-rose-400/10 border-rose-400/20" : "bg-yellow-400/10 border-yellow-400/20";

    return (
        <Card className="w-full h-full bg-slate-950 border-slate-800 text-slate-100 flex flex-col">
            <CardHeader className="pb-2 border-b border-slate-800">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Unconventional Alpha Signal</div>
                        <CardTitle className="text-xl flex items-center gap-3">
                            {signal.company_id}
                            <Badge variant="outline" className={`${bgClass} ${colorClass} text-base px-3 py-1`}>
                                {signal.signal_type}
                            </Badge>
                        </CardTitle>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold font-mono">{signal.confidence_score}</div>
                        <div className="text-[10px] text-slate-500 uppercase">신뢰도 점수 (Confidence)</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-y-auto">
                <div className="mb-6">
                    <h4 className="text-sm text-slate-400 mb-2 font-semibold">AI 애널리스트 요약</h4>
                    <p className="text-lg leading-relaxed text-slate-200">
                        "{signal.reason_summary}"
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                        <h5 className="text-emerald-500 text-xs font-bold mb-2 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 상승 요인 (Bullish)
                        </h5>
                        <ul className="space-y-1.5">
                            {signal.key_factors.bullish.map((f, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                    <span className="text-slate-600 mt-1">•</span> {f}
                                </li>
                            ))}
                            {signal.key_factors.bullish.length === 0 && <li className="text-xs text-slate-600 italic">감지되지 않음</li>}
                        </ul>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                        <h5 className="text-rose-500 text-xs font-bold mb-2 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> 하락/주의 요인 (Bearish)
                        </h5>
                        <ul className="space-y-1.5">
                            {signal.key_factors.bearish.map((f, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                    <span className="text-slate-600 mt-1">•</span> {f}
                                </li>
                            ))}
                            {signal.key_factors.bearish.length === 0 && <li className="text-xs text-slate-600 italic">감지되지 않음</li>}
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
