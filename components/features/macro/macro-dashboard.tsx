'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
interface MacroScore {
    value?: number | null;
    change_pct?: number;
    change_bps?: number;
    score: number;
    net_amount?: number;
    net?: number;
    volume?: number;
}

interface GlobalMarketItem {
    value: number | null;
    change_pct: number;
}

interface GlobalMarkets {
    nasdaq: GlobalMarketItem;
    sp500: GlobalMarketItem;
    oil: GlobalMarketItem;
    gold: GlobalMarketItem;
    bitcoin: GlobalMarketItem;
    krw_usd: KrwUsdItem;
}

interface KrwUsdItem {
    value: number | null;
    change: number;
    change_pct: number;
}

interface MacroData {
    date: string;
    kr_market_day?: string;
    us_market_date?: string;
    us_market_day?: string;
    global_markets?: GlobalMarkets;
    tier_a: {
        dxy: MacroScore;
        us10y: MacroScore;
        vix: MacroScore;
    };
    tier_b: {
        foreign_cash: MacroScore;
        futures: MacroScore;
        short_selling: MacroScore;
    };
    overall_score: number;
    safety_level: 1 | 2 | 3;
    prediction_direction: string;
    interpretation: string;
    chain_analysis?: string;
    llm_analysis?: string;
    news_context?: string;
}

interface DailyReview {
    date: string;
    prediction: {
        direction: string;
        overall_score: number;
        safety_level: number;
        level_label: string;
        summary: string;
    };
    actual: {
        kospi_change: number;
        foreign_net: number;
        direction: string;
    };
    evaluation: {
        hit: boolean;
        label: string;
        comment: string;
    };
}

// ─── Score UI Helpers ────────────────────────────────────
function scoreColor(score: number): string {
    if (score <= -2) return 'text-red-400';
    if (score === -1) return 'text-red-300';
    if (score === 0) return 'text-slate-400';
    if (score === 1) return 'text-emerald-300';
    return 'text-emerald-400';
}

function scoreBg(score: number): string {
    if (score <= -2) return 'bg-red-500/10 border-red-500/30';
    if (score === -1) return 'bg-red-500/5 border-red-500/20';
    if (score === 0) return 'bg-slate-800 border-slate-700';
    if (score === 1) return 'bg-emerald-500/5 border-emerald-500/20';
    return 'bg-emerald-500/10 border-emerald-500/30';
}

function scoreIcon(score: number) {
    if (score > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (score < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

function safetyBadge(level: number) {
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

// ─── Zone Gauge (안전구간 시각화) ────────────────────────
// 각 지표별 구간 정의: [매우위험, 위험, 중립, 안전, 매우안전] 경계값
// position: 0(최악)~100(최선) 로 정규화
type ZoneConfig = {
    zones: { min: number; max: number; color: string; label: string }[];
    normalize: (val: number) => number; // 값 → 0~100 위치
    unit: string;
    ticks: { pos: number; label: string }[];
};

const ZONE_CONFIGS: Record<string, ZoneConfig> = {
    dxy_change: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '급등' },
            { min: 15, max: 35, color: 'bg-red-400/60', label: '상승' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 85, color: 'bg-emerald-400/60', label: '하락' },
            { min: 85, max: 100, color: 'bg-emerald-500', label: '급락' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 25)),  // +2%→0, 0→50, -2%→100
        unit: '%',
        ticks: [{ pos: 15, label: '+1.5%' }, { pos: 35, label: '+0.5%' }, { pos: 65, label: '-0.5%' }, { pos: 85, label: '-1.5%' }],
    },
    us10y_change: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '급등' },
            { min: 15, max: 35, color: 'bg-red-400/60', label: '상승' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 85, color: 'bg-emerald-400/60', label: '하락' },
            { min: 85, max: 100, color: 'bg-emerald-500', label: '급락' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 3.33)),  // +15bp→0, 0→50, -15bp→100
        unit: 'bp',
        ticks: [{ pos: 15, label: '+10bp' }, { pos: 35, label: '+3bp' }, { pos: 65, label: '-3bp' }, { pos: 85, label: '-10bp' }],
    },
    vix_level: {
        zones: [
            { min: 0, max: 15, color: 'bg-red-500', label: '패닉' },
            { min: 15, max: 30, color: 'bg-red-400/60', label: '불안' },
            { min: 30, max: 60, color: 'bg-slate-500', label: '정상' },
            { min: 60, max: 80, color: 'bg-emerald-400/60', label: '안정' },
            { min: 80, max: 100, color: 'bg-emerald-500', label: '낙관' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, (35 - v) * 2.86)),  // VIX 35→0, 20→43, 10→71, 0→100
        unit: '',
        ticks: [{ pos: 15, label: '30' }, { pos: 30, label: '25' }, { pos: 60, label: '15' }, { pos: 80, label: '12' }],
    },
    foreign: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '대량매도' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '매도' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '중립' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '매수' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '대량매수' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 + v / 100)),  // -5000→0, 0→50, +5000→100
        unit: '억',
        ticks: [{ pos: 10, label: '-5천' }, { pos: 35, label: '-500' }, { pos: 65, label: '+500' }, { pos: 90, label: '+5천' }],
    },
    futures: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '대량매도' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '매도' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '중립' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '매수' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '대량매수' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 + v / 250)),  // -12500→0, 0→50, +12500→100
        unit: '계약',
        ticks: [{ pos: 10, label: '-1만' }, { pos: 35, label: '-2천' }, { pos: 65, label: '+2천' }, { pos: 90, label: '+1만' }],
    },
    short_change: {
        zones: [
            { min: 0, max: 10, color: 'bg-red-500', label: '급증' },
            { min: 10, max: 35, color: 'bg-red-400/60', label: '증가' },
            { min: 35, max: 65, color: 'bg-slate-500', label: '보합' },
            { min: 65, max: 90, color: 'bg-emerald-400/60', label: '감소' },
            { min: 90, max: 100, color: 'bg-emerald-500', label: '급감' },
        ],
        normalize: (v) => Math.max(0, Math.min(100, 50 - v * 1.25)),  // +40→0, 0→50, -40→100
        unit: '%',
        ticks: [{ pos: 10, label: '+30%' }, { pos: 35, label: '+10%' }, { pos: 65, label: '-10%' }, { pos: 90, label: '-30%' }],
    },
};

function ZoneGauge({ zoneKey, rawValue }: { zoneKey: string; rawValue: number }) {
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

// ─── LLM Briefing Renderer ───────────────────────────────
function formatTextParts(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

function LlmBriefingContent({ content }: { content: string }) {
    return (
        <div className="space-y-1">
            {content.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;

                if (trimmed.startsWith('### ')) {
                    return (
                        <h4 key={i} className="text-purple-300 font-bold mt-4 mb-1 text-sm flex items-center gap-2">
                            {formatTextParts(trimmed.slice(4))}
                        </h4>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h3 key={i} className="text-purple-200 font-bold mt-5 mb-2 text-base">
                            {formatTextParts(trimmed.slice(3))}
                        </h3>
                    );
                }
                if (trimmed.startsWith('# ')) {
                    return (
                        <h2 key={i} className="text-purple-100 font-bold mt-5 mb-2 text-lg">
                            {formatTextParts(trimmed.slice(2))}
                        </h2>
                    );
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex gap-2 ml-2">
                            <span className="text-purple-400 shrink-0">·</span>
                            <span className="text-slate-300 text-sm">{formatTextParts(trimmed.slice(2))}</span>
                        </div>
                    );
                }
                if (/^\d+\.\s/.test(trimmed)) {
                    const match = trimmed.match(/^(\d+\.)\s(.*)$/);
                    return (
                        <div key={i} className="flex gap-2 ml-2">
                            <span className="text-purple-400 shrink-0 text-xs font-mono">{match?.[1]}</span>
                            <span className="text-slate-300 text-sm">{formatTextParts(match?.[2] || trimmed)}</span>
                        </div>
                    );
                }
                if (trimmed.startsWith('> ')) {
                    return (
                        <div key={i} className="border-l-2 border-purple-500/50 pl-3 ml-2 text-slate-400 text-sm italic">
                            {formatTextParts(trimmed.slice(2))}
                        </div>
                    );
                }
                if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
                    return <hr key={i} className="border-slate-700/50 my-3" />;
                }
                return (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed">
                        {formatTextParts(trimmed)}
                    </p>
                );
            })}
        </div>
    );
}

// ─── Market Card (Global Markets) ────────────────────────
function MarketCard({ label, icon, value, changePct, unit }: {
    label: string;
    icon: string;
    value: string;
    changePct: number;
    unit?: string;
}) {
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

// ─── Score Card ──────────────────────────────────────────
function ScoreCard({ label, icon, value, subValue, unit, score, accuracy, zoneKey, rawValue }: {
    label: string;
    icon: string;
    value: string;
    subValue: string;
    unit?: string;
    score: number;
    accuracy?: number;
    zoneKey?: string;
    rawValue?: number;
}) {
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

// ─── Daily Review Card ───────────────────────────────────
function DailyReviewCard({ review }: { review: DailyReview }) {
    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold text-white">📋 전일 리뷰</span>
                <span className="text-xs text-slate-500">({review.date})</span>
                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${review.evaluation.hit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {review.evaluation.label}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Prediction */}
                <div>
                    <div className="text-xs text-slate-500 mb-1">예측</div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200">
                            {review.prediction.level_label}
                        </span>
                        <span className="text-xs text-slate-400">
                            ({review.prediction.overall_score >= 0 ? '+' : ''}{review.prediction.overall_score.toFixed(2)})
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        {review.prediction.summary}
                    </p>
                </div>

                {/* Actual */}
                <div>
                    <div className="text-xs text-slate-500 mb-1">실제</div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`text-sm font-bold ${review.actual.kospi_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            KOSPI {review.actual.kospi_change >= 0 ? '+' : ''}{review.actual.kospi_change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-400">
                            외국인 {review.actual.foreign_net >= 0 ? '+' : ''}{review.actual.foreign_net.toLocaleString()}억
                        </span>
                    </div>
                </div>
            </div>

            {/* Evaluation */}
            <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-start gap-2">
                    {review.evaluation.hit
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    }
                    <p className="text-xs text-slate-300 leading-relaxed">{review.evaluation.comment}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Date Strip (가로 날짜 네비게이션) ─────────────────────
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function DateStrip({
    availableDates, selectedDate, onSelectDate
}: {
    availableDates: {date: string; score: number; safety_level: number; has_llm: boolean}[];
    selectedDate: string | null;
    onSelectDate: (date: string | null) => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const dateMap = new Map(availableDates.map(d => [d.date, d]));

    // 최근 14일 생성 (오늘 포함)
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
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

// ─── Main Component ──────────────────────────────────────
export function MacroDashboard() {
    const [data, setData] = useState<MacroData | null>(null);
    const [review, setReview] = useState<DailyReview | null>(null);
    const [accuracy, setAccuracy] = useState<Record<string, number>>({});
    const [history, setHistory] = useState<MacroData[]>([]);
    const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
    const [loading, setLoading] = useState(true);
    const [collecting, setCollecting] = useState(false);
    const [llmOpen, setLlmOpen] = useState(false);
    const [selectedBriefingDate, setSelectedBriefingDate] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = today
    const [dateData, setDateData] = useState<MacroData | null>(null);
    const [dateReview, setDateReview] = useState<DailyReview | null>(null);
    const [availableDates, setAvailableDates] = useState<{date: string; score: number; safety_level: number; has_llm: boolean}[]>([]);
    const [loadingDate, setLoadingDate] = useState(false);

    const fetchToday = useCallback(async () => {
        try {
            const res = await fetch('/api/macro?endpoint=today');
            if (!res.ok) return;
            const json = await res.json();
            if (json.data) setData(json.data);
            if (json.daily_review) setReview(json.daily_review);
            if (json.accuracy) setAccuracy(json.accuracy);
        } catch (e) {
            console.error('Macro fetch error:', e);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`/api/macro?endpoint=history&period=${period}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.data) setHistory(json.data);
        } catch (e) {
            console.error('History fetch error:', e);
        }
    }, [period]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchToday(), fetchHistory()]).finally(() => setLoading(false));
    }, [fetchToday, fetchHistory]);

    useEffect(() => {
        fetch('/api/macro?endpoint=dates')
            .then(r => r.json())
            .then(json => {
                if (json.dates) setAvailableDates(json.dates);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedDate) {
            setDateData(null);
            setDateReview(null);
            return;
        }
        setLoadingDate(true);
        fetch(`/api/macro?endpoint=date&date=${selectedDate}`)
            .then(r => r.json())
            .then(json => {
                setDateData(json.data || null);
                setDateReview(json.daily_review || null);
            })
            .catch(() => {
                setDateData(null);
                setDateReview(null);
            })
            .finally(() => setLoadingDate(false));
    }, [selectedDate]);

    const handleCollect = async () => {
        setCollecting(true);
        try {
            const res = await fetch('/api/macro', { method: 'POST' });
            const json = await res.json();
            if (json.data) setData(json.data);
            await fetchHistory();
        } catch (e) {
            console.error('Collect error:', e);
        } finally {
            setCollecting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-16">
                <p className="text-slate-400 mb-4">매크로 데이터가 없습니다</p>
                <button
                    onClick={handleCollect}
                    disabled={collecting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
                >
                    {collecting ? '수집 중...' : '데이터 수집 시작'}
                </button>
            </div>
        );
    }

    // 표시할 데이터: 선택된 날짜 or 오늘
    const displayData = selectedDate ? dateData : data;
    const displayReview = selectedDate ? dateReview : review;
    const isViewingPast = selectedDate !== null;

    const chartData = [...history].reverse().map(d => ({
        date: d.date.slice(5),
        score: d.overall_score,
        dxy: d.tier_a?.dxy?.score || 0,
        us10y: d.tier_a?.us10y?.score || 0,
        vix: d.tier_a?.vix?.score || 0,
        foreign: d.tier_b?.foreign_cash?.score || 0,
        futures: d.tier_b?.futures?.score || 0,
        short: d.tier_b?.short_selling?.score || 0,
    }));

    // LLM 브리핑이 있는 히스토리 항목 (오늘 제외)
    const briefingHistory = history
        .filter(h => h.llm_analysis && h.llm_analysis.trim() && h.date !== data.date)
        .slice(0, 10)
        .map(h => ({
            date: h.date,
            score: h.overall_score,
            safetyLevel: h.safety_level,
            content: h.llm_analysis!,
            preview: (h.llm_analysis || '').split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim().slice(0, 100) || '브리핑 내용',
        }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {safetyBadge(data.safety_level)}
                    <span className="text-2xl font-bold text-white">
                        {data.overall_score >= 0 ? '+' : ''}{data.overall_score.toFixed(2)}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-slate-500">
                            KR {data.date} ({data.kr_market_day || ''})
                        </span>
                        {data.us_market_date && (
                            <span className="text-[10px] text-slate-600">
                                US {data.us_market_date} ({data.us_market_day || ''})
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleCollect}
                        disabled={collecting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} />
                        {collecting ? '수집 중...' : '수집'}
                    </button>
                </div>
            </div>

            {/* Date Navigation Strip */}
            <div>
                <DateStrip
                    availableDates={availableDates}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                />
                {isViewingPast && (
                    <div className="mt-2 rounded-lg border border-blue-900/50 bg-blue-950/20 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-blue-300">
                            {selectedDate} 보고서
                        </span>
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="text-[11px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded hover:bg-blue-900/30"
                        >
                            오늘로 돌아가기
                        </button>
                    </div>
                )}
                {loadingDate && (
                    <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
                        <span className="ml-2 text-xs text-slate-500">로딩 중...</span>
                    </div>
                )}
            </div>

            {/* 선택한 날짜에 데이터가 없는 경우 */}
            {isViewingPast && !displayData && !loadingDate && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
                    <div className="text-3xl mb-3">📋</div>
                    <p className="text-slate-300 font-medium mb-2">
                        {selectedDate} 보고서가 아직 생성되지 않았습니다
                    </p>
                    <p className="text-xs text-slate-500">
                        매크로 보고서는 매일 오전 7시에 자동 생성됩니다
                    </p>
                </div>
            )}

            {displayData && !loadingDate && (() => {
                const krDate = displayData.date || '';
                const dateObj = krDate ? new Date(krDate + 'T00:00:00') : new Date();
                const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const krDay = displayData.kr_market_day || dayNames[dayOfWeek] || '';
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const usDate = displayData.us_market_date || '';
                const isUsStale = usDate && krDate && usDate < krDate;

                if (isWeekend) {
                    return (
                        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
                            <div className="text-3xl mb-3">📅</div>
                            <p className="text-slate-300 font-medium mb-2">
                                {krDate} ({krDay}요일) — 한국·미국 시장 휴장
                            </p>
                            <p className="text-xs text-slate-500">
                                다음 보고서는 월요일 오전 7시에 자동 생성됩니다
                            </p>
                        </div>
                    );
                }

                return (
            <>
            {/* Market Status Notice */}
            {isUsStale && (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
                    <span className="text-amber-400 text-xs">
                        ⚠️ 글로벌 데이터는 {usDate}({displayData.us_market_day}) 기준입니다{(() => { const d = Math.round((new Date(krDate).getTime() - new Date(usDate).getTime()) / 86400000); return d > 1 ? ` (${d}일 전)` : ''; })()}.
                        한국 장중 수급 데이터는 실시간으로 반영됩니다.
                    </span>
                </div>
            )}

            {/* Daily Review */}
            {displayReview && <DailyReviewCard review={displayReview} />}

            {/* Global Markets */}
            {displayData.global_markets && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        글로벌 시장 현황
                        {displayData.us_market_date && (
                            <span className="ml-2 text-[10px] font-normal normal-case text-slate-600">
                                ({displayData.us_market_date} {displayData.us_market_day})
                            </span>
                        )}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <MarketCard
                            label="나스닥"
                            icon="📈"
                            value={displayData.global_markets.nasdaq.value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '-'}
                            changePct={displayData.global_markets.nasdaq.change_pct}
                        />
                        <MarketCard
                            label="S&P 500"
                            icon="📊"
                            value={displayData.global_markets.sp500.value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '-'}
                            changePct={displayData.global_markets.sp500.change_pct}
                        />
                        <MarketCard
                            label="WTI 원유"
                            icon="🛢️"
                            value={displayData.global_markets.oil.value?.toFixed(2) || '-'}
                            changePct={displayData.global_markets.oil.change_pct}
                            unit="$"
                        />
                        <MarketCard
                            label="금"
                            icon="🥇"
                            value={displayData.global_markets.gold.value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '-'}
                            changePct={displayData.global_markets.gold.change_pct}
                            unit="$"
                        />
                        <MarketCard
                            label="비트코인"
                            icon="₿"
                            value={displayData.global_markets.bitcoin.value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '-'}
                            changePct={displayData.global_markets.bitcoin.change_pct}
                            unit="$"
                        />
                        {displayData.global_markets.krw_usd && (
                            <MarketCard
                                label="원/달러"
                                icon="💱"
                                value={displayData.global_markets.krw_usd.value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '-'}
                                changePct={displayData.global_markets.krw_usd.change_pct}
                                unit="원"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Tier A: Global */}
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Tier A: 글로벌 센티먼트 (선행지표)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <ScoreCard
                        label="DXY (달러지수)"
                        icon="💲"
                        value={displayData.tier_a.dxy.value?.toFixed(2) || '-'}
                        subValue={`전일비 ${displayData.tier_a.dxy.change_pct! >= 0 ? '+' : ''}${displayData.tier_a.dxy.change_pct?.toFixed(2) || 0}`}
                        unit="%"
                        score={displayData.tier_a.dxy.score}
                        accuracy={accuracy?.dxy}
                        zoneKey="dxy_change"
                        rawValue={displayData.tier_a.dxy.change_pct || 0}
                    />
                    <ScoreCard
                        label="US 10Y (미국채 금리)"
                        icon="📊"
                        value={displayData.tier_a.us10y.value ? `${displayData.tier_a.us10y.value.toFixed(2)}%` : '-'}
                        subValue={`전일비 ${displayData.tier_a.us10y.change_bps! >= 0 ? '+' : ''}${displayData.tier_a.us10y.change_bps?.toFixed(1) || 0}`}
                        unit="bp"
                        score={displayData.tier_a.us10y.score}
                        accuracy={accuracy?.us10y}
                        zoneKey="us10y_change"
                        rawValue={displayData.tier_a.us10y.change_bps || 0}
                    />
                    <ScoreCard
                        label="VIX (공포지수)"
                        icon="😱"
                        value={displayData.tier_a.vix.value?.toFixed(1) || '-'}
                        subValue={`전일비 ${displayData.tier_a.vix.change_pct! >= 0 ? '+' : ''}${displayData.tier_a.vix.change_pct?.toFixed(1) || 0}`}
                        unit="%"
                        score={displayData.tier_a.vix.score}
                        accuracy={accuracy?.vix}
                        zoneKey="vix_level"
                        rawValue={displayData.tier_a.vix.value || 20}
                    />
                </div>
            </div>

            {/* Tier B: Flow */}
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Tier B: 실제 수급 (동행지표)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <ScoreCard
                        label="외국인 현물"
                        icon="💰"
                        value={`${(displayData.tier_b.foreign_cash.net_amount || 0) >= 0 ? '+' : ''}${(displayData.tier_b.foreign_cash.net_amount || 0).toLocaleString()}억`}
                        subValue="당일 순매매"
                        score={displayData.tier_b.foreign_cash.score}
                        accuracy={accuracy?.foreign}
                        zoneKey="foreign"
                        rawValue={displayData.tier_b.foreign_cash.net_amount || 0}
                    />
                    <ScoreCard
                        label="외국인 선물"
                        icon="📈"
                        value={`${(displayData.tier_b.futures.net || 0) >= 0 ? '+' : ''}${(displayData.tier_b.futures.net || 0).toLocaleString()}`}
                        subValue="당일 순매매 계약"
                        score={displayData.tier_b.futures.score}
                        accuracy={accuracy?.futures}
                        zoneKey="futures"
                        rawValue={displayData.tier_b.futures.net || 0}
                    />
                    <ScoreCard
                        label="공매도/대차"
                        icon="📉"
                        value={`${displayData.tier_b.short_selling.change_pct! >= 0 ? '+' : ''}${displayData.tier_b.short_selling.change_pct?.toFixed(1) || 0}%`}
                        subValue="전일비 잔고 변동"
                        score={displayData.tier_b.short_selling.score}
                        accuracy={accuracy?.short}
                        zoneKey="short_change"
                        rawValue={displayData.tier_b.short_selling.change_pct || 0}
                    />
                </div>
            </div>

            {/* Chain Analysis */}
            {displayData.chain_analysis && (
                <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-5">
                    <h3 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                        <span>⚙️</span>
                        <span>연쇄 분석: 오늘의 자금 흐름</span>
                    </h3>
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                        {displayData.chain_analysis.split('\n').map((line, i) => {
                            const trimmed = line.trimStart();
                            // Section headers
                            if (trimmed.startsWith('[ ') || trimmed.startsWith('━━━')) {
                                return <div key={i} className="text-blue-400 font-bold mt-3 mb-1 text-xs">{line}</div>;
                            }
                            // Score lines (▶ strong, · normal)
                            if (trimmed.startsWith('▶')) {
                                return <div key={i} className="text-amber-300 ml-2 mb-0.5 text-xs font-semibold">{line}</div>;
                            }
                            if (trimmed.startsWith('·')) {
                                return <div key={i} className="text-slate-400 ml-2 mb-0.5 text-xs">{line}</div>;
                            }
                            // Tier average line
                            if (trimmed.startsWith('Tier A 평균') || trimmed.startsWith('Tier B 평균')) {
                                return <div key={i} className="text-slate-200 ml-2 mb-1 text-xs font-mono bg-slate-800/50 rounded px-2 py-1 inline-block">{line}</div>;
                            }
                            // Evidence tags
                            if (line.includes('(근거:')) {
                                const parts = line.split('(근거:');
                                return (
                                    <div key={i} className="ml-2 mb-0.5">
                                        <span className="text-slate-300">{parts[0]}</span>
                                        <span className="text-slate-500 text-xs">(근거:{parts[1]}</span>
                                    </div>
                                );
                            }
                            // Warning/signal lines
                            if (line.includes('⚠️') || line.includes('🟢') || line.includes('🚨') || line.includes('⚡')) {
                                return <div key={i} className="text-amber-300 font-semibold mt-1">{line}</div>;
                            }
                            // Arrow lines (explanations)
                            if (trimmed.startsWith('→')) {
                                return <div key={i} className="text-slate-400 ml-4 mb-0.5 text-xs">{trimmed}</div>;
                            }
                            // Weekend notice
                            if (line.includes('📅')) {
                                return <div key={i} className="text-slate-300 font-semibold">{line}</div>;
                            }
                            // Regular text
                            if (line.trim()) {
                                return <div key={i} className="text-slate-300 ml-2 mb-0.5">{line}</div>;
                            }
                            return <div key={i} className="h-1" />;
                        })}
                    </div>
                </div>
            )}

            {/* Tier Score Interpretation (fallback when chain_analysis is not available) */}
            {!displayData.chain_analysis && displayData.interpretation && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-5">
                    <h3 className="text-sm font-bold text-white mb-3">📊 지표별 스코어 해석</h3>
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {displayData.interpretation}
                    </div>
                </div>
            )}

            {/* LLM Team Briefing */}
            <div className="rounded-lg border border-purple-900/50 bg-purple-950/20 p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        LLM 팀 브리핑
                    </h3>
                    <div className="flex items-center gap-2">
                        {!displayData.llm_analysis && (
                            <button
                                onClick={handleCollect}
                                disabled={collecting}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors"
                            >
                                <Sparkles className={`w-3 h-3 ${collecting ? 'animate-spin' : ''}`} />
                                {collecting ? '생성 중...' : '브리핑 생성'}
                            </button>
                        )}
                        {displayData.llm_analysis && (
                            <button
                                onClick={() => setLlmOpen(!llmOpen)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-300 hover:bg-purple-900/30 rounded-lg transition-colors"
                            >
                                {llmOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {llmOpen ? '접기' : '펼치기'}
                            </button>
                        )}
                    </div>
                </div>
                {!displayData.llm_analysis && !collecting && (
                    <p className="mt-3 text-xs text-slate-500">
                        오늘의 LLM 팀 브리핑이 아직 없습니다. 매크로 데이터 + 뉴스를 기반으로 전문가 팀 분석을 생성합니다.
                    </p>
                )}
                {collecting && !displayData.llm_analysis && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-purple-400">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        매크로 수집 + 뉴스 분석 + LLM 브리핑 생성 중... (약 1~2분)
                    </div>
                )}
                {llmOpen && displayData.llm_analysis && (
                    <div className="mt-4 pt-4 border-t border-purple-900/30">
                        <LlmBriefingContent content={displayData.llm_analysis} />
                    </div>
                )}
                {!llmOpen && displayData.llm_analysis && (
                    <p className="mt-2 text-xs text-slate-500 truncate">
                        {displayData.llm_analysis.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim().slice(0, 120) || '브리핑이 준비되었습니다.'}...
                    </p>
                )}
            </div>
            </>
                );
            })()}

            {/* LLM Briefing History */}
            {briefingHistory.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" />
                        지난 LLM 브리핑
                    </h3>
                    <div className="space-y-2">
                        {briefingHistory.map((item) => (
                            <div
                                key={item.date}
                                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                                    selectedBriefingDate === item.date
                                        ? 'border-purple-700/50 bg-purple-950/20'
                                        : 'border-slate-700 bg-slate-900/30 hover:bg-slate-800/50'
                                }`}
                                onClick={() => setSelectedBriefingDate(
                                    selectedBriefingDate === item.date ? null : item.date
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-300">{item.date}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            item.safetyLevel === 1 ? 'bg-emerald-500/20 text-emerald-300' :
                                            item.safetyLevel === 3 ? 'bg-red-500/20 text-red-300' :
                                            'bg-amber-500/20 text-amber-300'
                                        }`}>
                                            L{item.safetyLevel}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-mono ${item.score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {item.score >= 0 ? '+' : ''}{item.score.toFixed(2)}
                                        </span>
                                        {selectedBriefingDate === item.date
                                            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                        }
                                    </div>
                                </div>
                                {selectedBriefingDate !== item.date && (
                                    <p className="text-[11px] text-slate-500 mt-1 truncate">{item.preview}</p>
                                )}
                                {selectedBriefingDate === item.date && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <LlmBriefingContent content={item.content} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History Chart */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        히스토리
                    </h3>
                    <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                        {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`text-xs py-1 px-3 rounded-md transition-colors ${
                                    period === p
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:text-slate-300'
                                }`}
                            >
                                {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : '연간'}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length > 0 ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis domain={[-2, 2]} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <ReferenceLine y={0.5} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
                                <ReferenceLine y={-0.5} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
                                <ReferenceLine y={0} stroke="#475569" strokeOpacity={0.3} />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#818cf8"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#818cf8' }}
                                    name="종합점수"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        히스토리 데이터가 없습니다
                    </div>
                )}
            </div>

            {/* Accuracy Bar Chart */}
            {Object.keys(accuracy).length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        🎯 지표별 예측 적중률
                    </h3>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={[
                                { name: 'DXY', acc: (accuracy.dxy || 0) * 100 },
                                { name: 'US10Y', acc: (accuracy.us10y || 0) * 100 },
                                { name: 'VIX', acc: (accuracy.vix || 0) * 100 },
                                { name: '외국인', acc: (accuracy.foreign || 0) * 100 },
                                { name: '선물', acc: (accuracy.futures || 0) * 100 },
                                { name: '공매도', acc: (accuracy.short || 0) * 100 },
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                    formatter={(value: number) => [`${value.toFixed(0)}%`, '적중률']}
                                />
                                <ReferenceLine y={50} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.5} />
                                <Bar dataKey="acc" radius={[4, 4, 0, 0]}>
                                    {[
                                        accuracy.dxy, accuracy.us10y, accuracy.vix,
                                        accuracy.foreign, accuracy.futures, accuracy.short
                                    ].map((acc, i) => (
                                        <Cell
                                            key={i}
                                            fill={(acc || 0) >= 0.7 ? '#34d399' : (acc || 0) >= 0.5 ? '#fbbf24' : '#f87171'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
