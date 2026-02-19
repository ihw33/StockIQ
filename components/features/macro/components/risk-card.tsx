interface RiskCardProps {
    label: string;
    value: string;
    subValue: string;
    subColor?: 'red' | 'green' | 'neutral';
    desc?: string;
}

export function RiskCard({ label, value, subValue, subColor, desc }: RiskCardProps) {
    const color = subColor === 'red' ? 'text-red-400' : subColor === 'green' ? 'text-emerald-400' : 'text-slate-400';
    return (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
            <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
            {desc && <div className="text-[9px] text-slate-600 mb-1">{desc}</div>}
            <div className="text-sm font-bold text-white">{value}</div>
            <div className={`text-xs mt-0.5 ${color}`}>{subValue}</div>
        </div>
    );
}
