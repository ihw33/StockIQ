interface MarketCardProps {
    label: string;
    icon: string;
    value: string;
    changePct: number;
    unit?: string;
}

export function MarketCard({ label, icon, value, changePct, unit }: MarketCardProps) {
    const isPositive = changePct > 0;
    const isNegative = changePct < 0;
    const colorClass = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-400';
    const bgClass = isPositive ? 'bg-emerald-500/5 border-emerald-500/20' : isNegative ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-800 border-slate-700';

    return (
        <div className={`rounded-lg border p-3 ${bgClass}`}>
            <div className="text-lg mb-1">{icon}</div>
            <div className="text-[10px] text-slate-500 mb-1">{label}</div>
            <div className="text-sm font-bold text-white">{value}{unit || ''}</div>
            <div className={`text-xs font-mono mt-0.5 ${colorClass}`}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </div>
        </div>
    );
}
