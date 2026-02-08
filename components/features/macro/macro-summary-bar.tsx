'use client';

import { useEffect, useState } from 'react';

interface MacroResponse {
    status: string;
    data: {
        safety_level: number;
        overall_score: number;
        prediction_direction: string;
        tier_a: {
            dxy: { value: number | null; change_pct: number; score: number };
            us10y: { value: number | null; change_bps: number; score: number };
            vix: { value: number | null; change_pct: number; score: number };
        };
        tier_b: {
            foreign_cash: { net_amount: number; score: number };
            futures: { net: number; score: number };
            short_selling: { volume: number; change_pct: number; score: number };
        };
    };
}

const LEVEL_STYLES: Record<number, { dot: string; text: string; bg: string; label: string }> = {
    1: { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'SAFE' },
    2: { dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'CAUTION' },
    3: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', label: 'DANGER' },
};

function ScoreChip({ label, score, detail }: { label: string; score: number; detail?: string }) {
    const color = score > 0 ? 'text-emerald-400 bg-emerald-500/10' : score < 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-500 bg-slate-800';
    const sign = score > 0 ? '+' : '';
    return (
        <span className={`${color} px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1`} title={detail}>
            {label} {sign}{score}
        </span>
    );
}

export function MacroSummaryBar() {
    const [resp, setResp] = useState<MacroResponse | null>(null);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            try {
                const res = await fetch('/api/macro?endpoint=today');
                if (res.ok) {
                    const json = await res.json();
                    if (!ignore && json.status === 'success' && json.data) setResp(json);
                }
            } catch {
                // silently fail
            }
        };
        load();
        return () => { ignore = true; };
    }, []);

    if (!resp) return null;

    const d = resp.data;
    const level = d.safety_level;
    const style = LEVEL_STYLES[level] || LEVEL_STYLES[2];

    return (
        <div className="bg-slate-800/60 border-b border-slate-700/50 px-4 py-2.5 flex items-center gap-5 text-sm shrink-0">
            {/* Level badge */}
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${style.bg}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot} animate-pulse`} />
                <span className={`font-bold ${style.text}`}>
                    Level {level}
                </span>
                <span className="text-slate-500 text-xs">
                    {style.label}
                </span>
            </div>

            {/* Total score */}
            <span className="text-slate-400 font-mono text-sm">
                Score: <span className={d.overall_score > 0 ? 'text-emerald-400' : d.overall_score < 0 ? 'text-red-400' : 'text-slate-300'}>
                    {d.overall_score > 0 ? '+' : ''}{d.overall_score.toFixed(2)}
                </span>
            </span>

            <span className="text-slate-700">|</span>

            {/* Tier A: Global */}
            <div className="flex items-center gap-1.5">
                <span className="text-slate-600 text-xs mr-0.5">글로벌</span>
                <ScoreChip label="DXY" score={d.tier_a.dxy.score} detail={d.tier_a.dxy.value ? `${d.tier_a.dxy.value.toFixed(2)}` : undefined} />
                <ScoreChip label="10Y" score={d.tier_a.us10y.score} detail={d.tier_a.us10y.value ? `${d.tier_a.us10y.value.toFixed(2)}%` : undefined} />
                <ScoreChip label="VIX" score={d.tier_a.vix.score} detail={d.tier_a.vix.value ? `${d.tier_a.vix.value.toFixed(1)}` : undefined} />
            </div>

            <span className="text-slate-700">|</span>

            {/* Tier B: Domestic */}
            <div className="flex items-center gap-1.5">
                <span className="text-slate-600 text-xs mr-0.5">수급</span>
                <ScoreChip label="현물" score={d.tier_b.foreign_cash.score} />
                <ScoreChip label="선물" score={d.tier_b.futures.score} />
                <ScoreChip label="공매도" score={d.tier_b.short_selling.score} />
            </div>

            {/* Link */}
            <button
                onClick={() => window.location.href = '/macro'}
                className="ml-auto text-slate-500 hover:text-slate-300 transition-colors text-xs px-2 py-1 rounded hover:bg-slate-700"
            >
                상세 →
            </button>
        </div>
    );
}
