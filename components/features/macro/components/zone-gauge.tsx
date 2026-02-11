import { ZONE_CONFIGS } from '../config';

interface ZoneGaugeProps {
    zoneKey: string;
    rawValue: number;
}

export function ZoneGauge({ zoneKey, rawValue }: ZoneGaugeProps) {
    const config = ZONE_CONFIGS[zoneKey];
    if (!config) return null;

    const pos = config.normalize(rawValue);
    // 현재 위치가 어느 zone에 있는지
    const currentZone = config.zones.find(z => pos >= z.min && pos < z.max) || config.zones[2];

    return (
        <div className="mt-2.5 pt-2 border-t border-slate-700/50">
            {/* Zone label */}
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-500">안전 구간</span>
                <span className={`text-[10px] font-bold ${
                    currentZone.color.includes('red') ? 'text-red-400' :
                    currentZone.color.includes('emerald') ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                    {currentZone.label}
                </span>
            </div>
            {/* 5-zone bar */}
            <div className="relative w-full h-2 rounded-full flex overflow-hidden">
                {config.zones.map((zone, i) => (
                    <div
                        key={i}
                        className={`h-full ${zone.color} ${i === 0 ? 'rounded-l-full' : ''} ${i === config.zones.length - 1 ? 'rounded-r-full' : ''}`}
                        style={{ width: `${zone.max - zone.min}%` }}
                    />
                ))}
                {/* Needle / indicator */}
                <div
                    className="absolute top-[-2px] w-[3px] h-[12px] bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                    style={{ left: `calc(${pos}% - 1.5px)` }}
                />
            </div>
            {/* Tick labels */}
            <div className="relative w-full h-3 mt-0.5">
                {config.ticks.map((tick, i) => (
                    <span
                        key={i}
                        className="absolute text-[8px] text-slate-600 -translate-x-1/2"
                        style={{ left: `${tick.pos}%` }}
                    >
                        {tick.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
