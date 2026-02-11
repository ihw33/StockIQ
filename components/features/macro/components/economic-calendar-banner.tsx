'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { EconomicEvent } from '../types';

interface EconomicCalendarBannerProps {
    events: EconomicEvent[];
}

export function EconomicCalendarBanner({ events }: EconomicCalendarBannerProps) {
    const [expanded, setExpanded] = useState(false);
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 이벤트
    const todayEvents = events.filter(ev => ev.date?.slice(0, 10) === today);
    // 이번 주 High 이벤트 (오늘 제외)
    const upcomingHigh = events.filter(ev => ev.date?.slice(0, 10) !== today && ev.impact === 'High');

    // 헤더 요약 텍스트
    const highCount = events.filter(e => e.impact === 'High').length;
    const summary = todayEvents.length > 0
        ? `오늘 ${todayEvents.length}건 — ${todayEvents.map(e => e.title).join(', ')}`
        : `이번 주 주요 지표 ${highCount}건`;

    return (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20">
            {/* 배너 헤더 — 항상 보임 */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-indigo-950/30 transition-colors rounded-lg"
            >
                <span className="text-sm">📅</span>
                <span className="text-xs font-medium text-indigo-300 flex-1 truncate">{summary}</span>
                {highCount > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300">
                        HIGH {highCount}
                    </span>
                )}
                {expanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                }
            </button>

            {/* 펼친 상세 */}
            {expanded && (
                <div className="px-4 pb-3 space-y-2">
                    {(() => {
                        const grouped: Record<string, EconomicEvent[]> = {};
                        for (const ev of events) {
                            const dk = ev.date?.slice(0, 10) || '';
                            if (!grouped[dk]) grouped[dk] = [];
                            grouped[dk].push(ev);
                        }
                        return Object.keys(grouped).sort().map(dateKey => {
                            const d = new Date(dateKey + 'T00:00:00');
                            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                            const label = `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
                            const isToday = dateKey === today;

                            return (
                                <div key={dateKey}>
                                    <div className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                                        {label} {isToday && '  TODAY'}
                                    </div>
                                    {grouped[dateKey].map((ev, i) => {
                                        const time = ev.date?.slice(11, 16) || '';
                                        return (
                                            <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.impact === 'High' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                                <span className="text-slate-500 font-mono w-10 shrink-0">{time}</span>
                                                <span className="text-slate-300 flex-1">{ev.title}</span>
                                                {ev.forecast && (
                                                    <span className="text-slate-500 shrink-0 text-[10px]">
                                                        {ev.forecast} / {ev.previous}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        });
                    })()}
                </div>
            )}
        </div>
    );
}
