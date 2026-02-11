'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts';
import { RefreshCw, CheckCircle, AlertTriangle, Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type {
    MacroScore,
    GlobalMarketItem,
    GlobalMarkets,
    KrwUsdItem,
    RiskIndicators,
    MacroData,
    EconomicEvent,
    DailyReview
} from './types';
import { safetyBadge } from './utils';
import { ZoneGauge } from './components/zone-gauge';
import { LlmBriefingContent } from './components/llm-briefing-content';
import { MarketCard } from './components/market-card';
import { RiskCard } from './components/risk-card';
import { ScoreCard } from './components/score-card';
import { DailyReviewCard } from './components/daily-review-card';
import { EconomicCalendarBanner } from './components/economic-calendar-banner';
import { DateStrip } from './components/date-strip';


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
    const [llmPmOpen, setLlmPmOpen] = useState(false);
    const [yesterdayTierB, setYesterdayTierB] = useState<any>(null);
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
            if (json.yesterday_tier_b) setYesterdayTierB(json.yesterday_tier_b);
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
            const res = await fetch('/api/macro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'manual' }),
            });
            const json = await res.json();
            if (json.data) setData(json.data);
            await fetchHistory();
        } catch (e) {
            console.error('Collect error:', e);
        } finally {
            setCollecting(false);
        }
    };

    const [generatingBriefing, setGeneratingBriefing] = useState(false);

    const handleGenerateBriefing = async () => {
        setGeneratingBriefing(true);
        try {
            const res = await fetch('/api/macro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'am' }),
            });
            const json = await res.json();
            if (json.data) setData(json.data);
        } catch (e) {
            console.error('Briefing generate error:', e);
        } finally {
            setGeneratingBriefing(false);
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
                    {!isViewingPast && (
                        <button
                            onClick={handleCollect}
                            disabled={collecting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} />
                            {collecting ? '수집 중...' : '수집'}
                        </button>
                    )}
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

            {/* Economic Calendar — 공지사항 배너 */}
            {displayData?.economic_calendar?.economic_events && displayData.economic_calendar.economic_events.length > 0 && (
                <EconomicCalendarBanner events={displayData.economic_calendar.economic_events} />
            )}

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

            {/* Parse chain analysis into sections */}
            {(() => {
                const ca = displayData.chain_analysis || '';
                const sections: Record<string, string> = {};
                if (ca) {
                    const sectionRegex = /\[\s*(\d+)\.\s*([^\]]+)\]/g;
                    const summaryRegex = /\[\s*종합[^\]]*\]/;
                    const parts = ca.split(/(?=\[\s*\d+\.\s*)/);
                    for (const part of parts) {
                        const m = part.match(/\[\s*(\d+)\.\s*([^\]]+)\]/);
                        if (m) {
                            const lines = part.split('\n').slice(1).filter(l => l.trim()).map(l => l.trim());
                            sections[m[1]] = lines.join('\n');
                        }
                    }
                    // Extract 종합 + 대응 구간
                    const summaryIdx = ca.indexOf('[ 종합');
                    if (summaryIdx >= 0) sections['summary'] = ca.slice(summaryIdx);
                    else {
                        const lastDash = ca.lastIndexOf('━━━');
                        if (lastDash >= 0 && ca.indexOf('선별적 대응') > 0) {
                            const actionIdx = ca.lastIndexOf('━━━', ca.indexOf('선별적 대응'));
                            if (actionIdx >= 0) sections['summary'] = ca.slice(actionIdx);
                        }
                    }
                }

                const ChainSnippet = ({ text }: { text: string }) => (
                    <div className="mt-2 rounded border border-blue-900/30 bg-blue-950/10 px-3 py-2">
                        <div className="text-[13px] text-slate-400 leading-relaxed">
                            {text.split('\n').map((line, i) => {
                                const t = line.trim();
                                if (t.startsWith('→')) return <div key={i} className="text-slate-500 ml-2">{t}</div>;
                                if (t.startsWith('(근거:')) return <div key={i} className="text-slate-600 ml-2 text-[12px]">{t}</div>;
                                if (t) return <div key={i}>{t}</div>;
                                return null;
                            })}
                        </div>
                    </div>
                );

                return (<>

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
                    {sections['2'] && <ChainSnippet text={sections['2']} />}
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
                {(sections['1'] || sections['3'] || sections['4']) && (
                    <ChainSnippet text={[sections['1'], sections['3'], sections['4']].filter(Boolean).join('\n')} />
                )}
            </div>

            {/* Risk / Liquidity Indicators (Tier A+) */}
            {displayData.risk_indicators && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        리스크 / 유동성 지표
                        <span className="ml-2 text-[10px] font-normal normal-case text-slate-600">(LLM 참고용)</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* US 2Y + 2s10s Spread */}
                        <RiskCard
                            label="US 2Y + 2s10s"
                            desc="단기금리 + 장단기 스프레드 (역전 시 침체 신호)"
                            value={displayData.risk_indicators.us2y?.value != null ? `${displayData.risk_indicators.us2y.value.toFixed(2)}%` : '-'}
                            subValue={(() => {
                                const bps = displayData.risk_indicators.us2y?.change_bps || 0;
                                const spread = displayData.risk_indicators.spread_2s10s;
                                const spreadStr = spread != null ? ` | 2s10s ${spread > 0 ? '+' : ''}${spread.toFixed(0)}bp` : '';
                                return `${bps >= 0 ? '+' : ''}${bps.toFixed(1)}bp${spreadStr}`;
                            })()}
                            subColor={(() => {
                                const spread = displayData.risk_indicators.spread_2s10s;
                                if (spread != null && spread < 0) return 'red';
                                return 'neutral';
                            })()}
                        />
                        {/* HY Spread */}
                        <RiskCard
                            label="HY Spread (하이일드)"
                            desc="회사채 위험 프리미엄 (400bp↑ 위험회피, 600bp↑ 신용경색)"
                            value={displayData.risk_indicators.hy_spread?.value != null ? `${displayData.risk_indicators.hy_spread.value.toFixed(0)}bp` : '-'}
                            subValue={`${(displayData.risk_indicators.hy_spread?.change_bps || 0) >= 0 ? '+' : ''}${(displayData.risk_indicators.hy_spread?.change_bps || 0).toFixed(1)}bp`}
                            subColor={(() => {
                                const v = displayData.risk_indicators.hy_spread?.value;
                                if (v != null && v >= 400) return 'red';
                                return 'neutral';
                            })()}
                        />
                        {/* MOVE Index */}
                        <RiskCard
                            label="MOVE (채권 변동성)"
                            desc="채권판 VIX (120↑ 금리 급변 경계)"
                            value={displayData.risk_indicators.move?.value != null ? displayData.risk_indicators.move.value.toFixed(1) : '-'}
                            subValue={`${(displayData.risk_indicators.move?.change_pct || 0) >= 0 ? '+' : ''}${(displayData.risk_indicators.move?.change_pct || 0).toFixed(2)}%`}
                            subColor={(() => {
                                const v = displayData.risk_indicators.move?.value;
                                if (v != null && v >= 120) return 'red';
                                return 'neutral';
                            })()}
                        />
                        {/* EWY */}
                        <RiskCard
                            label="EWY (MSCI Korea ETF)"
                            desc="외국인이 보는 한국시장 대리지표"
                            value={displayData.global_markets?.ewy?.value != null ? `$${displayData.global_markets.ewy.value.toFixed(2)}` : '-'}
                            subValue={`${(displayData.global_markets?.ewy?.change_pct || 0) >= 0 ? '+' : ''}${(displayData.global_markets?.ewy?.change_pct || 0).toFixed(2)}%`}
                            subColor={(() => {
                                const chg = displayData.global_markets?.ewy?.change_pct || 0;
                                if (chg > 0.5) return 'green';
                                if (chg < -0.5) return 'red';
                                return 'neutral';
                            })()}
                        />
                    </div>
                    {(() => {
                        const ri = displayData.risk_indicators;
                        const ewy = displayData.global_markets?.ewy;
                        const lines: string[] = [];
                        // 2s10s
                        const spread = ri.spread_2s10s;
                        if (spread != null) {
                            if (spread < 0) lines.push(`2s10s 스프레드 ${spread.toFixed(0)}bp 역전 — 경기 침체 신호, 방어적 포지션 필요.`);
                            else if (spread < 30) lines.push(`2s10s 스프레드 ${spread.toFixed(0)}bp로 평탄화 진행 중 — 경기 둔화 우려 주시.`);
                            else lines.push(`2s10s 스프레드 ${spread.toFixed(0)}bp 정상 범위 — 수익률 곡선 건전, 침체 신호 없음.`);
                        }
                        // HY
                        const hy = ri.hy_spread?.value;
                        if (hy != null) {
                            if (hy >= 600) lines.push(`HY 스프레드 ${hy.toFixed(0)}bp — 신용경색 구간, 위험자산 회피 강화.`);
                            else if (hy >= 400) lines.push(`HY 스프레드 ${hy.toFixed(0)}bp — 위험회피 심화, 신용 리스크 경계.`);
                            else lines.push(`HY 스프레드 ${hy.toFixed(0)}bp — ${hy < 300 ? '매우 양호한' : '안정적인'} 신용 환경.`);
                        }
                        // MOVE
                        const mv = ri.move?.value;
                        if (mv != null) {
                            if (mv >= 120) lines.push(`MOVE ${mv.toFixed(0)} — 채권 변동성 경계 구간, 금리 급변 리스크 주의.`);
                            else lines.push(`MOVE ${mv.toFixed(0)} — 채권 변동성 정상 범위, 금리 급변 리스크 낮음.`);
                        }
                        // EWY
                        if (ewy?.change_pct != null) {
                            const chg = ewy.change_pct;
                            if (chg > 1) lines.push(`EWY ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% — 외국인 한국 투자 심리 긍정적.`);
                            else if (chg < -1) lines.push(`EWY ${chg.toFixed(1)}% — 외국인 한국 투자 심리 위축.`);
                            else lines.push(`EWY ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% — 외국인 시각 중립.`);
                        }
                        return lines.length > 0 ? <ChainSnippet text={lines.join('\n')} /> : null;
                    })()}
                </div>
            )}

            {/* 전일 마감 잔고 (Yesterday Tier B) */}
            {yesterdayTierB && !isViewingPast && (
                <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        전일 마감 잔고
                        <span className="ml-2 text-[10px] font-normal normal-case text-slate-600">
                            ({yesterdayTierB.date})
                        </span>
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-3">
                            <div className="text-[10px] text-slate-500 mb-1">외국인 현물</div>
                            <div className={`text-sm font-bold ${(yesterdayTierB.foreign_cash?.net_amount || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(yesterdayTierB.foreign_cash?.net_amount || 0) >= 0 ? '+' : ''}{(yesterdayTierB.foreign_cash?.net_amount || 0).toLocaleString()}억
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">스코어: {yesterdayTierB.foreign_cash?.score ?? '-'}</div>
                        </div>
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-3">
                            <div className="text-[10px] text-slate-500 mb-1">외국인 선물</div>
                            <div className={`text-sm font-bold ${(yesterdayTierB.futures?.net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(yesterdayTierB.futures?.net || 0) >= 0 ? '+' : ''}{(yesterdayTierB.futures?.net || 0).toLocaleString()}계약
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">스코어: {yesterdayTierB.futures?.score ?? '-'}</div>
                        </div>
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-3">
                            <div className="text-[10px] text-slate-500 mb-1">공매도 변동</div>
                            <div className={`text-sm font-bold ${(yesterdayTierB.short_selling?.change_pct || 0) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {(yesterdayTierB.short_selling?.change_pct || 0) >= 0 ? '+' : ''}{(yesterdayTierB.short_selling?.change_pct || 0).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">스코어: {yesterdayTierB.short_selling?.score ?? '-'}</div>
                        </div>
                    </div>
                </div>
            )}

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
                {sections['5'] && <ChainSnippet text={sections['5']} />}
            </div>

            {/* Chain Analysis — Summary only */}
            {sections['summary'] && (
                <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-5">
                    <h3 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                        <span>⚙️</span>
                        <span>종합 분석</span>
                    </h3>
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                        {sections['summary'].split('\n').map((line, i) => {
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

                </>);
            })()}

            {/* AM 예측 브리핑 */}
            <div className="rounded-lg border border-purple-900/50 bg-purple-950/20 p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        AM 예측 브리핑
                        {displayData.collected_at_am ? (
                            <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                                {new Date(displayData.collected_at_am).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        ) : (
                            <span className="text-[10px] font-normal text-purple-400/60">자동 07:00 / 18:00</span>
                        )}
                    </h3>
                    <div className="flex items-center gap-2">
                        {!isViewingPast && (
                            <button
                                onClick={handleGenerateBriefing}
                                disabled={generatingBriefing}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors"
                            >
                                <Sparkles className={`w-3 h-3 ${generatingBriefing ? 'animate-spin' : ''}`} />
                                {generatingBriefing ? '생성 중...' : displayData.llm_analysis ? '재생성' : '브리핑 생성'}
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
                {!displayData.llm_analysis && !generatingBriefing && (
                    <p className="mt-3 text-xs text-slate-500">
                        AM 예측 브리핑이 아직 없습니다. 매일 07:00 자동 생성되거나 위 버튼으로 수동 생성하세요.
                    </p>
                )}
                {generatingBriefing && (
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
                {!llmOpen && displayData.llm_analysis && !generatingBriefing && (
                    <p className="mt-2 text-xs text-slate-500 truncate">
                        {displayData.llm_analysis.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim().slice(0, 120) || '브리핑이 준비되었습니다.'}...
                    </p>
                )}
            </div>

            {/* PM 결산 브리핑 */}
            {displayData.llm_analysis_pm && (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            PM 결산 브리핑
                            <span className="text-[10px] font-normal text-amber-400/60">
                                {displayData.collected_at_pm ? new Date(displayData.collected_at_pm).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '18:00'}
                            </span>
                        </h3>
                        <button
                            onClick={() => setLlmPmOpen(!llmPmOpen)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-900/30 rounded-lg transition-colors"
                        >
                            {llmPmOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {llmPmOpen ? '접기' : '펼치기'}
                        </button>
                    </div>
                    {llmPmOpen && (
                        <div className="mt-4 pt-4 border-t border-amber-900/30">
                            <LlmBriefingContent content={displayData.llm_analysis_pm} />
                        </div>
                    )}
                    {!llmPmOpen && (
                        <p className="mt-2 text-xs text-slate-500 truncate">
                            {displayData.llm_analysis_pm.split('\n').find(l => l.trim() && !l.startsWith('#'))?.trim().slice(0, 120) || '결산 브리핑이 준비되었습니다.'}...
                        </p>
                    )}
                </div>
            )}
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
