// ─── Macro Dashboard Utility Functions ───────────────────

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Score UI Helpers ────────────────────────────────────

export function scoreColor(score: number): string {
    if (score <= -2) return 'text-red-400';
    if (score === -1) return 'text-red-300';
    if (score === 0) return 'text-slate-400';
    if (score === 1) return 'text-emerald-300';
    return 'text-emerald-400';
}

export function scoreBg(score: number): string {
    if (score <= -2) return 'bg-red-500/10 border-red-500/30';
    if (score === -1) return 'bg-red-500/5 border-red-500/20';
    if (score === 0) return 'bg-slate-800 border-slate-700';
    if (score === 1) return 'bg-emerald-500/5 border-emerald-500/20';
    return 'bg-emerald-500/10 border-emerald-500/30';
}

export function scoreIcon(score: number) {
    if (score > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (score < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

export function safetyBadge(level: number) {
    const styles = {
        1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        2: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        3: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    const labels = {
        1: '🟢 Level 1: 외국인 우호적',
        2: '🟡 Level 2: 중립/관망',
        3: '🔴 Level 3: 외국인 이탈 경고',
    };
    return (
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold border ${styles[level as keyof typeof styles] || styles[2]}`}>
            {labels[level as keyof typeof labels] || labels[2]}
        </span>
    );
}

// ─── Text Formatting ─────────────────────────────────────

export function formatTextParts(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}
