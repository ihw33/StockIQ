import { scoreColor, scoreBg, scoreIcon } from '../utils';
import { ZoneGauge } from './zone-gauge';

interface ScoreCardProps {
    label: string;
    icon: string;
    value: string;
    subValue: string;
    unit?: string;
    score: number;
    accuracy?: number;
    zoneKey?: string;
    rawValue?: number;
}

export function ScoreCard({ label, icon, value, subValue, unit, score, accuracy, zoneKey, rawValue }: ScoreCardProps) {
    return (
        <div className={`rounded-lg border p-4 ${scoreBg(score)}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{icon}</span>
                <div className="flex items-center gap-1">
                    {scoreIcon(score)}
                    <span className={`text-sm font-bold ${scoreColor(score)}`}>{score > 0 ? '+' : ''}{score}</span>
                </div>
            </div>
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{subValue}{unit}</div>

            {/* Zone Gauge */}
            {zoneKey && rawValue !== undefined && <ZoneGauge zoneKey={zoneKey} rawValue={rawValue} />}

            {accuracy !== undefined && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">적중률</span>
                        <span className="text-xs font-medium text-slate-300">{(accuracy * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
                        <div
                            className={`h-1 rounded-full ${accuracy >= 0.7 ? 'bg-emerald-400' : accuracy >= 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${accuracy * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
