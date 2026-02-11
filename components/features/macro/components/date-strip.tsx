const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface DateStripProps {
    availableDates: {
        date: string;
        score: number;
        safety_level: number;
        has_llm: boolean;
    }[];
    selectedDate: string | null;
    onSelectDate: (date: string | null) => void;
}

export function DateStrip({ availableDates, selectedDate, onSelectDate }: DateStripProps) {
    const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = toLocal(new Date());
    const dateMap = new Map(availableDates.map(d => [d.date, d]));

    // 최근 14일 생성 (오늘 포함)
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(toLocal(d));
    }

    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {days.map((dateStr) => {
                const info = dateMap.get(dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate || (selectedDate === null && isToday);
                const hasData = !!info;
                const hasLlm = info?.has_llm || false;

                const d = new Date(dateStr + 'T00:00:00');
                const dayNum = d.getDate();
                const dayName = DAY_NAMES[d.getDay()];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                const safetyBorder = info
                    ? info.safety_level === 1 ? 'border-emerald-500/60' : info.safety_level === 3 ? 'border-red-500/60' : 'border-amber-500/60'
                    : 'border-slate-700/50';

                return (
                    <button
                        key={dateStr}
                        onClick={() => {
                            if (isToday) onSelectDate(null);
                            else onSelectDate(dateStr);
                        }}
                        className={`relative flex flex-col items-center shrink-0 w-12 py-1.5 rounded-lg border transition-all cursor-pointer
                            ${isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                : hasData
                                    ? `bg-slate-800/50 ${safetyBorder} text-slate-300 hover:bg-slate-700/50`
                                    : 'bg-slate-900/20 border-slate-800/30 text-slate-600 hover:bg-slate-800/30'
                            }
                        `}
                    >
                        <span className={`text-[9px] leading-none ${isWeekend && !isSelected ? 'text-slate-600' : ''}`}>
                            {dayName}
                        </span>
                        <span className={`text-sm font-bold leading-tight mt-0.5 ${isSelected ? 'text-white' : ''}`}>
                            {dayNum}
                        </span>
                        {/* 하단 인디케이터 */}
                        <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                            {hasData && (
                                <span className={`w-1 h-1 rounded-full ${
                                    info!.safety_level === 1 ? 'bg-emerald-400' :
                                    info!.safety_level === 3 ? 'bg-red-400' : 'bg-amber-400'
                                }`} />
                            )}
                            {hasLlm && (
                                <span className="w-1 h-1 rounded-full bg-purple-400" />
                            )}
                        </div>
                        {isToday && !isSelected && (
                            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
